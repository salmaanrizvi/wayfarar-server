const utils = {};

utils.logDateFormat = 'MMM Do, k:mm:ss';
utils.dateFormat = 'dddd, MMMM Do YYYY, h:mm:ss a';
utils.timezone = 'America/New_York';

utils.urls = {
  a: '26', c: '26', e: '26',
  b: '21', d: '21', f: '21', m: '21',
  n: '16', q: '16', r: '16', w: '16',
  g: '31', l: '2',  j: '36', z: '36',
  '1': '1', '2': '1', '3': '1', '4': '1', '5': '1', '6': '1', 's': '1',
  sir: '11'
};

utils.VehicleStopStatus = {
  // The vehicle is just about to arrive at the stop (on a stop
  // display, the vehicle symbol typically flashes).
  INCOMING_AT: 0,
  0: 'INCOMING_AT',

  // The vehicle is standing at the stop.
  STOPPED_AT: 1,
  1: 'STOPPED_AT',

  // The vehicle has departed and is in transit to the next stop.
  IN_TRANSIT_TO: 2,
  2: 'IN_TRANSIT_TO'
};

utils.hoursToSeconds = hrs => 60 * 60 * hrs;
utils.hoursToMs = hrs => 60 * 60 * hrs * 1000;

utils.cleanStationData = stations => {
  return stations.reduce((data, station) => {
    const emptyTrains = { trains: { S: [], N: [] } };
    const cleanStation = Object.assign({}, station, emptyTrains);
    return Object.assign(data, { [station.stop_id]: cleanStation });
  }, {});
};

module.exports = utils;
