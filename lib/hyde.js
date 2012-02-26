// #TODO: change the whole `fieldspec` thing to just operate on the schema in place?
// #TODO: clean up the Base.Schema methods
// #TODO: chainable inserts and updates

var _ = require('underscore')
require('./ext-underscore.js');

const supported = {
  mysql: function (conf) {
    var mysql = require('mysql');
    require('./ext-mysql-client.js');
    return mysql.createClient(conf);
  }
}

var Hyde = function (conf) {
  if (conf) Hyde.initialize(conf);
  return Hyde;
};
Hyde.Validators = require('./validators.js');
Hyde.Schema = require('./schema.js');
Hyde.Base = require('./base.js');
Hyde.initialize = function (conf) {
  var client = supported[conf.driver](conf);
  
  Hyde.DRIVER
    = Hyde.Base.prototype.driver
    = conf.driver;
  
  Hyde.Migration
    = Hyde.Base.Migration
    = require('./migration.js')(client);
  
  Hyde.client
    = Hyde.Base.client
    = Hyde.Base.prototype.client
    = client

}
module.exports = Hyde;