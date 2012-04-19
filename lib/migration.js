// #TODO: use show create table to make diffs, which will auto-generate migrations.
// #TODO: allow for user-specified asynchronous migrations with something
// like `t.begin()` and `t.done()`

var _ = require('./ext-underscore');
var EventEmitter = require('events').EventEmitter;
var fmap = require('functools').map;

module.exports = function (client) {
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
    expect: function () {
      
    },
    
    getCreateTableSql: function getCreateTableSql(callback) {
      var qs = 'show create table ' + _.backtick(this.prototype.table);
      callback = callback.bind(this);
      this.client.query(qs, function (err, result) {
        if (err) return callback(err);
        var sql = result[0]['Create Table'];
        callback(null, sql);
      });
    },

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
      var client = this.client;
      if (callback) callback = _.after(statements.length, callback);
      _.each(statements, function (query) { client.query(query, callback) });
    },

    dropColumn: function dropColumn(spec, callback) {
      var statement = this.getAlterSql(spec, 'drop').pop();
      this.client.query(statement, callback);
    },

    renameColumn: function renameColumn(oldName, newName, callback) {
      var qOldName = _.backtick(oldName);
      var qNewName = _.backtick(newName);
      this.getCreateTableSql(function (err, sql) {
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
        
        this.client.query(querystring, callback);
      });
    },

    executeSql: function executeSql(sql, callback) {
      this._expect += 1;
      this.client.query(sql, callback);
    }
  };

  // Aliases
  migrationCapability.removeColumn = migrationCapability.dropColumn;
  migrationCapability.execute = migrationCapability.executeSql;

  return function MigrationRunner(migrations) {
    // Something's wrong if the prototype doesn't have a table set.
    if (!this.prototype.table)
      throw new Error("Model must have a table set before migrating");

    // Store a reference to the original
    var originalClient = this.client;

    // Create a new model constructor with additional migration
    // helpers attached.
    var helpers = _.extend(Object.create(this, {}), migrationCapability);

    _.extend(helpers, { client: Object.create(originalClient, {}) });

    // If we don't need to run a migration, return the model+helpers.
    if (!migrations) return helpers;

    var QueryRunner = _.extend(new EventEmitter(), {
      // Setup the container to hold queries and some shortcuts for adding
      // things to the end of the queue and pulling off the head item.
      queue: [],
      enqueue: function enqueue(args) {
        this.queue.push([].slice.call(args));
        return this;
      },
      dequeue: function dequeue(args) {
        return this.queue.shift();
      },

      // Process a query from the queue. Replaces the last argument (presumed)
      // to be the callback) with `checkDone()`, which either calls `flush`
      // again or emits the `done` event if the queue is empty or an error
      // has occured.
      //   #XXX: this might be fragile -- it works because all of the method
      //   signatures for the migration helper methods expect a callback
      //   as the last parameter, so we always have one extra 'undefined'
      //   element in the arguments array.
      flush: function flush() {
        var args = this.dequeue();
        args[args.length - 1] = this.checkDone.bind(this);
        return originalClient.query.apply(originalClient, args);
      },
      checkDone: function checkDone(err, result) {
        if (err) return QueryRunner.emit('done', err);
        if (!this.queue.length) return QueryRunner.emit('done');
        return QueryRunner.flush();
      }
    });

    // Override the `query` method for the migration helpers with a version
    // that queues the intended query and immediately moves on. in a migration
    // we want to handle the queries in parallel.
    helpers.client.query = function query() {
      // passthrough any query with an existing callback -- these will
      // likely be internally used queries.
      var cb = arguments[arguments.length - 1];
      if (typeof cb == 'function')
        return originalClient.query.apply(originalClient, arguments);
      return QueryRunner.enqueue(arguments);
    };

    // We need to be able to look up migrations by their numeric identifier
    // without concerning ourselves with the description.
    function lookup(version, migrations) {
      var regex = RegExp('^' + version + '.*$');
      for (var m in migrations)
        if (migrations.hasOwnProperty(m) && m.match(regex)) return m;
      return null;
    }

    // We also need to be able to find the previous version of the schema
    // (going by the defined migrations) so we we can set it back if we
    // run a `down` migration.
    function previous(version, migrations) {
      function cmp(a, b) { return parseInt(a, 10) > parseInt(b, 10); }
      var regex = RegExp('^(' + version + '):?.*$');
      var keys = _.keys(migrations).sort(cmp);
      for (var i = 0, found; i < keys.length; i++) {
        if (keys[i].match(regex)) {
          found = keys[i - 1];
          break;
        }
      }
      return found || '0000';
    }

    // Factory for generating the up/down runners. `up` will update the schema
    // table with its own version, `down` will update it with either the
    // previous version in the migration definition (by numeric comparison).
    function runMigration(direction, migrations) {
      return function (version, callback) {
        QueryRunner.once('done', function (err) {
          // #TODO: pass back an error saying
          // - the version of the migration
          // - what went wrong
          // - exactly which query failed?
          if (err) return callback(err);
          var ver = (direction === 'up')
            ? key
            : previous(version, migrations);
          this.updateSchemaVersion(ver, callback);
        }.bind(this));

        var key = lookup(version, migrations);

        if (!key) {
          var error = new Error('Could not find migration with the following lookup parameter: ' + _.quote(version));
          error.name = 'MigrationNotFound';
          return callback(error);
        }

        migrations[key][direction](helpers);
        QueryRunner.flush();
      };
    }

    return _.extend(Object.create(this, {}), {
      _migrations: migrations,
      
      up: runMigration('up', migrations),
      
      down: runMigration('down', migrations),
      
      runBatch: function runBatch(callback) {
        function cmp(a, b) { return parseInt(a, 10) > parseInt(b, 10); }
        
        // get all of the sorted migration names
        var migrationKeys = _.keys(this._migrations).sort(cmp);
        
        // get the current version of the schema
        this.getSchemaVersion(function (err, version) {
          if (err) return callback(err);
          
          // filter out the migrations lower than or equal to the current version
          var unmigratedKeys = _.filter(migrationKeys, function (k) {
            return cmp(k, version);
          });
          
          // run all of the unrun migrations
          fmap.async(this.up.bind(this), unmigratedKeys, function (err, results) {
            if (err) return callback(err);
            callback(null, results);
          });
        }.bind(this));
      }
    });
  };
};
