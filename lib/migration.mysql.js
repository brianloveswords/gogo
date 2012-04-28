var _ = require('./ext-underscore');

function parseSpecification(spec) {
  var result = {};
  _.each(spec, function (value, key) {
    if (_.isString(value))
      return result[key] = _.extend({}, { sql: value });

    if (_.isObject(value))
      return result[key] = _.extend({}, value);

    if (_.isFunction(value)) {
      var completed = _.isFunction(value())
        ? value()(key)
        : value(key);
      return result[key] = completed;
    }
  });
  return result;
}

function alterStatement(spec, method) {
  var statements = parseSpecification(spec);
  var values = _.values(statements).pop();
  var keysql = values.keysql;
  var column = _.keys(statements).pop();
  var altersql = _.strjoin(
    _.upcase(method),
    _.backtick(column),
    values.sql
  );
  var alterStatements = [altersql];
  if (keysql) alterStatements.push(_.strjoin('ADD', keysql));
  return alterStatements;
}

function dropStatement(column) {
  return _.strjoin(_.upcase('drop column'), _.backtick(column));
}

function engineStatement(engine) {
  return _.strjoin(_.upcase('engine ='), engine);
}

function addKeyStatement(opt) {
  var column = _.keys(opt).pop();
  var keyopt = _.values(opt).pop();
  var type = keyopt['type'];
  var length = keyopt['length'];
  var name = keyopt['name'];

  return _.strjoin(
    _.upcase('add'),
    _.upcase(type),
    _.upcase('key'),
    _.backtick(column),
    _.paren(_.strjoin(
      _.backtick(name || column),
      _.paren(length)
    ))
  );
}

var sqlGenerator = {
  change: alterStatement,
  add: alterStatement,
  drop: dropStatement,
  engine: engineStatement,
  'add key': addKeyStatement
};

// This object isn't meant to be used directly -- it's for extending a
// model to create a migration-capable model.
var migrationCapability = {
  getAlterSql: function getAlterSql(spec, method) {
    var sql = sqlGenerator[method](spec, method);
    var statements = _.arrayify(sql);
    return _.map(statements, function (sql) {
      return _.strjoin([
        _.upcase('alter table'),
        _.backtick(this.prototype.table),
        sql
      ]);
    }.bind(this));
  },

  addColumn: function addColumn(spec, callback) {
    var statements = this.getAlterSql(spec, 'add');
    var execute = this.execute.bind(this);
    if (callback) callback = _.after(statements.length, callback);
    _.each(statements, function (query) { execute(query, callback) });
  },

  dropColumn: function dropColumn(spec, callback) {
    var statement = this.getAlterSql(spec, 'drop').pop();
    this.execute(statement, callback);
  },

  getCreateTableSql: function getCreateTableSql(callback) {
    var querystring = 'show create table ' + _.backtick(this.prototype.table);
    this.execute(querystring, function (err, result) {
      if (err) return callback(err);
      var sql = result[0]['Create Table'];
      callback(null, sql);
    });
  },

  renameColumn: function renameColumn(oldName, newName, callback) {
    var qOldName = _.backtick(oldName);
    var qNewName = _.backtick(newName);
    this.getCreateTableSql(function (err, sql) {
      if (err) return callback(err);
      var re = new RegExp(_.paren(qOldName + '.*?') + '\\n');
      var oldStatement = re.exec(sql)[0].replace(/,\s$/, '');
      var newStatement = oldStatement.replace(qOldName, qNewName);
      var querystring = _.strjoin([
        _.upcase('alter table'),
        _.backtick(this.prototype.table),
        _.upcase('change column'),
        qOldName,
        newStatement
      ]);
      
      this.execute(querystring, callback);
    }.bind(this));
  },

  execute: function execute(sql, callback) {
    this.client.query(sql, callback.bind(this));
  }
};

// Aliases
migrationCapability.removeColumn = migrationCapability.dropColumn;
migrationCapability.executeSql = migrationCapability.execute;

module.exports = migrationCapability;