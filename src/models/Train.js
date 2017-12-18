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

TrainSchema.statics.removeOldTrains = function() {
  return new Promise((resolve, reject) => {
    const twoHoursAgo = moment().unix() - hoursToSeconds(5);
    this.remove({}).where('lastUpdated').lt(twoHoursAgo).exec((err, response) => {
      if (err) {
        config.error('Error removing old trains', err);
        return reject(err);
      }
      config.debug('Removed', response.result.n, 'trains');
      return resolve(response.result);
    });
  });
};

module.exports = TrainSchema;
