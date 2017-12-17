const moment = require('moment');
const { VehicleStopStatus, dateFormat } = require('./utils.js');
const config = require('./config.js');

const parseVehicle = (vehicle, line) => {
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

const parseTripUpdate = (update, line, stations) => {
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
    // const departureLow = departure && departure.time && departure.time.low || 'N/A';

    let stopName = '';
    const stop_id_no_dir = stop_id.slice(0, stop_id.length - 1);
    const direction = stop_id.slice(stop_id.length - 1);

    let arrivalTimeHuman = arrivalLow !== 0 ? moment.unix(arrivalLow).format(dateFormat) : arrivalLow;
    // let departureTimeHuman = departureLow !== 'N/A' ? moment.unix(departureLow).format(dateFormat) : departureLow;

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
    else config.debug('didnt find stop id in stations data', stop_id);

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

const parseUpdateForLine = (entities, line, stations) => {
  const lineUpdate = entities.reduce((lineData, entity) => {
    const { trip_update: update, vehicle } = entity;
    if (vehicle) {
      const response = parseVehicle(vehicle, line);
      if (response) {
        const { data, tripId } = response;
        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, data);
      }
    }
    else if (update) {
      const response = parseTripUpdate(update, line, stations);
      if (response) {
        const { data, tripId, lastUpdated } = response;
        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, { lastUpdated, stops: data });
      }
    }
    return lineData;
  }, {});

  return lineUpdate;
};

// default distance of ~1.5 mi
const findDocuments = ({ coordinates, maxDistance = 2414 }) => {
  return new Promise(resolve => {
    // Find some documents
    const near = {
      'location.coordinates': { 
        $near: {
          $geometry: {
            type: "Point",
            coordinates: coordinates
          },
          $maxDistance: maxDistance
        }
      }
    };

    config.db.stations.find(near).toArray((err, stations) => {
      config.debug("Found the following records", stations.length);
      resolve(stations);
    });
  });
};

module.exports = { parseUpdateForLine, findDocuments };