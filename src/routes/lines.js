const config = require(__basedir + '/config');

const ERRORS = {
  lineRequired: 'Line is required.'
};

const getLines = (req, res) => {
  const line = req.query.line;
  if (!line) return res.status(404).send(ERRORS.lineRequired);

  // load(line, true, (err, feed) => {
  //   if (err) {
  //     config.debug('error loading the line', err);
  //     return res.status(404).send(err);
  //   }

  //   return res.set({ 'Content-Type': 'application/json; charset=utf-8' })
  //     .status(200)
  //     .send(JSON.stringify(feed, null, 2));
  // });
};


const getRawLines = (req, res) => {
  const line = req.query.line;
  if (!line) return res.status(404).send(ERRORS.lineRequired);

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