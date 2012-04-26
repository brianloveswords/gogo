var _ = require('./ext-underscore');
var compose = require('functools').compose;
var util = require('util');

function errorThrower(e) { if (e) throw e; }

// The following two functions are jacked from Backbone.js (version 0.9.1)
function extend(protoProps, classProps) {
  function inherits(parent, protoProps, staticProps) {
    function ctor() {}
    var child;
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    } else {
      child = function () { parent.apply(this, arguments); };
    }
    _.extend(child, parent);
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    if (protoProps) _.extend(child.prototype, protoProps);
    if (staticProps) _.extend(child, staticProps);
    child.prototype.constructor = child;
    child.__super__ = parent.prototype;
    return child;
  }

  var child = inherits(this, protoProps, classProps);
  child.extend = this.extend;
  return child;
}

// Base Model
// ==========
function Base(attributes) {
  this.attributes = attributes || {};
}

Base.SCHEMA_TABLE = '_schema_version';

Base.extend = extend;

// include validators
Base.Validator = require('./validators.js');

// include schema defs
Base.Field = require('./field.js');

Base.prototype = {
  // set some reasonable defaults
  driver: 'mysql',
  engine: 'InnoDB',
  schema: null,
  validators: null,

  validate: function (attr) {
    attr = attr || this.attributes;

    var schema = this.constructor.getSchema();
    var errors = {};

    function runTest(value, field, test) {
      if (errors[field]) return;
      var error = test(value, attr);
      if (error) {
        error.value = value;
        errors[field] = error;
      }
    }

    function runValidators(o, field) {
      var value = attr[field];
      _.each(_.arrayify(o.validators || o), runTest.bind(null, value, field));
    }

    // run all the validators defined by the schema
    _.each(schema, runValidators);

    // run any validators defined by model outside of the schema
    _.each(this.validators || {}, runValidators);

    if (_.isEmpty(errors)) return;
    return errors;
  },

  mutate: function (attr) {
    return this._radioactivity('storage', attr || this.attributes);
  },

  demutate: function (mattr) {
    return this._radioactivity('retrieval', mattr || this.attributes);
  },

  _radioactivity: function (direction, attr) {
    var schema = this.constructor.getSchema();

    // make a zipped array of field, mutator
    function extraction(o) {
      return _.map(o, function (spec, field) {
        var fn = _.extract(spec, ['mutators', direction]) || _.identity;
        return [field, fn];
      });
    }

    // drop all fields that aren't found in the attributes array
    function cleanup(a) {
      return _.filter(a, function (a) {
        var field = a[0];
        return attr[field];
      });
    }

    // turn the zipped array back into an object
    var stitch = _.zippo;

    // call of the functions in the mutators fn object with
    // the values of the attributes object
    function getMutations(spec, attr) {
      var fns = compose(extraction, cleanup, stitch)(spec);
      return _.callmap(fns, attr);
    }

    return getMutations(schema, attr);
  },

  save: function (callback) {
    callback = callback || function () {};

    var fields = [];
    var attr = this.mutate(this.attributes);
    var values = [];
    var data = {};
    var errors = null;
    var attrGetter = _.get(attr);
    var attrUndefined = _.compose(_.isUndefined, attrGetter);

    // Fail early: check the result of validation before saving
    if ((errors = this.validate(this.attributes))) {
      return callback({ validation: errors });
    }

    // remove any fields that don't have an attribute set
    fields = _.reject(_.keys(this.schema), attrUndefined);

    // get the values for the remaining fields
    values = _.map(fields, attrGetter);

    // zip them back together into an object
    data = _.zipmap(fields, values);

    this.client.upsert(this.table, data, function (err, result) {
      if (err) return callback(err);

      if (!this.get('id')) {
        this.constructor.findById(result.insertId, function (err, saved) {
          if (err) return callback(err);
          this.attributes = saved.attributes;
          callback(null, this);
        }.bind(this));
      }

      else {
        callback(null, this);
      }
    }.bind(this));
  },

  destroy: function (callback) {
    callback = callback || function () {};

    var self = this;
    var attributes = this.attributes;
    var table = this.table;
    var querySQL = 'DELETE FROM `' + table + '` WHERE `id` = ? LIMIT 1';

    if (!this.get('id')) return callback(null, self);

    this.client.query(querySQL, [attributes.id], function (err, resp) {
      if (err) { return callback(err); }
      delete attributes.id;
      return callback(null, self);
    });
  },

  get: function (k) {
    var getters = _.extend({}, this.getters);
    var g, fn = (g = getters[k])
      ? g.bind(this)
      : _.identity;
    return fn(this.attributes[k]);
  },

  set: function (k, v) {
    var setters = _.extend({}, this.setters);
    if (setters[k]) setters[k].bind(this)(v);
    else this.attributes[k] = v;
    return this;
  }
};

