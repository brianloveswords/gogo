var _ = require('underscore')
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
      , mattr = {};
    
    // ensure the dopeness of the schema
    model.parseSchema();

    _.each(model.fieldspec, function (spec, field) {
      if (!attr[field]) return;
      var fn = (spec.mutators[direction] || _.identity);
      mattr[field] = fn(attr[field]);
    });
    return mattr;
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
    data = _.zippo(fields, values);
    
    this.client.upsert(this.table, data, function (err, result) {
      if (err) return callback(err);
      if (!this.get('id')) { this.set('id', result.insertId) }
      callback(null, this);
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
    var qb = this.client
      .select('*')
      .from(_.backtick(this.prototype.table))
      .where('1=1');
    
    _.each(criteria, function (value, key) {
      qb.and(_.backtick(key) + ' = ?', value)
    });
    
    
    // demutate before turning back into an object
    var make = (function (attr) {
      return new this(this.prototype.demutate(attr));
    }).bind(this);
    
    qb.go(function (err, result) {
      if (err) return callback(err);
      callback(null, _.map(result, make));
    })
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
        var spec = value.higherOrder ? value()(key) : value(key);
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
    console.dir(sql);
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

