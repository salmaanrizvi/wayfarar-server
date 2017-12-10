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
    //location: {
    //   type: "Point",
    //   coordinates: [-73.856077, 40.848447],
    //   index: '2d'
    // }
    stop_lat: Number,
    stop_lon: Number,
    entrances: [{
      latitude: Number,
      longitude: Number,
      corner: String
    }],
    lastUpdated: Number
  }),

  train: new Schema({
    stops: [{
      station_id: String,
      station_name: String,
      arrivalTime: Number,
      arrives: String,
      departs: Number
    }],
    current_status: String,
    timestamp: String,
    current_stop_seq: Number,
    direction: String,
    route: String
  })
};

const models = {
  Station: mongoose.model('Station', schemas.station),
  Train: mongoose.model('Train', schemas.train)
}

module.exports = models;
