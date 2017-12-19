const config = require(__basedir + '/config');
const { hoursToSeconds } = require(__basedir + '/utils.js');
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
    arrivalTime: Number,
    arrives: Number
  }],
  current_status: String,
  timestamp: String,
  direction: String,
  route: String,
  lastUpdated: Number,
},
{ timestamps: true });

const removeOldTrains = function() {
  return new Promise((resolve, reject) => {
    const fourHoursAgo = moment().unix() - hoursToSeconds(4);
    config.db.trains.remove({ lastUpdated: { $lt: fourHoursAgo }}, (err, response) => {
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
