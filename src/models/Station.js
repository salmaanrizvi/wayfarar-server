const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const config = require(__basedir + '/config');

const StationSchema = new Schema({
  stop_id: {
    type: String,
    unique: true,
    index: true,
  },
  trains: {
    N: [String],
    S: [String]
  },
  station_id: String,
  complex_id: String,
  division: String,
  line: String,
  stop_name: {
    type: String,
    index: true
  },
  borough: String,
  daytime_routes: [String],
  structure: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  stop_lat: Number,
  stop_lon: Number,
  entrances: [{
    latitude: Number,
    longitude: Number,
    corner: String
  }],
  lastUpdated: Number
},
{ timestamps: true });

StationSchema.index({ "$**": 'text' });

StationSchema.statics.saveAll = function(stations) {
  const stationRecords = Object.keys(stations).map(stop_id => stations[stop_id]);
  return this.bulkSave(stationRecords, 'stop_id').then(response => {
    const { ok, nInserted, nUpserted, nMatched, nModified, nRemoved } = response;
    config.debug('Station save - ok', ok, 'nInserted', nInserted, 'nUpserted', nUpserted, 'nMatched', nMatched, 'nModified', nModified,'nRemoved', nRemoved);
  });
};

StationSchema.statics.findNear = function({ coordinates, maxDistance }) {
  return new Promise((resolve, reject) => {
    const near = {
      'location.coordinates': { 
        $near: {
          $geometry: {
            type: "Point",
            coordinates: coordinates
          },
          $maxDistance: maxDistance
        }
      }
    };

    config.db.stations.find(near).toArray((err, stations) => {
      if (err) {
        config.error('Error', err);
        return reject(err);
      }
      config.debug("Found the following records", stations.length);
      return resolve(stations);
    });
  });
};

module.exports = StationSchema;