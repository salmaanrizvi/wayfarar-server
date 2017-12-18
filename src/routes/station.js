const config = require(__basedir + '/config');

const ERRORS = {
  stopIdOrNameReq: 'Stop ID or station name is required.'
};

// /stations?stop_id= or /stations?stop_name= 
const getStations = (req, res) => {
  res.set({ 'Content-Type': 'application/json; charset=utf-8' }).status(200);

  const { stop_id, stop_name } = req.query;
  if (!stop_id && !stop_name) {
    return res.status(400).send(ERRORS.stopIdOrNameReq);
    // return res.send(`Station Count: ${ Object.keys(stations).length }\n` + JSON.stringify(stations, null, 2));
  }

  let search = {};
  if (stop_id) search.stop_id = stop_id;
  if (stop_name) search = Object.assign(search, { $text: { $search: stop_name } });

  config.debug(search);
  config.db.stations.find(search).toArray((err, response) => {
    config.debug(err, response.length);
    return res.send(JSON.stringify(response, null, 2));
  });
};

module.exports = { getStations };
