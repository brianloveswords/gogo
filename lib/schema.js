// Schema helpers
// --------------
var _ = require('underscore');

var Base = { };

// include validators
var Validators = Base.Validators = require('./validators.js');

function finishSpec(spec, opts) {
  if (opts.unique) {
    if (opts.unique === true && spec.sql.match(/^(text|blob)/i)) {
      throw new Error('when adding a unique key to an unsized type' +
                      '(text or blob), unique must be set with a' + 
                      'length e.g. { unique: 128 }');
    }
    
    var length = parseInt(opts.unique) ? opts.unique : undefined;
    
    spec.keysql = _.strjoin([
      _.upcase('unique key'),
      _.backtick(this.field),
      _.paren(_.strjoin([
        _.backtick(this.field),
        _.paren(length)
      ]))
    ]);
  }
  
  if (opts.null === false || opts.required === true) {
    spec.sql = _.strjoin(spec.sql, 'NOT NULL');
    spec.validators.unshift(Validators.Require);
  }
  
  if (opts.default !== undefined) {
    
    var defval = opts.default
      , txt = opts.type.match(/blob|text|char|enum|binary/i);
    spec.sql = _.strjoin([
      spec.sql,
      'DEFAULT',
      (txt ? _.quote(defval) : defval)
    ]);
  }
  return spec;
}

var ff = function (fn) {
  return function () {
    var args = [].slice.call(arguments)
      , self = {}
      , newFn;
    
    function applier(memo, arg) {
      return memo.bind(self, arg);
    }
    
    newFn = _.foldl(args, applier, fn);
    
    return function (field) {
      self.field = field;
      return newFn.bind(self).call();
    }
  }
};

var Schema = Base.Schema = {
  Id: ff(function (opts) {
    return {
      sql: 'BIGINT AUTO_INCREMENT',
      validators: [Validators.Type.Number],
      keysql: _.strjoin('PRIMARY KEY', _.paren(_.backtick(this.field)))
    };
  }),
  
  Number: ff(function (typeOrLength, opts) {
    // #TODO: implement numeric sizes.
    //        e.g. TINYINT(1).
    // #TODO: implement DECIMAL
    if (_.isObject(typeOrLength)) {
      return arguments.callee.call(this, opts, typeOrLength);
    }
    function parseArgs(typeOrLength, opts) {
      var lengths = ['tiny', 'small', 'medium', 'big']
        , types = ['int', 'double' , 'float']
        , defaults = { type: 'int', length: '' }
      _.defaults(opts, defaults);
      
      if (!typeOrLength) return;
      
      typeOrLength = typeOrLength.toLowerCase();
      
      if (_.include(lengths, typeOrLength)) {
        opts.length = typeOrLength;
      }
      else if (_.include(types, typeOrLength)) {
        opts.type = typeOrLength;
      }
    }
    
    opts = opts||{}
    
    parseArgs(typeOrLength, opts);
    
    var spec = {
      sql: opts.length + opts.type,
      validators : [Validators.Type.Number]
    };
    
    if (opts.unsigned || opts.signed === false) {
      spec.sql += ' UNSIGNED';
    }
    
    if (opts.signed === true) {
      spec.sql += ' SIGNED';
    }
    
    finishSpec.bind(this)(spec, opts);
    spec.sql = spec.sql.toUpperCase();
    return spec;
  }),

  String: ff(function (opts) {  
    opts = opts || {};
    var size = opts.size||opts.length;
    
    var spec = { sql: '', validators : [] }
    if (size) {
      // handle cases when the size is `tiny` or `medium`, etc.
      if (isNaN(Number(size))) {
        _.defaults(opts, { type: 'text' });
        spec.sql = size + opts.type;
      }

      // the normal case when size is a number.
      else {
        _.defaults(opts, { type: 'varchar' });
        _.extend(spec, {
          sql: opts.type + _.paren(size),
          validators: [Validators.Length(size)]
        });
      }
    }
    
    // if there isn't a size specified, just go with text.
    else {
      _.defaults(opts, {type: 'text'});
      spec.sql = opts.type;
    }
    
    // char and varchar need sizes or SQL will blow up.
    var type = opts.type;
    if (type && type.match(/char/i) && !size) {
      throw new Error('type mismatch: ' + type + ' must be set with a size');
    }
    
    // don't test stringiness on binary things.
    if (!type.match(/binary/i)) {
      spec.validators.unshift(Validators.Type.String);
    }
    
    spec.sql = _.upcase(spec.sql);
    finishSpec.bind(this)(spec, opts);
    return spec;
  }),
  Enum: ff(function (values, opts) {
    if (_.isObject(values)) { return arguments.callee.call(this, opts, values) }
    opts = opts||{};
    _.defaults(opts, { type: 'enum' });
    values = values||opts.values;
    
    function q (v) { return '"'+v+'"' }
    
    var spec = {
      sql: 'ENUM (' + values.map(q).join(', ')+ ')' ,
      validators : [Validators.Type.Enum(values)]
    };
    
    finishSpec.bind(this)(spec, opts);
    return spec;
  }),
  Foreign: ff(function (opts) {
    _.defaults(opts, {field: 'id'})
    opts.model.parseSchema();
    var spec = opts.model.fieldspec[opts.field]
      , type = spec.sql.split(' ').shift()
      , ftable = opts.model.prototype.table
    
    return {
      dependsOn: opts.model,
      foreign: opts.field,
      sql: type,
      keysql: _.strjoin([
        _.upcase("foreign key"),
        _.backtick(opts.model.prototype.table + '_fkey'),
        _.paren(_.backtick(this.field)),
        _.upcase("references"),
        _.backtick(ftable),
        _.paren(_.backtick(opts.field))
      ]),
      mutators: {
        storage: function (v) {
          if (_.isObject(v)) return _.extract(v, ['attributes', 'id'])
          else return v;
        }
      }
    };
  }),
  Document: ff(function (opts) {
    opts = opts||{}
    _.defaults(opts, {serializer: JSON.stringify, deserializer: JSON.parse });
    var spec = {
      sql: _.upcase('blob'),
      mutators: {
        storage: opts['serializer'],
        retrieval: opts['deserializer']
      },
      validators: [Validators.Serializable(opts['serializer'])]
    }
    return finishSpec(spec, opts);
  }),
  Time: ff(function (opts) {
    opts = opts||{}
    _.defaults(opts, { type: 'timestamp' });
    var spec = { sql: _.upcase(opts.type) };
    return finishSpec(spec, opts);
  }),
  Set: function () {
    // #TODO: implement;
    throw new Error('not implemented');
  },
}

// Aliases
var alias = function (type, original, preproc) {
  return function (opt) {
    if (preproc) opt = preproc(opt);
    opt = opt||{}
    _.extend(opt, {type: type})
    return original(opt);
  }
}
var handleLength = function (opt) {
  if (parseInt(opt)) opt = { length: parseInt(opt) };
  return opt;
};
Schema.Text = Schema.String;
Schema.Boolean = alias('boolean', Schema.Number)
Schema.Float = alias('float', Schema.Number);
Schema.Double = alias('double', Schema.Number);
Schema.Blob = alias('blob', Schema.String);
Schema.Char = alias('char', Schema.String, handleLength)
Schema.Varchar = alias('varchar', Schema.String, handleLength)
Schema.Binary = alias('binary', Schema.String, handleLength)
Schema.Varbinary = alias('varbinary', Schema.String, handleLength)

module.exports = Base.Schema;