const moment = require('moment-timezone');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const config = require(__basedir + '/config');
const { VehicleStopStatus, AlertCause, AlertEffect, dateFormat, timezone, urls, routeIdsToLines } = require(__basedir + '/utils.js');
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

  if (routeIdsToLines[routeId.toLowerCase()]) {

    const mappedRouteId = routeIdsToLines[routeId.toLowerCase()];
    if (mappedRouteId.toLowerCase() !== line) return null;
  }
  else if (routeId.toLowerCase() !== line) return null;

  const timestamp = ts ? moment.unix(ts).tz(timezone).format(dateFormat) : ts;
  const current_status = VehicleStopStatus[vehicle.current_status];
  const data = {
    current_status: current_status || VehicleStopStatus.IN_TRANSIT_TO,
    timestamp,
    current_stop_seq: vehicle.current_stop_sequence || 0
  }

  let tripData = tripId.split('..');
  if (!tripData[1]) {
    config.debug('couldnt split trip id on .. trying single period.', tripId);
    tripData = tripId.split('.');
  }
  
  if (tripData[1]) {
    const direction = tripData[1][0];
    data.direction = direction;
  }
  
  const route = tripData[0].split('_')[1];
  data.route = route;
  data.train_id = tripId;
  return { data, tripId };
};

trip.parseTripUpdate = (update, line, stations, missingStations) => {
  const {
    stop_time_update: updates = [],
    trip: {
      trip_id: tripId,
      route_id: routeId,
    } = {}
  } = update;

  if (routeIdsToLines[routeId.toLowerCase()]) {
    const mappedRouteId = routeIdsToLines[routeId.toLowerCase()];
    if (mappedRouteId.toLowerCase() !== line) return null;
  }
  else if (routeId.toLowerCase() !== line) return null;

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

    if (stations[stop_id_no_dir]) {
      const { stop_name, trains, stop_id: stId } = stations[stop_id_no_dir];
      stopName = stop_name;
      stations[stop_id_no_dir].lastUpdated = lastUpdated;

      if (trains[direction].indexOf(tripId) === -1) {
        trains[direction].push(tripId);
      }
    }
    else missingStations.add(stop_id);

    const updateData = {
      station_id: stop_id,
      station_name: stopName,
      arrivalTime: arrivalLow
    };

    data.push(updateData);
  });

  return { data, tripId, lastUpdated };
};

trip.parseUpdateForLine = (entities, line, stations) => {
  const missingStations = new Set();

  const lineUpdate = entities.reduce((lineData, entity) => {
    const { trip_update: update, vehicle, alert } = entity;
    if (vehicle) {
      const response = trip.parseVehicle(vehicle, line);
      if (response) {
        const { data, tripId } = response;
        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, data);
      }
    }
    
    if (update) {
      const response = trip.parseTripUpdate(update, line, stations, missingStations);
      if (response) {
        const { data, tripId, lastUpdated } = response;
        const towards = (data[data.length - 1] || {}).station_name || '';
        lineData[tripId] = Object.assign({}, lineData[tripId] || {}, { lastUpdated, stops: data, towards });
      }
    }

    if (alert) {
      const { informed_entity, cause, effect, header_text } = alert;
      let causeText = AlertCause[cause] || AlertCause[0];
      let effectText = AlertEffect[effect] || AlertEffect[8];
      const { translation: [description = {}] = [] } = header_text;
      const text = description.text || 'Delayed (default)';

      informed_entity.forEach(entity => {
        const {
          trip: {
            trip_id: tripId = '',
            route_id: routeId = '',
          } = {}
        } = entity;

        if (lineData[tripId]) {
          config.debug('Found alert for trip in line data', tripId);
          const tripData = lineData[tripId];
          const alerts = tripData.alerts || [];
          const alert = { cause, effect, text };
          alerts.push(alert);
          tripData.alerts = alerts;
          Utils.notify('Trip Alert', tripData);
        }
      });
    }

    return lineData;
  }, {});

  if (missingStations.size) {
    config.debug('Missing', missingStations.size, 'stations for line', line, [...missingStations].toString()); 
  }

  return lineUpdate;
};

trip.load = ({ line, stations, trains, parse = true }, cb) => {
  line = line.toLowerCase();
  if (!line || !urls[line]) {
    return cb(new Error(`${ line } is not a supported line.`));
  }
  
  config.mta.req('GET', { feed_id: urls[line] })
    .then(body => {

      let feed;
      try { feed = GtfsRealtimeBindings.FeedMessage.decode(body); }
      catch (e) {
        config.error('Error parsing MTA feed for line', line, e);
        return cb({ e, line });
      }

      if(!parse) return cb(null, feed);

      const lineData = trip.parseUpdateForLine(feed.entity, line, stations);
      trains[line] = lineData;
      return cb(null, trains);
    })
    .catch(error => {
      config.error(error);
      return cb(error);
    });
}

module.exports = trip;