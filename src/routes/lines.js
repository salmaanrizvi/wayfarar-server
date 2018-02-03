const moment = require('moment');
const config = require(__basedir + '/config');
const { Train } = require(__basedir + '/models');

const ERRORS = {
  lineRequired: 'Line is required.',
  internalServer: 'Internal server error.',
  unsupported: 'Endpoint is not supported'
};

const getLines = (req, res) => {
  const line = req.query.line;
  if (!line) return res.status(404).send(ERRORS.lineRequired);

  // only find trains updated within the last minute
  const oneMinuteAgo = moment().unix() - 120;
  Train.find({ route: line.toUpperCase(), lastUpdated: { $gt: oneMinuteAgo } }).exec((err, results) => {
    if (err) {
      config.error('Error querying for lines', err);
      return res.status(500).send({ e: err, message: ERRORS.internalServer });
    }
    return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(results);
  });
};


const getRawLines = (req, res) => {
  const line = req.query.line;
  if (!line) return res.status(404).send(ERRORS.lineRequired);
  return res.status(404).send(ERRORS.unsupported);
  // load(line, false, (err, feed) => {
  //   if (err) {
  //     config.debug('error loading the line', err);
  //     return res.status(404).send(err);
  //   }

  //   return res.set({ 'Content-Type': 'application/json; charset=utf-8' })
  //     .status(200)
  //     .send(JSON.stringify(feed, null, 2));
  // });
}

module.exports = { getLines, getRawLines };