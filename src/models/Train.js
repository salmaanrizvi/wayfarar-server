const config = require(__basedir + '/config');
const { minsToSeconds } = require(__basedir + '/utils.js');
const moment = require('moment');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TrainSchema = new Schema({
  train_id: {
    type: String,
    unique: true,
    index: true
  },
  stops: [{
    station_id: String,
    station_name: String,
    arrivalTime: Number
  }],
  current_status: String,
  timestamp: String,
  direction: String,
  route: String,
  towards: String,
  alerts: [{
    cause: String,
    effect: String,
    text: String
  }],
  lastUpdated: Number,
},
{ timestamps: true });

const removeOldTrains = function() {
  return new Promise((resolve, reject) => {
    const oneHourAgo = moment().unix() - minsToSeconds(60);
    config.db.trains.remove({ lastUpdated: { $lt: oneHourAgo }}, (err, response) => {
      if (err) {
        config.error('Error removing old trains', err);
        return reject(err);
      }
      config.debug('Removed', response.result.n, 'trains');
      return resolve(response.result);
    });
  });
};

TrainSchema.statics = Object.assign({}, TrainSchema.statics, { removeOldTrains });
module.exports = TrainSchema;
