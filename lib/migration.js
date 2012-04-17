// #TODO: use show create table to make diffs, which will auto-generate migrations.

var _ = require('./ext-underscore');
var compose = require('functools').compose;

module.exports = function (client) {
  function parseSpecification (spec) {
    var result = {};
    _.each(spec, function (value, key) {
      if (_.isString(value))
        return result[key] = _.extend({}, { sql: value });

      if (_.isObject(value))
        return result[key] = _.extend({}, value);

      if (_.isFunction(value)) {
        var completed = _.isFunction(value()) ? value()(key) : value(key);
        return result[key] = completed;
      }
    });
    return result;
  }

  var Migration = function BaseMigration (Model) {
    if (!(this instanceof arguments.callee))
      return new arguments.callee(Model||this);

    if (!Model) {
      if (this.prototype.table) Model = this;
      else throw new Error("Migration must be called either on a model "+
                           "(e.g., `User.Migration(...)`) or with a model "+
                           "(e.g., Hyde.Migration(User))");
    }

    return _.extend(this, {
      model: Model,
      table: Model.prototype.table,
      client: Model.client
    });
  };

  var sqlgen = {};

  sqlgen['change'] = sqlgen['add'] = function (spec, method) {
    var statements = parseSpecification(spec);
    var values = _.values(statements).pop();
    var keysql = values.keysql;
    var column = _.keys(statements).pop();
    var results = [
      _.strjoin(
        _.upcase(method),
        _.backtick(column),
        values.sql
      )];
    if (keysql) results.push(_.strjoin(['ADD', keysql]));
    return results;
  };

  sqlgen['drop'] = function (column) {
    return _.strjoin( _.upcase('drop column'), _.backtick(column) );
  };

  sqlgen['engine'] = function (engine) {
    return _.strjoin( _.upcase('engine ='), engine );
  };

  sqlgen['add key'] = function (opt) {
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
        _.backtick(name||column),
        _.paren(length)
      ))
    );
  };

  _.extend(Migration.prototype, {
    getCreateTableSql: function getCreateTableSql (callback) {
      var qs = 'show create table ' + _.backtick(this.table);
      callback = callback.bind(this);
      this.client.query(qs, function (err, result) {
        if (err) return callback(err);
        var sql = result[0]['Create Table'];
        callback(null, sql);
      });
    },

    getAlterSql: function getAlterSql (spec, method) {
      function arrayify (o) { return _.isArray(o) ? o : [o]; }
      var statements = arrayify(sqlgen[method](spec, method));
      return _.map(statements, function (sql) {
        return _.strjoin([
          _.upcase('alter table'),
          _.backtick(this.table),
          sql
        ]);
      }.bind(this));
    },

    addColumn: function addColumn (spec, callback) {
      function runner (query) { this.client.query(query, callback); }
      var statements = this.getAlterSql(spec, 'add');
      callback = _.after(statements.length, callback);
      _.each(statements, runner.bind(this));
    },

    dropColumn: function dropColumn (spec, callback) {
      var statement = this.getAlterSql(spec, 'drop').pop();
      this.client.query(statement, callback);
    },

    renameColumn: function renameColumn (oldName, newName, callback) {
      this.getCreateTableSql(function (err, sql) {
        var qOld = _.backtick(oldName);
        var qNew = _.backtick(newName);
        var re = new RegExp(_.paren(qOld + '.*?') + '\\n');
        var oldStatement = re.exec(sql)[0].replace(/,\s$/, '');
        var newStatement = oldStatement.replace(qOld, qNew);

        var qs = _.strjoin([
          _.upcase('alter table'),
          _.backtick(this.table),
          _.upcase('change column'),
          qOld,
          newStatement
        ]);
        this.client.query(qs, callback);
      });
    },

    executeSql: function executeSql () {
      this.client.query.apply(this.client, arguments);
    }
  });

  return Migration;
};
