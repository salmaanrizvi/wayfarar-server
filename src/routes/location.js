const moment = require('moment');
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

  maxDistance = parseFloat(maxDistance);
  maxDistance = !isNaN(maxDistance) ? maxDistance : 1609; // default is 1.0 miles;

  const coordinates = [long, lat];
  config.debug('searching for coordinates', coordinates);
  config.debug('max distance', maxDistance);

  const data = { stations: [], trains: [] };
  const stopIds = [];

  Station.findNear({ coordinates, maxDistance, limit: 5 })
    .then(stations => {
      // return new Promise(resolve => {
        data.stations = stations;
        config.debug('returned', stations.length);

        const now = moment().unix();
        const twentyMins = now + minsToSeconds(20);

        stations.forEach(station => {
        //   const query = (stopId) => {
        //     return (cb) => {
        //       Train.find({
        //         stops: {
        //           $elemMatch: {
        //             station_id: stopId,
        //             arrivalTime: { $lt: twentyMins, $gt: now },
        //           }
        //         }
        //       }, { fields: }).exec(cb);
        //     };
        //   };

          // stopIds.push(query(station.stop_id + 'N'), query(station.stop_id + 'S'));
          stopIds.push(station.stop_id + 'N', station.stop_id + 'S');
        });

        // asyncLib.parallel(stopIds, (err, response) => {
        //   config.debug('finished parallel', err);
        //   config.debug(response);
        //   return resolve(response);
        // });

        const query = {
          stops: {
            $elemMatch: {
              station_id: { $in: stopIds },
              arrivalTime: { $lt: twentyMins, $gt: now },
            }
          }
        };

        return Train.find(query).sort('-lastUpdated direction').exec();
      // });
    })
    .then(trains => {
      data.trains = trains;
      trains.forEach(train => {
        train.stops.forEach(stop => {
          if (stopIds.indexOf(stop.station_id) > -1) {
            const time = moment.unix(stop.arrivalTime).format(logDateFormat);
            config.debug(train.direction, 'bound train arriving to', stop.station_name, 'at', time);
          }
        })
      });
      // config.debug('returning', data.stations.length, 'stations and', data.trains.length, 'trains');
      return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(JSON.stringify(data, null, 2));
    })
    .catch(err => {
      config.error(err);
      return res.status(500).send(ERRORS.serverError)
    });
};

module.exports = { getLocation };