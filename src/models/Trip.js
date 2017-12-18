const config = require(__basedir + '/config');
const moment = require('moment');
const { VehicleStopStatus, dateFormat } = require(__basedir + '/utils.js');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const { urls } = require(__basedir + '/utils.js');

const { Train } = require(__basedir + '/models');

const trip = {};

trip.parseVehicle = (vehicle, line) => {
  const {
    trip: {
      trip_id: tripId = '',
      route_id: routeId = '',
    } = {},
    timestamp: { low: ts = 0 } = {},
  } = vehicle;

  if (routeId.toLowerCase() !== line) return null;

  const timestamp = ts ? moment.unix(ts).format(dateFormat) : ts;
  const current_status = VehicleStopStatus[vehicle.current_status];
  const data = {
    current_status: current_status || VehicleStopStatus.STOPPED_AT,
    timestamp,
    current_stop_seq: vehicle.current_stop_sequence || 'null'
  }

  const tripData = tripId.split('..');
  if (!tripData[1]) config.debug('dont have trip id', tripId);
  else if (tripData[1]) {
    const direction = tripData[1][0];  
    data.direction = direction;
  }
  
  const route = tripData[0].split('_')[1];
  data.route = route;
  data.train_id = tripId;
  return { data, tripId };
};

trip.parseTripUpdate = (update, line, stations) => {
  const {
    stop_time_update: updates = [],
    trip: {
      trip_id: tripId,
      route_id: routeId,
    } = {}
  } = update;

  if (routeId.toLowerCase() !== line) return null;

  const lastUpdated = moment().unix();
  const data = [];

  updates.forEach(trainUpdate => {
    const {
      stop_id, 
      arrival,
      departure,
    } = trainUpdate;

    const arrivalLow = arrival && arrival.time && arrival.time.low || 0;

    let stopName = '';
    const stop_id_no_dir = stop_id.slice(0, stop_id.length - 1);
    const direction = stop_id.slice(stop_id.length - 1);

    let arrivalTimeHuman = arrivalLow !== 0 ? moment.unix(arrivalLow).format(dateFormat) : arrivalLow;

    if (stations[stop_id_no_dir]) {
      const { stop_name, trains, stop_id: stId } = stations[stop_id_no_dir];
      stopName = stop_name;
      stations[stop_id_no_dir].lastUpdated = lastUpdated;

      if (trains[direction].indexOf(tripId) === -1) {
        trains[direction].push(tripId);

        if (stId === '123') {
          config.debug(stop_id, stId, routeId)
          config.debug(update);
          config.debug(line);
        }
      }
    }
    else config.error('Didn\'t find', stop_id, 'in stations data');

    const updateData = {
      station_id: stop_id,
      station_name: stopName,
      arrivalTime: arrivalLow,
      arrives: arrivalTimeHuman,
    };
    data.push(updateData);
  });

  return { data, tripId, lastUpdated };
};

trip.parseUpdateForLine = (entities, line, stations) => {
  const lineUpdate = entities.reduce((lineData, entity) => {
    const { trip_update: update, vehicle } = entity;
    if (vehicle) {
      const response = trip.parseVehicle(vehicle, line);
      if (response) {
        const { data, tripId } = response;
        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, data);
      }
    }
    else if (update) {
      const response = trip.parseTripUpdate(update, line, stations);
      if (response) {
        const { data, tripId, lastUpdated } = response;
        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, { lastUpdated, stops: data });
      }
    }
    return lineData;
  }, {});

  return lineUpdate;
};

trip.load = ({ line, stations, trains, parse = true }, cb) => {
  line = line.toLowerCase();
  if (!line || !urls[line]) {
    return cb(new Error(`${ line } is not a supported line.`));
  }
  
  config.debug('Loading line', line);
  
  config.mta.req('GET', { feed_id: urls[line] })
    .then(body => {

      let feed;
      try { feed = GtfsRealtimeBindings.FeedMessage.decode(body); }
      catch (e) {
        config.error('Error parsing MTA feed', e);
        return cb({ e, line });
      }

      if(!parse) return cb(null, feed);

      const lineData = trip.parseUpdateForLine(feed.entity, line, stations);
      trains[line] = lineData;

      const records = Object.keys(lineData).map(train_id => lineData[train_id]);
      return Train.bulkSave(records, 'train_id')
    })
    .then(response => {
      const { ok, nInserted, nUpserted, nMatched, nModified, nRemoved } = response;
      config.debug('line save - ok', ok, 'nInserted', nInserted, 'nUpserted', nUpserted, 'nMatched', nMatched, 'nModified', nModified,'nRemoved', nRemoved);
      return cb(null, trains[line]);
    })
    .catch(error => {
      config.error(error);
      return cb(error);
    });
}

module.exports = trip;