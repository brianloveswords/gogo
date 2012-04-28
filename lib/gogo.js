var supported = {
  mysql: function (conf) {
    var mysql = require('mysql');
    var client = mysql.createClient(conf);
    return require('./ext-mysql-client.js')(client);
  },
  sqlite: function (conf) {
    var sqlite3 = require('sqlite3').verbose();
    sqlite3.Database.prototype.query = function (sql, parameters, callback) {
      if (typeof parameters === 'function') {
        callback = parameters;
        parameters = undefined;
      }
      callback = callback || function () {};
      
      return this.serialize(function () {
        if (!sql.match(/^(insert|update)/i))
          return this.all(sql, parameters, callback);
        
        return this.run(sql, parameters, function (err) {
          if (err) callback(err);
          return callback(null, { insertId: this.lastID });
        })
      }.bind(this));
    };
    var client = new sqlite3.Database(conf.database);
    return require('./ext-mysql-client.js')(client);
  }
};

function Gogo(conf) {
  if (conf) Gogo.initialize(conf);
  return Gogo;
}
Gogo.Validator = require('./validators.js');
Gogo.Base = require('./base.js');
Gogo.initialize = function (conf) {
  var client = supported[conf.driver](conf);
  client.driver = Gogo.DRIVER = Gogo.Base.prototype.driver = conf.driver;
  Gogo.Field = require('./field.js')(conf.driver);
  Gogo.Base.Migration = require('./migration.js')(client);
  Gogo.client = Gogo.Base.client = Gogo.Base.prototype.client = client;
};
module.exports = Gogo;