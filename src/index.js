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
const trains = {};

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

    const lineTask = line => asyncLib.reflect(cb => Trip.load({ line, trains, stations }, cb));
    const pollingTasks = Object.keys(Utils.urls).map(line => lineTask(line));

    config.profile('polling');
    asyncLib.parallel(pollingTasks, (err, results) => {
      Station.saveAll(stations).then(response => {
        config.profile('polling');
      });
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
