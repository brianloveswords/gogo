// #TODO: use show create table to make diffs, which will auto-generate migrations.
// #TODO: allow for user-specified asynchronous migrations with something
// like `t.begin()` and `t.done()`

var util = require('util');
var _ = require('./ext-underscore');
var EventEmitter = require('events').EventEmitter;
var fmap = require('functools').map;

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

module.exports = function (client) {
  var migrationCapability = require(util.format('./migration.%s.js', client.driver));
  
  return function MigrationRunner(migrations) {
    // Something's wrong if the prototype doesn't have a table set.
    if (!this.prototype.table)
      throw new Error("Model must have a table set before migrating");

    // Store a reference to the original
    var runQuery = this.client.query.bind(this.client);

    // Create a new model constructor with additional migration
    // helpers attached.
    var helpers = _.extend(Object.create(this, {}), migrationCapability);

    // If we don't need to run a migration, return the model+helpers.
    if (!migrations) return helpers;

    var QueryRunner = _.extend(new EventEmitter(), {
      // Setup the container to hold queries and some shortcuts for adding
      // things to the end of the queue and pulling off the head item.
      queue: [],
      expecting: 0,
      enqueue: function enqueue(args) {
        this.emit('enqueue');
        this.queue.push([].slice.call(args));
        return this;
      },
      dequeue: function dequeue(args) {
        this.emit('enqueue');
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
        var sql = args[0];
        var callback = args[1];
        // when there's no callback, this is a standard, one-query migration
        // command (addColumn, dropColumn)
        if (!callback)
          runQuery.call(null, sql, this.checkDone.bind(this));
        
        // if it's a complex query, flush again after hitting the callback
        // because there's a likely chance it queued up another query.
        else {
          runQuery.call(null, sql, function (err, result) {
            callback(err, result);
            this.flush();
          }.bind(this));
        }
      },
      
      checkDone: function checkDone(err, result) {
        if (err) return QueryRunner.emit('done', err);
        if (!this.queue.length) return QueryRunner.emit('done');
        return QueryRunner.flush();
      }
    });
    
    // Factory for generating the up/down runners. `up` will update the schema
    // table with its own version, `down` will update it with either the
    // previous version in the migration definition (by numeric comparison).
    function runnerFactory(direction, migrations) {
      // Override the `execute` method for the migration helpers with a version
      // that queues the intended query and immediately moves on. in a migration
      // we want to handle the queries in parallel.
      helpers.execute = function execute(sql, callback) {
        function cb(callback) {
          QueryRunner.expecting--;
          return callback;
        }
        QueryRunner.expecting++;
        return QueryRunner.enqueue([sql, cb(callback)]);
      };

      return function runMigration(version, callback) {
        var key = lookup(version, migrations);

        if (!key) {
          var error = new Error('Could not find migration with the following lookup parameter: ' + _.quote(version));
          error.name = 'MigrationNotFound';
          return callback(error);
        }
        
        migrations[key][direction].bind(helpers)(helpers);
        QueryRunner.flush();
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

      };
    }

    return _.extend(Object.create(this, {}), {
      _migrations: migrations,
      
      up: runnerFactory('up', migrations),
      
      down: runnerFactory('down', migrations),
      
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
