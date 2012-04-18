// #TODO: clean up the Base.Schema methods
var supported = {
  mysql: function (conf) {
    var mysql = require('mysql');
    var client = mysql.createClient(conf);
    return require('./ext-mysql-client.js')(client);
  }
};

function Gogo (conf) {
  if (conf) Gogo.initialize(conf);
  return Gogo;
}
Gogo.Validators = require('./validators.js');
Gogo.Schema = require('./schema.js');
Gogo.Base = require('./base.js');

Gogo.initialize = function (conf) {
  var client = supported[conf.driver](conf);
  
  Gogo.DRIVER = Gogo.Base.prototype.driver = conf.driver;
  
  Gogo.Migration = Gogo.Base.Migration = require('./migration.js')(client);
  
  Gogo.client = Gogo.Base.client = Gogo.Base.prototype.client = client;
};
module.exports = Gogo;