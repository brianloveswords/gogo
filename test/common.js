var conf = exports.conf = {
  driver: 'mysql',
  host: '127.0.0.1',
  user: 'root',
  database: 'myapp_test'
};
exports.prepareTesting = function (client, callback) {
  client.query("DROP DATABASE IF EXISTS " + conf.database);
  client.query("CREATE DATABASE IF NOT EXISTS " + conf.database);
  client.query("USE "+ conf.database, callback);
};
