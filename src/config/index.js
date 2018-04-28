const rp = require('request-promise');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const colors = require('colors');
const utils = require(__basedir + '/utils.js');

const Sendgrid = require('@sendgrid/mail');
console.log('loading config module', process.env.SENDGRID_API_KEY);
Sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

const config = {
  DEV: 'development',
  PROD: 'production',
  nodeTypes: {
    SERVER: 'server',
    WORKER: 'worker'
  }
};

config.env = process.env.NODE_ENV || config.DEV;
config.port = process.env.PORT || 8000;
config.nodeType = process.env.NODE_TYPE ? process.env.NODE_TYPE.split(',') : [config.nodeTypes.SERVER];

config.isServer = config.nodeType.indexOf(config.nodeTypes.SERVER) > -1;
config.isWorker = config.nodeType.indexOf(config.nodeTypes.WORKER) > -1;

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
  const now = moment.tz(utils.timezone).format(utils.logDateFormat);
  console.log(`[${ now } - ${ config.env } - ${ config.nodeType }]`.green, ...args);
};

config.error = (...args) => {
  const now = moment.tz(utils.timezone).format(utils.logDateFormat);
  console.log(`[${ now } - ${ config.env } - ${ config.nodeType }]`.red, ...args);
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
  config.debug('Lifting ART in ', config.env, ' mode. Node types:', config.nodeType);
  if (config.env === config.DEV) mongoose.set('debug', true);
  config.profile('mongodb');
  return mongoose.connect(config.db.url, { useMongoClient: true })
    .then(config.saveDb);
};

config.notify = (subject, message, error)  => {
  // using SendGrid's v3 Node.js Library
  // https://github.com/sendgrid/sendgrid-nodejs
  const text = (error && error.stack) || message;
  const msg = {
    to: [{ email: 'sar228@cornell.edu'}],
    from: 'sar228@cornell.edu',
    subject: `[ART - ${ config.nodeType }] - ${ subject }`,
    text: `${ text }`
  };
  config.debug('Notifying.....', msg.subject, msg.text);
  return Sendgrid.send(msg).then(resp => config.debug(resp[0].statusCode,
    resp[0].statusMessage));
};

module.exports = config;
