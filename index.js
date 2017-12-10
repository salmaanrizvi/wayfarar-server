const app = require('express')();
const asyncLib = require('async');
const mongoose = require('mongoose');
const { Train, Station } = require('./models.js');
const moment = require('moment');
const { buildStations } = require('./stops.js');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const config = require('./config.js');
const { urls, VehicleStopStatus, dateFormat } = require('./utils.js');

let stations = {};
const trains = {};

const load = (line, parse = true, cb) => {
  line = line.toLowerCase();
  if (!line || !urls[line]) return cb(new Error(`${ line } is not a supported line.`));
  
  config.mta.req('GET', { feed_id: urls[line] })
  .then(body => {

    let feed;
    try {
      feed = GtfsRealtimeBindings.FeedMessage.decode(body);
    }
    catch (e) {
      config.error('error parsing MTA feed', e);
      return cb(e);
    }

    if(!parse) return cb(null, feed);

    const lineData = {};

    feed.entity.forEach(entity => {
      const { trip_update, vehicle } = entity;

      if (vehicle) {
        const {
          trip: {
            trip_id: tripId = '',
            route_id: routeId = '',
          } = {},
          timestamp: { low: ts = 0 } = {},
        } = vehicle;

        if (routeId.toLowerCase() !== line) return;

        const timestamp = ts ? moment.unix(ts).format(dateFormat) : ts;
        const current_status = VehicleStopStatus[vehicle.current_status];
        const data = {
          current_status: current_status || VehicleStopStatus.STOPPED_AT,
          timestamp,
          current_stop_seq: vehicle.current_stop_sequence || 'null'
        }

        const tripData = tripId.split('..');
        const direction = tripData[1];
        const route = tripData[0].split('_')[1];

        data.direction = direction;
        data.route = route;

        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, data);
      }
      else if (trip_update) {
        const {
          stop_time_update: updates = [],
          trip: {
            trip_id: tripId,
            route_id: routeId,
          } = {}
        } = trip_update;

        if (routeId.toLowerCase() !== line) return;

        const data = [];
        updates.forEach(trainUpdate => {
          const {
            stop_id, 
            arrival,
            departure,
          } = trainUpdate;

          const arrivalLow = arrival && arrival.time && arrival.time.low || 'N/A';
          const departureLow = departure && departure.time && departure.time.low || 'N/A';

          let stopName = '';
          const stop_id_no_dir = stop_id.slice(0, stop_id.length - 1);
          const direction = stop_id.slice(stop_id.length - 1);

          let arrivalTimeHuman = arrivalLow !== 'N/A' ? moment.unix(arrivalLow).format(dateFormat) : arrivalLow;
          let departureTimeHuman = departureLow !== 'N/A' ? moment.unix(departureLow).format(dateFormat) : departureLow;

          if (stations[stop_id_no_dir]) {
            stopName = stations[stop_id_no_dir].stop_name;
            const lastUpdated = moment().unix();
            stations[stop_id_no_dir].lastUpdated = lastUpdated;
            const trains = stations[stop_id_no_dir].trains;
            if (!trains || !trains[direction]) config.debug('missing trains for dir', direction, stations[stop_id_no_dir]);
            else if (trains[direction].indexOf(tripId) === -1) trains[direction].push(tripId);
          }
          else config.debug('didnt find stop id in stations data', stop_id);

          const updateData = {
            station_id: stop_id,
            station_name: stopName,
            arrivalTime: arrivalLow,
            arrives: arrivalTimeHuman,
            departs: departureLow,
          };
          data.push(updateData);
        });

        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, { stops: data });
      }
    });

    trains[line] = lineData;
    return cb(null, trains[line]);
  });
}

app.get('/favicon.ico', function(req, res) {
  res.status(204);
});

app.get('/stations/:station_id?', (req, res) => {
  const station_id = req.params.station_id;
  res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200);

  if (!station_id || !stations[station_id]) {
    return res.status(200).send(`Station Count: ${ Object.keys(stations).length } \n` + JSON.stringify(stations, null, 2));
  }
  else {
    const { daytime_routes, lastUpdated } = stations[station_id];
    const reqTime = moment().unix();

    if (!lastUpdated || reqTime - lastUpdated > 60) {
      const lineTask = line => asyncLib.reflect(callback => {
        config.debug('loading line', line);
        load(line, true, callback);
      });
      const lineTasks = daytime_routes.map(line => lineTask(line));

      asyncLib.parallel(lineTasks, (err, responses) => {
        const errs = responses.filter(response => {
          if (response instanceof Error) return response.message;
          return false;
        });
        const resp = `${ errs.length ? errs : '' }\n` + JSON.stringify(stations[station_id], null, 2);
        return res.status(200).send(resp);
      });
    }
    else return res.status(200).send(JSON.stringify(stations[station_id], null, 2));
  }
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

mongoose.connect(config.db.url, { useMongoClient: true })
// .then(() => {
  // Station.remove({}).exec((err, results) => config.debug(err, results.result.n))
  // Station.find({}).exec((err, results) => {
  //   config.debug(results.length);
  // });
// })
// .then(buildStations)
// .then((updatedStations) => {
.then(() => {
  Station.find({}).exec((err, results) => {
    if (err) return config.error(error);
    results.forEach(result => stations[result.stop_id] = result);
  });



  // Station.remove({}).exec((err, results) => {
  //   config.debug(err, results.result.n);
  //   const stops = Object.keys(stations).map(stop_id => new Station(stations[stop_id]));
  //   Station.insertMany(stops).then(result => config.debug('result of inserting stations', result));
  // });

  // Station.find({ stop_id: '101' }).exec((err, results) => {
  //   config.debug('err', err);
  //   config.debug('found stations with stop_id', results);
  // });
  // const Station = mongoose.model('Station', stationSchema);

  // const vanCortlandtPark = new Station(stations['101']);
  // vanCortlandtPark.save(() => config.debug('sucess saving', vanCortlandtPark));

  app.listen(8888, () => config.debug('Listening on 8888'))
})
.catch(err => config.error('Error connecting to mongo', err));
