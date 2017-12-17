const config = require('./config.js');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schemas = {
  station: new Schema({
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
    stop_name: String,
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
  { 
    timestamps: true
  }),

  train: new Schema({
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
  { 
    timestamps: true
  })
};

const models = {
  Station: mongoose.model('Station', schemas.station),
  Train: mongoose.model('Train', schemas.train)
};

models.createTextIndexes = (collection, cb) => {
  collection.createIndex({ stop_name: 'text' }, (err, response) => {
    console.log(err, response);
    cb(err, response);
  });
};

models.create2dSphereIndex = (collection, callback) => {
  // Create the index
  collection.createIndex({ 'location.coordinates': '2dsphere' }, (err, result) => {
    console.log(result);
    callback(result);
  });
};

models.save = (records, Model, match) => {
  match = match || 'id';
  return new Promise(function(resolve, reject) {
    if (!records.length) {
      config.debug('returning early from save');
      return resolve({});
    }

    const bulk = Model.collection.initializeUnorderedBulkOp();

    records.forEach(function(record) {
      const query = { [match]: record[match] };
      bulk.find(query).upsert().updateOne(record);
    });

    bulk.execute(function(err, bulkres) {
      if (err) return reject(err);
      resolve(bulkres);
    });
  });
};

module.exports = models;
