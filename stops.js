const fs = require('fs');
const asyncLib = require('async');
const config = require('./config.js');
const oldFilepath = __dirname + '/google-transit/stops.txt';
const newFilepath = __dirname + '/mta/stops.txt';
const stationEntranceData = require('./google-transit/station-entrance-exit.json');

const missingStations = ['D03', 'D01', 'D03', 'D01', 'D05', 'D04','D03','D01','D09','D08','D07','D06','D05','D04','D03','D01','A24','A15','D13'];

const buildStations = function() {
  const stations = {};

  const data = fs.readFileSync(newFilepath, 'utf8');
  const parsed = data.split('\n');
  const stationDataKeys = parsed.splice(0, 1)[0].split(',');

  parsed.forEach(stationString => {
    const stationArrData = stationString.split(',');
    const station = { trains: { N: [], S: [] } };

    stationArrData.forEach((data, idx) => {
      const key = stationDataKeys[idx].replace('\r', '');

      if (key === 'daytime_routes') station[key] = data.split(' ');
      else if (['stop_lat', 'stop_lon'].indexOf(key) > -1) station[key] = parseFloat(data);
      else station[key] = data.replace('\r', '');
    });

    stations[station.stop_id] = station;
  });

  addMissingStations(stations);
  return addEntranceData(stations);
}

const addMissingStations = function(stations) {
  const data = fs.readFileSync(oldFilepath, 'utf8');
  const parsed = data.split('\n');
  const stationDataKeys = parsed.splice(0, 1)[0].split(',');

  parsed.forEach(stationString => {
    const stationArrData = stationString.split(',');
    if (stationArrData[0].includes('//')) return config.debug('commented out', stationArrData[0]);
    const station = { trains: { N: [], S: [] } };

    const routeInfo = stationArrData[0];
    const direction = routeInfo[routeInfo.length - 1];

    if (direction !== 'N' && direction !== 'S') { // parent station
      const stop_id = routeInfo;
      const existingStation = stations[stop_id];
      if (!existingStation) {
        config.debug('found station that exists in old data set but not new', stop_id);
        stationArrData.forEach((data, idx) => {
          const key = stationDataKeys[idx].replace('\r', '');
          station[key] = data.replace('\r', '');
        });

        stations[station.stop_id] = station;
      }
    }
  });

  return stations;
}

const addEntranceData = function(stations) {
  return new Promise(resolve => {
    const stationTasks = [];

    Object.keys(stations).forEach(id => {
      const station = stations[id];

      const stationTask = station => cb => {
        const station_latitude = station.stop_lat;
        const station_longitude = station.stop_lon;

        config.nydata.req('GET', { station_latitude, station_longitude })
        .then(body => {
          const entrances = [];

          body.forEach(data => {
            if (!station.daytime_routes) {
              config.debug('adding station data for', station.stop_id);
              station.daytime_routes = [];
              for (let i = 1; i < 13; i++) {
                const route = data[`route${ i }`];
                if (route) station.daytime_routes.push(route);
              }
            }

            entrances.push({
              latitude: parseFloat(data.entrance_latitude),
              longitude: parseFloat(data.entrance_longitude),
              corner: data.corner,
            });
          });

          station.entrances = entrances;
          return cb(null, body.length);
        });
      }

      stationTasks.push(stationTask(station));
    });

    asyncLib.parallelLimit(stationTasks, 20, (err, results) => {
      if (err) config.debug('error getting station tasks', err);
      // callback(err, results);
      return resolve(stations);
    });
  });
}

module.exports = { buildStations };
