var _ = require('underscore')
  , compose = require('functools').compose
// The following two functions are jacked from Backbone.js (version 0.9.1)
var extend = function (protoProps, classProps) {
  var inherits = function(parent, protoProps, staticProps) {
    var child, ctor = function(){};
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){parent.apply(this, arguments);};
    }
    _.extend(child, parent);
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    if (protoProps) _.extend(child.prototype, protoProps);
    if (staticProps) _.extend(child, staticProps);
    child.prototype.constructor = child;
    child.__super__ = parent.prototype;
    return child;
  };
  
  var child = inherits(this, protoProps, classProps);
  child.extend = this.extend;
  return child;
};

// Base Model
// ==========
var Base = function (attributes) {
  console.dir(attributes);
  this.attributes = attributes || {};
};

// include validators
Base.Validators = require('./validators.js');

// include schema defs
Base.Schema = require('./schema.js');

Base.extend = extend;
Base.prototype = {
  driver: 'mysql',
  engine: 'InnoDB',
  schema: null,
  validators: null,
  
  validate: function (attr) {
    var model = this.constructor
      , errors = {}
    
    attr = attr || this.attributes;
    
    function arrayify (o) { if (_.isArray(o)) return o; else return [o] };

    function runTest (value, field, test) {
      if (errors[field]) return;
      var error = test(value, attr);
      if (error) {
        error.value = value;
        errors[field] = error;
      }
    }
    
    function runValidators (o, field) {
      var value = attr[field];
      _.each(arrayify(o.validators || o), runTest.bind(null, value, field))
    }
    
    // make sure the schema has been parrrrrrsed;
    model.parseSchema();
    
    // run all the validators defined by the schema
    _.each(model.fieldspec, runValidators);
    
    // run any validators defined by model outside of the schema
    _.each(this.validators || {}, runValidators);
    
    if (_.isEmpty(errors)) return;
    return errors;
  },
  
  mutate: function (attr) {
    return this._radioactivity('storage', attr || this.attributes)
  },
  
  demutate: function (mattr) {
    return this._radioactivity('retrieval', mattr || this.attributes)
  },
  
  _radioactivity: function (direction, attr) {
    var model = this.constructor
      , mattr = {}
    
    // make a zipped array of field, mutator
    var extraction = function (o) {
      return _.map(o, function (spec, field) {
        var fn = _.extract(spec, ['mutators', direction]) || _.identity;
        return [field, fn]
      });
    }
    // drop all fields that aren't found in the attributes array
    var cleanup = function (a) {
      return _.filter(a, function (a) {
        var field = a[0];
        return attr[field]
      });
    }
    // turn the zipped array back into an object
    var stitch = _.zippo
    
    // call of the functions in the mutators fn object with
    // the values of the attributes object
    function getMutations(spec, attr) {  
      var fns = compose(extraction, cleanup, stitch)(spec);
      return _.callWith(fns, attr)
    }
     
     // ensure the dopeness of the schema
    model.parseSchema();
    return getMutations(model.fieldspec, attr);
  },
  
  save: function (callback) {
    var fields = []
      , attr = this.mutate(this.attributes)
      , values = []
      , data = {}
      , errors = null
      , attrGetter = _.getter(attr)
      , attrUndefined = _.compose(_.isUndefined, attrGetter);
    
    callback = callback || function(){};
    
    // Fail early: check the result of validation before saving
    if (errors = this.validate(this.attributes)) {
      return callback({ validation: errors });
    }
    
    // remove any fields that don't have an attribute set
    fields = _.reject(_.keys(this.schema), attrUndefined);
    
    // get the values for the remaining fields
    values = _.map(fields, attrGetter);

    // zip them back together into an object
    data = _.zippo2(fields, values);
    
    this.client.upsert(this.table, data, function (err, result) {
      if (err) return callback(err);
      
      if (!this.get('id')) {
        this.constructor.findById(result.insertId, function (err, saved) {
          if (err) return callback(err)
          this.attributes = saved.attributes;
          callback(null, this);
        }.bind(this))
      }
      
      else {
        callback(null, this);
      }
    }.bind(this))
  },
  
  destroy: function (callback) {
    var self = this
      , attributes = this.attributes
      , table = this.table
      , querySQL = 'DELETE FROM `'+table+'` WHERE `id` = ? LIMIT 1';
    callback = callback||function(){};
    if (!this.get('id')) return callback(null, self);
    this.client.query(querySQL, [attributes.id], function (err, resp) {
      if (err) { return callback(err); }
      delete attributes.id;
      return callback(null, self);
    });
  },
  
  get: function (k) {
    var fn = _.identity
      , getters = _.extend({}, this.getters)
    if (getters[k]) { fn = getters[k].bind(this); }
    return fn(this.attributes[k]);
  },
  
  set: function (k, v) {
    var setters = _.extend({}, this.setters)
    if (setters[k]) {
      setters[k].bind(this)(v);
    } else {
      this.attributes[k] = v;
    }
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
    this.parseSchema();
    var schema = this.fieldspec
      , table = this.prototype.table
      , builder;
    criteria = _.zippo(_.map(_.ozip(criteria), function (a) {
      a[0] = _.backtick(table) + '.' + _.backtick(a[0])
      return a;
    }))
    function dependencies (o) {
      return _.map(o, function (spec, field) {
        if (spec.dependsOn) return field;
      })
    }
    function prepend (pre, sep) {
      return function (s) {
        return pre + (sep||'') + s;
      }
    }
    function getFields (model) {
      model = model.prototype;
      return aliaskeys(model.schema, model.table);
    }
    function aliaskeys (schema, table) {
      var keys = _.map(_.keys(schema), prepend(table, '.'))
        , aliases = _.map(_.keys(schema), prepend(table, '$'))
      return _.zippo2(keys, aliases);
    }
    function clean (o) { return _.reject(o, _.missing) }
    
    var joins = compose(dependencies, clean)(schema)
      , select = getFields(this)
      , tables = [ table ]
      , fcriteria = {}
    if (joins.length)  {
      _.map(joins, function (field) {
        var model = schema[field]['dependsOn']
          , ffield = schema[field]['foreign']
          , ftable = model.prototype.table
          , fkey = _.backtick(ftable)+'.'+_.backtick(ffield)
          , lkey = _.backtick(table)+'.'+_.backtick(field)
        _.extend(select, getFields(model));
        tables.push(ftable);
        fcriteria[fkey] = lkey
      })
    }
    
    builder = this.client.select(select)
    builder.from(_.map(tables, _.backtick))
    builder.where('1=1');
    
    _.each(criteria, function (value, key) {
      builder.and(key + ' = ?', value)
    });
    
    _.each(fcriteria, function (value, key) {
      builder.and(key + ' = ' + value)
    });
    
    // demutate before turning back into an object
    var make = (function (attr) {
      return new this(this.prototype.demutate(attr));
    }).bind(this);
    
    builder.go(function (err, result) {
      if (err) return callback(err);
      callback(null, _.map(result, make));
    })
  },
  
  _unjoin: function (results) {
    console.dir(results);
  },
  
  findOne: function (criteria, callback) {
    this.find(criteria, function (err, res) {  
      if (err) return callback(err);
      callback(null, res.pop());
    })
  },
  
  findById: function (id, callback) {
    this.findOne({ id: id }, callback);
  },
  
  findAll: function (callback) {
    this.find({}, callback);
  },
  
  // Parse the `schema` object, handle any helpers, and turn it into a 
  // fieldspec entry.
  parseSchema: function () {
    var schema = this.prototype.schema
      , fieldspec = this.fieldspec || {};
    this.fieldspec = fieldspec;
    
    if (!schema) {
      throw new Error('missing schema');
    }
    
    if (String(schema) !== '[object Object]') {
      throw new TypeError('schema must be an object');
    }
    
    _.each(schema, function (value, key) {
      // A string means that the user wants this inserted as raw sql
      if (_.isString(value)) {
        fieldspec[key] = _.extend({}, {sql: value});
      }

      // Pass objects straight through
      if (_.isObject(value)) {
        fieldspec[key] = _.extend({}, value);
      }

      // Functions should generate an object with, at the very least, an `sql`
      // property. They can optionally generate more (like validators).
      // The function can also be a higher order function that returns a
      // function that does the above.
      if (_.isFunction(value)) {
        var spec = _.isFunction(value()) ? value()(key) : value(key);
        fieldspec[key] = _.extend({}, fieldspec[key], spec);
      }
      _.defaults(fieldspec[key], {mutators: {}, validators: []});
      return this;
    });
  },

  createTableSql: function () {
    var fieldsql = []
      , keysql = []
      , table = this.prototype.table
      , engine = this.prototype.engine
    if (!table) {
      throw new Error('table must be specified before trying to' +
                      ' make the `create table` statement')
    }
    _.each(this.fieldspec, function (value, key) {
      fieldsql.push([
        _.backtick(key),
        value.sql
      ].join(' '))
      
      if (value.keysql) {
        keysql.push(value.keysql);
      }
    })
    
    var sql = _.strjoin([
      _.upcase('create table if not exists'),
      _.backtick(table),
      _.paren(_.union(fieldsql, keysql).join(', ')),
      _.upcase('engine ='),
      engine
    ])
    
    return sql;
  },
  
  makeTable: function (callback) {
    this.parseSchema();
    _.each(this.fieldspec, function (spec) {
      if (spec.dependsOn) { spec.dependsOn.makeTable(); }
    })
    this.client.query(this.createTableSql(), callback);
  },
});

module.exports = Base;

