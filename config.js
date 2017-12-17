const rp = require('request-promise');
const moment = require('moment');
const config = {};

config.env = process.env.NODE_ENV || 'development';

config.req = (options) => (method = 'GET', params) => {
  options.qs = Object.assign({}, options.qs || {}, params);
  return rp(options).catch(error => console.error('Error in request', error));
}

config.mta = {
  req: config.req({
    uri: 'http://datamine.mta.info/mta_esi.php',
    qs: { key: process.env.MTA_KEY },
    encoding: null,
    json: false
  })
};

config.nydata = {
  req: config.req({
    uri: 'https://data.ny.gov/resource/hvwh-qtfg.json',
    headers: { 'Content-Type': 'application/json', 'X-App-Token': process.env.NY_GOV_APP_TOKEN },
    json: true
  })
};

config.db = {
  url: `mongodb://${ process.env.DB_USER }:${ process.env.DB_PASS }@ds049661.mlab.com:49661/wayfarerdb`
};

config.debug = (...args) => {
  if (config.env === 'development') console.log('[*debug*]', ...args);
};

config.error = (...args) => console.error(...args);

config.profiles = {};

config.profile = id => {
  if (config.profiles[id]) {
    const time = moment() - config.profiles[id];
    config.debug(id, 'in', time, 'ms');
    delete config.profiles[id];
  }
  else {
    config.profiles[id] = moment();
  }
}

module.exports = config;
