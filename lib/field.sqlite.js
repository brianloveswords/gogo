// base it off mysql
var Field = require('./field.mysql.js');
var Validators = require('./validators.js');

Field.Id = function idFieldFactory() {
  return function idField(field) {
    return {
      sql: 'INTEGER PRIMARY KEY',
      validators: [ Validators.Type.Number ],
      keysql: ''
    };
  };
};

module.exports = Field;