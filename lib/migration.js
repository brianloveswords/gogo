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

  var migrators = {
    getCreateTableSql: function getCreateTableSql (callback) {
      var qs = 'show create table ' + _.backtick(this.prototype.table);
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
          _.backtick(this.prototype.table),
          sql
        ]);
      }.bind(this));
    },

    addColumn: function addColumn (spec, callback) {
      var statements = this.getAlterSql(spec, 'add');
      var client = this.client;
      if (callback) callback = _.after(statements.length, callback || NOOP);
      _.each(statements, function (query) { client.query(query, callback); });
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
          _.backtick(this.prototype.table),
          _.upcase('change column'),
          qOld,
          newStatement
        ]);
        this.client.query(qs, callback);
      });
    },

    executeSql: function executeSql (sql, callback) {
      this.client.query(sql, callback);
    },
  };
  
  return function MigrationRunner (migrations) {
    if (!this.prototype.table)
      throw new Error("Model must have a table set before migrating");
    
    var client = this.client;
    
    // create a new model constructor with additional migration
    // helpers attached
    var helpers = _.extend(Object.create(this, {}), migrators);
    _.extend(helpers, {
      client: Object.create(client, {})
    })
    
    // if we don't need to run a migration, return the model+helpers
    if (!migrations) return helpers;
    
    var QueryRunner = new (require('events').EventEmitter);
    QueryRunner.queue = [];
    QueryRunner.enqueue = function enqueue (args) {
      this.queue.push([].slice.call(args));
      return this;
    };
    QueryRunner.dequeue = function dequeue (args) {
      return this.queue.shift();
    };
    
    QueryRunner.flush = function flush () {
      var args = this.dequeue();
      // #XXX: this might be fragile -- it works because all of the method
      //   signatures for the migration helper methods expect a callback
      //   as the last parameter, so we always have one extra 'undefined'
      //   element in the arguments array.
      args[args.length-1] = this.checkDone.bind(this);
      return client.query.apply(client, args);
    };

    // emit a `done` event when the queue is empty or if there's been
    // some sort of error. otherwise, continue flushing the queue.
    QueryRunner.checkDone = function checkDone (err, result) {
      if (err) return QueryRunner.emit('done', err);
      if (!this.queue.length) return QueryRunner.emit('done')
      return QueryRunner.flush();
    }
    
    // override the `query` method for the migration helpers with a version
    // that queues the intended query and immediately moves on. in a migration
    // we want to handle the queries in parallel.
    helpers.client.query = function query () {
      // passthrough any query with an existing callback -- these will
      // likely be internally used queries.
      var cb = arguments[arguments.length-1];
      if (typeof cb == 'function')
        return client.query.apply(client, arguments);
      return QueryRunner.enqueue(arguments);
    };
    
    // we need to be able to look up migrations by their numeric identifier
    // without concerning ourselves with the description.
    function lookup (version) {
      var regex = RegExp('^' + version + ':?.*$');
      for (var m in migrations) {
        if (migrations.hasOwnProperty(m) && m.match(regex))
          return migrations[m];
      }
      return null;
    }

    // we also need to be able to find the previous version of the schema
    // (going by the defined migrations) so we we can set it back if we
    // run a `down` migration.
    function previous (version) {
      var cmp = function (a, b) {
        return parseInt(a, 10) > parseInt(b, 10);
      };
      var regex = RegExp('^(' + version + '):?.*$');
      var keys = _.keys(migrations).sort(cmp);
      for (var i = 0, found; i < keys.length; i++) {
        if (keys[i].match(regex)) {
          found = keys[i-1];
          break;
        }
      }
      return found || '0000';
    }
    
    // because we've overriden the helper's `query` method, we can be
    // reasonably sure that all of the migration `up` and `down` methods
    // will be syncronous.
    // #TODO: allow for user-specified asynchronous migrations with something
    //   like `t.begin()` and `t.done()`
    function runMigration (direction) {
      return function (version, callback) {
        // #TODO: if an error occurs here, report that it originated in
        //   searching for the previous schema version
        
        var migration = lookup(version);
        migration[direction](helpers);
        
        // make sure to update the schema version before calling back
        QueryRunner.once('done', function (err) {
          var ver = (direction === 'up') ? version : previous(version);
          if (err) return callback(err);
          this.updateSchemaVersion(ver, callback);
        }.bind(this));
        
        QueryRunner.flush();
      }
    }
    return _.extend(Object.create(this, {}), {
      up: runMigration('up'),
      down: runMigration('down')
    })
    console.dir(migrations);
  };
};
