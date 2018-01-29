const rp = require('request-promise');
const mongoose = require('mongoose');
const moment = require('moment');
const colors = require('colors');
const dateFormat = 'MMM Do, k:mm:ss'

const config = {
  DEV: 'development',
  PROD: 'production'
};

config.env = process.env.NODE_ENV || config.DEV;
config.port = process.env.PORT || 8888;

config.req = (options) => (method = 'GET', params) => {
  options.qs = Object.assign({}, options.qs || {}, params);
  return rp(options).catch(error => config.error('Error in request', error));
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
  const now = moment().format(dateFormat);
  console.log(`[${ now } - ${ config.env }]`.green, ...args);
};

config.error = (...args) => {
  const now = moment().format(dateFormat);
  console.log(`[${ now } - ${ config.env }]`.red, ...args);
};

config.profiles = {};

config.profile = id => {
  if (config.profiles[id]) {
    const time = moment() - config.profiles[id];
    config.debug(id, 'in', time, 'ms');
    delete config.profiles[id];
  }
  else config.profiles[id] = moment();
};

config.saveDb = db => {
  config.profile('mongodb');
  config.db.stations = db.collections.stations;
  config.db.trains = db.collections.trains;
};

config.connect = () => {
  if (config.env === config.DEV) mongoose.set('debug', true);
  config.profile('mongodb');
  return mongoose.connect(config.db.url, { useMongoClient: true })
    .then(config.saveDb);
};

module.exports = config;
