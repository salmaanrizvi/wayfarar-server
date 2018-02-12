const config = require(__basedir + '/config');
const { Station } = require(__basedir + '/models');

const ERRORS = {
  stopIdOrNameReq: 'Stop ID or station name is required.',
  internalServer: 'Internal server error.'
};

// /stations?stop_id= or /stations?stop_name= 
const getStations = (req, res) => {
  Station.find(req.query).exec((err, response) => {
    if (err) {
      config.error(err);
      return res.status(500).send(ERRORS.internalServer);
    }
    return res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200).send(JSON.stringify(response, null, 2));
  });
};

module.exports = { getStations };
