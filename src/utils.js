const utils = {};

const Sendgrid = require('@sendgrid/mail');
Sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

utils.logDateFormat = 'MMM Do, k:mm:ss';
utils.dateFormat = 'dddd, MMMM Do YYYY, h:mm:ss a';
utils.timezone = 'America/New_York';

utils.urls = {
  a: '26', c: '26', e: '26',
  b: '21', d: '21', f: '21', m: '21',
  n: '16', q: '16', r: '16', w: '16',
  g: '31', l: '2',  j: '36', z: '36',
  '1': '1', '2': '1', '3': '1', 
  '4': '1', '5': '1', '6': '1', 's': '1',
  '7': '51', sir: '11'
};

utils.routeIdsToLines = {
  si: 'sir', gs: 's'
};

utils.linesToRouteIds = {
  sir: 'SI', s: 'GS',
}

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

utils.AlertCause = {
  0: 'Unknown cause',
  1: 'Other cause', //'Other cause (not represented by any of these options)'
  2: 'Technical problem',
  3: 'Strike',
  4: 'Demonstration',
  5: 'Accident',
  6: 'Holiday',
  7: 'Weather',
  8: 'Maintenance',
  9: 'Construction',
  10: 'Police activity',
  11: 'Medical emergency',
};

utils.AlertEffect = {
  0: 'No service',
  1: 'Reduced service',
  2: 'Significant delays',
  3: 'Detour',
  4: 'Additional service',
  5: 'Modified service',
  6: 'Stop moved',
  7: 'Other effect',
  8: 'Unknown effect',
};

utils.minsToSeconds = mins => 60 * mins;
utils.hoursToSeconds = hrs => 60 * 60 * hrs;
utils.hoursToMs = hrs => 60 * 60 * hrs * 1000;

utils.cleanStationData = stations => {
  return stations.reduce((data, station) => {
    const emptyTrains = { trains: { S: [], N: [] } };
    const cleanStation = Object.assign({}, station, emptyTrains);
    return Object.assign(data, { [station.stop_id]: cleanStation });
  }, {});
};

utils.notify = (subject, message, error)  => {
  // using SendGrid's v3 Node.js Library
  // https://github.com/sendgrid/sendgrid-nodejs
  const text = (error && error.stack) || message;
  const msg = {
    to: [{ email: 'sar228@cornell.edu'}],
    from: 'sar228@cornell.edu',
    subject,
    text: `${ text }`
  };
  return Sendgrid.send(msg);
};

module.exports = utils;
