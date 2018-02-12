const moment = require('moment');
const config = require(__basedir + '/config');
const { Train } = require(__basedir + '/models');
const Trip = require(__basedir + '/trip.js');
const { minsToSeconds, linesToRouteIds } = require(__basedir + '/utils.js');

const ERRORS = {
  lineRequired: 'Line is required.',
  internalServer: 'Internal server error.',
  unsupported: 'Endpoint is not supported'
};

const getLines = (req, res) => {
  let line = req.query.line;
  if (!line) return res.status(404).send(ERRORS.lineRequired);

  if (linesToRouteIds[line]) line = linesToRouteIds[line];
  // only find trains updated within the last 5 minutes
  const fourMinutesAgo = moment().unix() - minsToSeconds(5);

  Train.find({ route: line.toUpperCase(), lastUpdated: { $gt: fourMinutesAgo } }).sort('-lastUpdated').exec((err, results) => {
    if (err) {
      config.error('Error querying for lines', err);
      return res.status(500).send({ e: err, message: ERRORS.internalServer });
    }
    return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(JSON.stringify(results, null, 2));
  });
};


const getRawLines = (req, res) => {
  const line = req.query.line;
  if (!line) return res.status(404).send(ERRORS.lineRequired);
  // return res.status(404).send(ERRORS.unsupported);
  Trip.load({ line, parse: false }, (err, feed) => {
    if (err) {
      config.debug('error loading the line', err);
      return res.status(404).send(err);
    }

    return res.set({ 'Content-Type': 'application/json; charset=utf-8' })
      .status(200)
      .send(JSON.stringify(feed, null, 2));
  });
}

module.exports = { getLines, getRawLines };
