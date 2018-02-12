global.__basedir = __dirname;

const app = require('express')();
const config = require('./config');
const moment = require('moment');
const asyncLib = require('async');

const Routes = require('./routes');
const Trip = require('./trip.js');
const Utils = require('./utils.js');
const { Train, Station } = require(__basedir + '/models');

let stations = {};
let trains = {};

app.get('/favicon.ico', (req, res) => res.status(204));
// api/location?long=(required)&lat(required)=&maxDistance=(optional)
app.get('/api/location', Routes.location.getLocation);
app.get('/api/stations', Routes.station.getStations);
app.get('/api/lines/raw', Routes.lines.getRawLines);
app.get('/api/lines', Routes.lines.getLines);

const loadStations = () => new Promise((resolve, reject) => {
  if (!config.isWorker) return resolve();
  config.profile('loaded stations');
  config.db.stations.find({}).toArray((err, stationArr) => {
    if (err) {
      config.error(err);
      return reject(err);
    }

    stations = Utils.cleanStationData(stationArr);
    config.profile('loaded stations');
    return resolve();
  });
});

const startServer = () => new Promise(resolve => {
  if (!config.isServer) return resolve();
  config.profile('lifted server');
  app.listen(config.port, () => {
    config.profile('lifted server');
    config.debug('Listening on port', config.port);
    return resolve();
  });
});

const pollTrains = () => {
  trains = {};

  config.profile('polling');

  return loadStations().then(() => {
    const lineTask = line => asyncLib.reflect(cb => Trip.load({ line, trains, stations }, cb));
    const pollingTasks = Object.keys(Utils.urls).map(line => lineTask(line));

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
  if (!config.isWorker) return Promise.resolve();
  return Train.removeOldTrains().then(() => {
    pollTrains();
    setInterval(pollTrains, 30000); // every 30 seconds
    setInterval(Train.removeOldTrains, Utils.hoursToMs(2));
  });
};

config.connect()
  .then(loadStations)
  .then(startServer)
  .then(beginPolling)
  .catch(config.error);
