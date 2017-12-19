global.__basedir = __dirname;

const app = require('express')();
const config = require('./config');
const moment = require('moment');
const asyncLib = require('async');

const routes = require('./routes');
const Trip = require('./trip.js');
const Utils = require('./utils.js');
const { Train, Station } = require(__basedir + '/models');

let stations = {};
let trains = {};

app.get('/favicon.ico', (req, res) => res.status(204));
// /location?long=(required)&lat(required)=&maxDistance=(optional)
app.get('/api/location', routes.location.getLocation);
app.get('/api/stations', routes.station.getStations);
app.get('/api/lines/raw', routes.lines.getRawLines);
app.get('/api/lines', routes.lines.getLines);

const startServer = () => new Promise(resolve => {
  config.profile('lifted server');
  app.listen(config.port, () => {
    config.profile('lifted server');
    config.debug('Listening on port', config.port);
    return resolve();
  });
});

const pollTrains = () => {
  config.db.stations.find({}).toArray((e, allStations) => {
    if (e) return config.error(e);

    stations = Utils.cleanStationData(allStations);
    trains = {};

    const lineTask = line => asyncLib.reflect(cb => Trip.load({ line, trains, stations }, cb));
    const pollingTasks = Object.keys(Utils.urls).map(line => lineTask(line));

    config.profile('polling');
    asyncLib.parallel(pollingTasks, (err, results) => {
      const records = [];

      Object.keys(trains).forEach(line => {
        Object.keys(trains[line]).forEach(train_id => records.push(trains[line][train_id]))
      });

      return Train.bulkSave(records, 'train_id')
        .then(response => {
          const { ok, nInserted, nUpserted, nMatched, nModified, nRemoved } = response;
          config.debug('Lines save - ok', ok, 'nInserted', nInserted, 'nUpserted', nUpserted, 'nMatched', nMatched, 'nModified', nModified,'nRemoved', nRemoved);
          return Station.saveAll(stations)
        })
        .then(() => config.profile('polling'))
        .catch(e => config.error('Error in saving trains or stations', e));
    });
  });
};

const beginPolling = () => {
  Train.removeOldTrains().then(() => {
    pollTrains();
    setInterval(pollTrains, 60000); // every minute
    setInterval(Train.removeOldTrains, Utils.hoursToMs(2));
  });
};

config.connect()
.then(startServer)
.then(beginPolling)
