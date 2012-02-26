var conf = exports.conf = {
  driver: 'mysql',
  host: '127.0.0.1',
  user: 'test_hyde',
  database: 'test_hyde'
};
exports.prepareTesting = function (client, callback) {
  client.query("DROP DATABASE IF EXISTS " + conf.database);
  client.query("CREATE DATABASE IF NOT EXISTS " + conf.database);
  client.query("USE "+ conf.database, callback);
};
