const MongoClient = require('mongodb').MongoClient;
const app = require('express')();
const asyncLib = require('async');
const mongoose = require('mongoose').set('debug', true);
const { Train, Station, createTextIndexes, save } = require('./models.js');
const moment = require('moment');
const { buildStations } = require('./stops.js');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const config = require('./config.js');
const { urls } = require('./utils.js');
const { parseUpdateForLine, findDocuments } = require('./trip.js');

let stations = {};
const trains = {};

const load = (line, parse = true, cb) => {
  line = line.toLowerCase();
  if (!line || !urls[line]) return cb(new Error(`${ line } is not a supported line.`));
  
  config.debug('loading line', line);
  
  config.mta.req('GET', { feed_id: urls[line] })
  .then(body => {

    let feed;
    try { feed = GtfsRealtimeBindings.FeedMessage.decode(body); }
    catch (e) {
      config.error('error parsing MTA feed', e);
      return cb({ e, line });
    }

    if(!parse) return cb(null, feed);

    const lineData = parseUpdateForLine(feed.entity, line, stations);
    trains[line] = lineData;

    const records = Object.keys(lineData).map(train_id => lineData[train_id]);
    return save(records, Train, 'train_id')
  })
  // .then(response => {
  //   const { ok, nInserted, nUpserted, nMatched, nModified, nRemoved } = response;
  //   config.debug('line save - ok', ok, 'nInserted', nInserted, 'nUpserted', nUpserted, 'nMatched', nMatched, 'nModified', nModified,'nRemoved', nRemoved);
  //   const stationRecords = Object.keys(stations).map(stop_id => stations[stop_id]);
  //   return save(stationRecords, Station, 'stop_id');
  // })
  .then(response => {
    const { ok, nInserted, nUpserted, nMatched, nModified, nRemoved } = response;
    config.debug('line save - ok', ok, 'nInserted', nInserted, 'nUpserted', nUpserted, 'nMatched', nMatched, 'nModified', nModified,'nRemoved', nRemoved);
    return cb(null, trains[line]);
  })
  .catch(error => {
    config.debug(error);
    return cb(error);
  });
}

app.get('/favicon.ico', function(req, res) {
  res.status(204);
});

// /location?long=(required)&lat(required)=&maxDistance=(optional)
app.get('/location', function(req, res) {
  let { lat, long, maxDistance } = req.query;

  if (!long || !lat) return res.status(400).send('Longitude and Latitude required.');

  long = parseFloat(long);
  lat = parseFloat(lat);

  if (isNaN(long) || isNaN(lat)) return res.status(400).send('Invalid longitude and latitude supplied');

  maxDistance = parseFloat(maxDistance);
  maxDistance = !isNaN(maxDistance) ? maxDistance : 1609; // default is 1.0 miles;

  const coordinates = [long, lat];
  config.debug('searching for coordinates', coordinates);
  config.debug('max distance', maxDistance);

  const data = { stations: [], trains: [] };

  findDocuments({ coordinates, maxDistance })
  .then(nearby => {
    data.stations = nearby;
    const train_ids = nearby.reduce((ids, station) => ids.concat(station.trains.N, station.trains.S), []);
    console.log('train ids', train_ids);
    return Train.find({ train_id: { $in: train_ids }}).sort('-lastUpdated direction').exec();
  })
  .then(trains => {
    data.trains = trains;
    return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(JSON.stringify(data, null, 2));
  })
  .catch(err => res.status(500).send('Error querying db'));
});

app.get('/stations', (req, res) => {
  res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200);

  const { stop_id, stop_name } = req.query;
  if (!stop_id && !stop_name) return res.send(`Station Count: ${ Object.keys(stations).length }\n` + JSON.stringify(stations, null, 2));

  let search = {};
  if (stop_id) search.stop_id = stop_id;
  if (stop_name) search = Object.assign(search, { $text: { $search: stop_name } });

  config.debug(search);

  config.db.stations.find(search).toArray((err, response) => {
    config.debug(err, response.length);
    return res.send(JSON.stringify(response, null, 2));
  });
});

app.get('/lines/:line', (req, res) => {
  const line = req.params.line;
  if (!line) return res.status(404).send('Not Found!');

  load(line, true, (err, feed) => {
    if (err) {
      config.debug('error loading the line', err);
      return res.status(404).send(err);
    }

    return res.set({ 'Content-Type': 'application/json; charset=utf-8' })
      .status(200)
      .send(JSON.stringify(feed, null, 2));
  });
});

app.get('/rawdata/:line', (req, res) => {
  const line = req.params.line;
  if (!line) return res.status(404).send('Not Found!');

  load(line, false, (err, feed) => {
    if (err) {
      config.debug('error loading the line', err);
      return res.status(404).send(err);
    }

    return res.set({ 'Content-Type': 'application/json; charset=utf-8' })
      .status(200)
      .send(JSON.stringify(feed, null, 2));
  });
});

const saveStations = () => {
  const stationRecords = Object.keys(stations).map(stop_id => stations[stop_id]);
  return save(stationRecords, Station, 'stop_id');
}

const pollTrains = () => {

  config.db.stations.find({}).toArray((e, stationData) => {
    if (e) return;
    const stop_id = stationData[20].stop_id;
    config.debug('before poll start -', stop_id, stationData[0].trains);
    stations = stationData.reduce((data, station) => {
      const emptyTrains = { trains: { S: [], N: [] } };
      const cleanStation = Object.assign({}, station, emptyTrains);
      return Object.assign(data, { [station.stop_id]: cleanStation });
    }, {});

    const lineTask = line => asyncLib.reflect(callback => load(line, true, callback));
    const pollingTasks = Object.keys(urls).map(line => lineTask(line));

    config.debug('on poll start -', stop_id, stations[stop_id].trains);

    config.profile('polling');
    asyncLib.parallel(pollingTasks, (err, results) => {
      saveStations().then(response => {
        const { ok, nInserted, nUpserted, nMatched, nModified, nRemoved } = response;
        config.profile('polling');
        config.debug('station save - ok', ok, 'nInserted', nInserted, 'nUpserted', nUpserted, 'nMatched', nMatched, 'nModified', nModified,'nRemoved', nRemoved);
        config.debug('Finished polling all subway lines with', err, 'errors and', results.length, 'successful polls');
        config.debug('On poll finish - ', stop_id, stations[stop_id]);
      });
    });
  });
};

const hoursToSeconds = hrs => 60 * 60 * hrs;
const hoursToMs = hrs => 60 * 60 * hrs * 1000;

const pollForTrains = freq => setInterval(pollTrains, freq);
const pollToClearTrains = freq => setInterval(clearOldTrains, freq);

const clearOldTrains = () => {
  Train.remove({}).where('lastUpdated').lt(moment().unix() - hoursToSeconds(5)).exec((err, trains) => {
    if (err) return config.error(err);
    return config.debug('removed train ids', trains.result.n);
  });
}

config.profile('mongodb');
mongoose.connect(config.db.url, { useMongoClient: true })
.then(db => {
  config.profile('mongodb');

  config.db.stations = db.collections.stations;
  config.db.trains = db.collections.trains;

  app.listen(8888, () => { 
    config.debug('Listening on 8888');
    pollTrains();
    // pollForTrains(60000);
//     pollToClearTrains(hoursToMs(2)); // two hours
  });
});
