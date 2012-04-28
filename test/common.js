var driver = exports.driver = process.env['DB_DRIVER'] || 'mysql';

var conf = exports.conf = {
  mysql: {
    driver: 'mysql',
    host: '127.0.0.1',
    user: 'root',
    database: 'myapp_test'
  },
  sqlite: {
    driver: 'sqlite',
    database: 'test.db'
  }
}[driver];

exports.prepareTesting = function (client, callback) {
  callback = callback || function () {};
  if (conf.driver === 'mysql') {
    client.query("DROP DATABASE IF EXISTS " + conf.database);
    client.query("CREATE DATABASE IF NOT EXISTS " + conf.database);
    client.query("USE "+ conf.database, callback);
  }
};
