// #TODO: use show create table to make diffs, which will auto-generate migrations.

var _ = require('./ext-underscore')
  , compose = require('functools').compose

module.exports = function (client) { 
  var parseSpecification = function (spec) {
    var result = {}
    _.each(spec, function (value, key) {
      if (_.isString(value)) {
        return result[key] = _.extend({}, { sql: value });
      }

      if (_.isObject(value)) {
        return result[key] = _.extend({}, value);
      }

      if (_.isFunction(value)) {
        var completed = _.isFunction(value()) ? value()(key) : value(key);
        return result[key] = completed;
      }
    });
        return result;
  };

  var Migration = function BaseMigration (Model) {
    if (!(this instanceof arguments.callee)) return new arguments.callee(Model||this);
    
    if (!Model) {
      if (this.prototype.table) Model = this; 
      else throw new Error("Migration must be called either on a model "+
                           "(e.g., `User.Migration(...)`) or with a model "+
                           "(e.g., Hyde.Migration(User))")
    }
    
    return _.extend(this, {
      model: Model,
      table: Model.prototype.table,
      client: Model.client
    });
  };

  var sqlgen = {}
  sqlgen['change'] = sqlgen['add'] = function (spec, method) {
    var statements = parseSpecification(spec)
      , values = _.values(statements).pop()
      , keysql = values.keysql
      , column = _.keys(statements).pop()
      , results = [_.strjoin([
        _.upcase(method),
        _.backtick(column),
        values.sql
      ])]
    if (keysql) results.push(_.strjoin(['ADD', keysql]));
    return results;
  };
  sqlgen['drop'] = function (column) {
    return _.strjoin([ _.upcase('drop column'), _.backtick(column) ]);
  };
  sqlgen['engine'] = function (engine) {
    return _.strjoin([ _.upcase('engine ='), engine ]);
  };
  sqlgen['add key'] = function (opt) {
    var column = _.keys(opt).pop()
    , keyopt = _.values(opt).pop()
    , type = keyopt['type']
    , length = keyopt['length']
    , name = keyopt['name']
    return _.strjoin([
      _.upcase('add'),
      _.upcase(type),
      _.upcase('key'),
      _.backtick(column),
      _.paren(_.strjoin([
        _.backtick(name||column),
        _.paren(length)
      ]))
    ]);
  };

  _.extend(Migration.prototype, {
    getCreateTableSql: function (callback) {
      var qs = 'show create table ' + _.backtick(this.table);
      callback = callback.bind(this);
      this.client.query(qs, function (err, result) {
        if (err) return callback(err);
        var sql = result[0]['Create Table'];
        callback(null, sql);
      })
    },
    getAlterSql: function getAlterSql (spec, method) {
      function arrayify (o) { return _.isArray(o) ? o : [o] }
      var statements = arrayify(sqlgen[method](spec, method));
      
      return _.map(statements, function (sql) {
        return _.strjoin([ _.upcase('alter table'), _.backtick(this.table), sql ])
      }.bind(this))
    },

    addColumn: function (spec, callback) {
      var statements = this.getAlterSql(spec, 'add');
      callback = _.after(statements.length, callback);
      function runner (query) { this.client.query(query, callback) }
      _.each(statements, runner.bind(this));
    },
  
    dropColumn: function (spec, callback) {
      var statement = this.getAlterSql(spec, 'drop').pop();
      this.client.query(statement, callback);
    },
  
    renameColumn: function (oldName, newName, callback) {
      this.getCreateTableSql(function (err, sql) {
        var qOld = _.backtick(oldName)
          , qNew = _.backtick(newName)
          , re = new RegExp(_.paren(qOld + '.*?') + '\\n')
          , oldStatement = re.exec(sql)[0].replace(/,\s$/, '')
          , newStatement = oldStatement.replace(qOld, qNew)
          , qs = _.strjoin([
            _.upcase('alter table'),
            _.backtick(this.table),
            _.upcase('change column'),
            qOld,
            newStatement
          ])
        this.client.query(qs, callback);
      })
    },

    executeSql: function () { this.client.query.apply(this.client, arguments); }
  });
  
  return Migration;
};
