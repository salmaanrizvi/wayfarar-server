const config = require(__basedir + '/config');

const ERRORS = {
  stopIdOrNameReq: 'Stop ID or station name is required.',
  internalServer: 'Internal server error.'
};

// /stations?stop_id= or /stations?stop_name= 
const getStations = (req, res) => {
  const terms = Object.keys(req.query).reduce((search, key) => {
    return search += ' ' + req.query[key];
  }, '');

  const search = { $text: { $search: terms } };
  const score = { score: { $meta: "textScore" } };

  config.db.stations.find(search, score).sort(score).toArray((err, response) => {
    if (err) {
      config.error(err);
      return res.status(500).send(ERRORS.internalServer);
    }
    return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(JSON.stringify(response, null, 2));
  });
};

module.exports = { getStations };
