const config = require(__basedir + '/config');
const { Station, Train } = require(__basedir + '/models');

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

  Station.findNear({ coordinates, maxDistance })
    .then(stations => {
      data.stations = stations;
      const train_ids = stations.reduce((ids, station) => ids.concat(station.trains.N, station.trains.S), []);

      return Train.find({ train_id: { $in: train_ids }}).sort('-lastUpdated direction').exec();
    })
    .then(trains => {
      data.trains = trains;
      return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(JSON.stringify(data, null, 2));
    })
    .catch(err => {
      config.error(err);
      return res.status(500).send(ERRORS.serverError)
    });
};

module.exports = { getLocation };