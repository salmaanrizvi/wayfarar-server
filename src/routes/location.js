const moment = require('moment-timezone');
const asyncLib = require('async');

const config = require(__basedir + '/config');
const { Station, Train } = require(__basedir + '/models');
const { minsToSeconds, timezone, logDateFormat } = require(__basedir + '/utils.js');

const ERRORS = {
  latLongReq: 'Latitude and longitude are required as lat and long query parameters.',
  invalidLatLong: 'Invalid longitude and latitude supplied. Must supply latitude and longitude as lat and long.',
  serverError: 'Internal server error fetching trains for location.'
}

// /location?long=(required)&lat(required)=&maxDistance=(optional)
const getLocation = (req, res) => {
  let { lat, long, maxDistance } = req.query;

  if (!long || !lat) return res.status(400).send(ERRORS.latLongReq);

  long = parseFloat(long);
  lat = parseFloat(lat);

  if (isNaN(long) || isNaN(lat)) {
   return res.status(400).send(ERRORS.invalidLatLong);
  }

  const now = moment().unix();
  maxDistance = parseFloat(maxDistance);
  maxDistance = !isNaN(maxDistance) ? maxDistance : 1609; // default is 1.0 miles;

  const coordinates = [long, lat];
  config.debug('searching for coordinates', coordinates);
  config.debug('max distance', maxDistance);

  const data = { stations: [], trains: [] };
  const stopIds = [];

  Station.findNear({ coordinates, maxDistance, limit: 5 })
    .then(stations => {
      data.stations = stations;
      config.debug('returned', stations.length);

      const twentyMins = now + minsToSeconds(20);
      const twoMinutesAgo = now - minsToSeconds(2);

      stations.forEach(station => (stopIds.push(station.stop_id + 'N', station.stop_id + 'S')));

      const query = {
        $and: [{ stops: { $elemMatch: { station_id: { $in: stopIds } } } },
          { stops: { $elemMatch: { arrivalTime: { $lt: twentyMins, $gt: now } } } },
          { lastUpdated: { $gt: twoMinutesAgo } }]
      };

      return Train.find(query).sort('-lastUpdated direction').exec();
    })
    .then(trains => {
      const directions = { N: [], S: [] };

      trains.forEach(train => {
        // train.stops = train.stops.filter(stop => stopIds.indexOf(stop.station_id) > -1);
        directions[train.direction].push(train);
      });

      data.trains = directions;
      return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(JSON.stringify(data, null, 2));
    })
    .catch(err => {
      config.error(err);
      return res.status(500).send(ERRORS.serverError)
    });
};

module.exports = { getLocation };