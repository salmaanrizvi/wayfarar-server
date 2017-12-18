const config = require(__basedir + '/config');
const mongoose = require('mongoose');
const StationSchema = require('./Station.js');
const TrainSchema = require('./Train.js');

const models = {};

const schemas = {
  StationSchema,
  TrainSchema
};

models.createTextIndexes = (collection, cb) => {
  collection.createIndex({ stop_name: 'text' }, (err, response) => {
    config.debug(err, response);
    cb(err, response);
  });
};

models.create2dSphereIndex = (collection, cb) => {
  // Create the index
  collection.createIndex({ 'location.coordinates': '2dsphere' }, (err, response) => {
    config.debug(response);
    cb(err, response);
  });
};

models.bulkSave = function(records, match = 'id') {
  return new Promise((resolve, reject) => {

    if (!records || !records.length) {
      config.debug('returning early from save');
      return resolve({});
    }

    const bulk = this.collection.initializeUnorderedBulkOp();

    records.forEach(function(record) {
      const query = { [match]: record[match] };
      bulk.find(query).upsert().updateOne(record);
    });

    bulk.execute(function(err, bulkres) {
      if (err) return reject(err);
      return resolve(bulkres);
    });
  });
};

models.removeAll = function() {
  return new Promise((resolve, reject) => {
    this.collection.remove({}, function(err, response) {
      if (err) return reject(err);
      config.debug('Removed', response.result.n, 'from', this.collection.name);
      return resolve(response.result);
    });
  });
};

const addGlobalStatics = () => {
  Object.keys(schemas).forEach(key => {
    schemas[key].statics = Object.assign({}, schemas[key].statics, {
      bulkSave: models.bulkSave,
      removeAll: models.removeAll
    });
  });
};

addGlobalStatics();

models.Station = mongoose.model('Station', StationSchema);
models.Train = mongoose.model('Train', TrainSchema);

module.exports = models;