_.extend(Base, {
  // A number of methods create or populate the `_fieldspec` object.
  // The object is keyed by the fields in the schema. The values of are
  // objects that have, at the very minimum, an `sql` property. They can
  // also contain:
  //   `validators` -- an array of validator functions,
  //   `keysql` -- sql for generating key contraints
  //   `dependsOn` -- a model the field depends on.
  //   `mutators` -- object with `storage` and `retrieval` props
  fieldspec: null,

  find: function (criteria, callback) {
    var qb = this.client
      .select('*')
      .from(_.backtick(this.prototype.table))
      .where('1=1');

    _.each(criteria, function (value, key) {
      qb.and(_.backtick(key) + ' = ?', value);
    });


    // demutate before turning back into an object
    var make = (function (attr) {
      return new this(this.prototype.demutate(attr));
    }).bind(this);

    qb.go(function (err, result) {
      if (err) return callback(err);
      callback(null, _.map(result, make));
    });
  },

  findOne: function (criteria, callback) {
    this.find(criteria, function (err, res) {
      if (err) return callback(err);
      callback(null, res.pop());
    });
  },

  findById: function (id, callback) {
    this.findOne({ id: id }, callback);
  },

  findAll: function (callback) {
    this.find({}, callback);
  },

  getSchema: function () {
    var schema = this.prototype.schema;
    var newSchema = {};

    if (!schema)
      throw new Error('missing schema');

    if (String(schema) !== '[object Object]')
      throw new TypeError('schema must be an object');

    _.each(schema, function (value, field) {
      // A string means that the user wants this inserted as raw sql
      if (_.isString(value))
        newSchema[field] = _.extend({}, {sql: value});

      // Pass objects straight through
      if (_.isObject(value))
        newSchema[field] = _.extend({}, value);

      // Functions should generate an object with, at the very least, an `sql`
      // property. They can optionally generate more (like validators).
      // The function can also be a higher order function that returns a
      // function that does the above.
      if (_.isFunction(value)) {
        var spec = _.isFunction(value())
          ? value()(field)
          : value(field);
        newSchema[field] = _.extend({}, newSchema[field], spec);
      }
      _.defaults(newSchema[field], {mutators: {}, validators: []});
    });
    this.getSchema = function () { return newSchema; };
    return newSchema;
  },

  createTableSql: function (schema) {
    var fieldsql = [];
    var keysql = [];
    var table = this.prototype.table;
    var engine = this.prototype.engine;
    if (!table) {
      throw new Error('table must be specified before trying to' +
                      ' make the `create table` statement');
    }
    _.each(schema, function (value, key) {
      fieldsql.push([
        _.backtick(key),
        value.sql
      ].join(' '));

      if (value.keysql)
        keysql.push(value.keysql);
    });

    var sql = _.strjoin([
      _.upcase('create table if not exists'),
      _.backtick(table),
      _.paren(_.union(fieldsql, keysql).join(', ')),
      _.upcase('engine ='),
      engine
    ]);

    return sql;
  },

  makeTable: function (callback) {
    callback = callback || errorThrower;
    var schema = this.getSchema();
    var sql = this.createTableSql(schema);
    _.each(schema, function (spec) {
      if (spec.dependsOn) { spec.dependsOn.makeTable(); }
    });
    this.updateSchemaVersion();
    this.client.query(sql, function (err, res) {
      if (err) return callback(err);
      callback(null, this);
    }.bind(this));
  },

  updateSchemaVersion: function (version, callback) {
    if (typeof version === 'function') {
      callback = version;
      version = null;
    }
    callback = callback || errorThrower;
    version = version || this.prototype.version || '0000';
    var client = this.client;
    var modelTable = this.prototype.table;
    var schemaTable = Base.SCHEMA_TABLE;
    var sql = _.strjoin([
      'create table if not exists',
      _.backtick(schemaTable),
      _.paren([
        '`table` varchar(255) not null primary key',
        '`version` varchar(255) not null'
      ].join(','))
    ]);
    // first create the table if it doesn't exist.
    client.query(sql, function (err, result) {
      if (err) return callback(err);

      // try to do an insert. if it fails with a 'duplicate key' message,
      // switch to using an update. if there's any other error, send it
      // to the callback
      var data = { table: modelTable, version: version };
      return client.insert(schemaTable, data, function (err, result) {
        if (!err) return callback(null, result);
        if (!err.message.match(/duplicate/i)) return callback(err);

        var where = { table: modelTable };
        client.update(schemaTable, data, where, function (err, result) {
          if (err) return callback(err);
          return callback(null, result);
        });
      });
    });
  },

  getSchemaVersion: function (callback) {
    callback = callback || errorThrower;
    var query = this.client
      .select('version')
      .from(Base.SCHEMA_TABLE)
      .where('`table` = ?', [this.prototype.table]);

    query.go(function (err, results) {
      if (err) return callback(err);
      var result = results[0];
      if (!result) return callback(null, null);
      return callback(null, result.version);
    });
  }
});

module.exports = Base;
