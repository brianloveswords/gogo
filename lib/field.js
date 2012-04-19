// Field helpers
// --------------
var _ = require('./ext-underscore');

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

    var length = parseInt(opts.unique, 10) ? opts.unique : undefined;

    spec.keysql = _.strjoin(
      _.upcase('unique key'),
      _.backtick(this.field),
      _.paren(_.strjoin(
        _.backtick(this.field),
        _.paren(length)
      ))
    );
  }

  if (opts['null'] === false || opts.required === true) {
    spec.sql = _.strjoin(spec.sql, 'NOT NULL');
    spec.validators.unshift(Validators.Require);
  }

  if (opts['default'] !== undefined) {

    var defval = opts['default'];
    var txt = opts.type.match(/blob|text|char|enum|binary/i);
    spec.sql = _.strjoin(
      spec.sql,
      'DEFAULT',
      (txt ? _.quote(defval) : defval)
    );
  }
  return spec;
}

var ff = function (fn) {
  return function () {
    var args = [].slice.call(arguments);
    var self = {};
    var newFn;

    function applier(memo, arg) {
      return memo.bind(self, arg);
    }

    newFn = _.foldl(args, applier, fn);

    return function (field) {
      self.field = field;
      return newFn.bind(self).call();
    };
  };
};

var Field = Base.Field = {
  Id: ff(function (opts) {
    return {
      sql: 'BIGINT AUTO_INCREMENT',
      validators: [ Validators.Type.Number ],
      keysql: _.strjoin('PRIMARY KEY', _.paren(_.backtick(this.field)))
    };
  }),

  Number: ff(function numberField(typeOrLength, opts) {
    // #TODO: implement numeric sizes.
    //        e.g. TINYINT(1).
    // #TODO: implement DECIMAL
    if (_.isObject(typeOrLength)) {
      return numberField.call(this, opts, typeOrLength);
    }
    function parseArgs(typeOrLength, opts) {
      var lengths = ['tiny', 'small', 'medium', 'big'];
      var types = ['int', 'double', 'float'];
      var defaults = { type: 'int', length: '' };
      _.defaults(opts, defaults);

      if (!typeOrLength) return;

      typeOrLength = typeOrLength.toLowerCase();

      if (_.include(lengths, typeOrLength))
        opts.length = typeOrLength;
      
      else if (_.include(types, typeOrLength))
        opts.type = typeOrLength;
    }

    opts = opts || {};

    parseArgs(typeOrLength, opts);

    var spec = {
      sql: opts.length + opts.type,
      validators : [ Validators.Type.Number ]
    };

    if (opts.unsigned || opts.signed === false)
      spec.sql += ' UNSIGNED';

    if (opts.signed === true)
      spec.sql += ' SIGNED';

    finishSpec.bind(this)(spec, opts);
    spec.sql = spec.sql.toUpperCase();
    return spec;
  }),

  String: ff(function (opts) {
    opts = opts || {};
    var size = opts.size || opts.length;

    var spec = { sql: '', validators : [] };
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
          validators: [ Validators.Length(size) ]
        });
      }
    }

    // if there isn't a size specified, just go with text.
    else {
      _.defaults(opts, { type: 'text' });
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
  Enum: ff(function enumField(values, opts) {
    if (_.isObject(values))
      return enumField.call(this, opts, values);
    
    opts = opts || {};
    _.defaults(opts, { type: 'enum' });
    values = values || opts.values;

    var spec = {
      sql: 'ENUM ' + _.paren(values.map(_.quote).join(', ')),
      validators : [ Validators.Type.Enum(values) ]
    };

    finishSpec.bind(this)(spec, opts);
    return spec;
  }),
  Foreign: ff(function (opts) {
    _.defaults(opts, { field: 'id' });
    var fschema = opts.model.getSchema();
    var spec = fschema[opts.field];
    var type = spec.sql.split(' ').shift();
    var ftable = opts.model.prototype.table;

    return {
      dependsOn: opts.model,
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
          if (_.isObject(v))
            return _.extract(v, ['attributes', 'id']);
          else return v;
        }
      }
    };
  }),
  Document: ff(function (opts) {
    opts = opts || {};
    _.defaults(opts, { serializer: JSON.stringify, deserializer: JSON.parse });
    var spec = {
      sql: _.upcase('blob'),
      mutators: {
        storage: opts['serializer'],
        retrieval: opts['deserializer']
      },
      validators: [ Validators.Serializable(opts['serializer']) ]
    };
    return finishSpec(spec, opts);
  }),
  Time: ff(function (opts) {
    opts = opts || {};
    _.defaults(opts, { type: 'timestamp' });
    var spec = { sql: _.upcase(opts.type) };
    return finishSpec(spec, opts);
  }),
  Set: function () {
    // #TODO: implement;
    throw new Error('not implemented');
  }
};

function alias(type, original, preproc) {
  preproc = preproc || _.identity;
  return function (opt) {
    opt = preproc(opt || {});
    _.extend(opt, { type: type });
    return original(opt);
  };
}

function handleLength(opt) {
  var num = parseInt(opt, 10);
  opt = num ? { length: num } : opt;
  return opt;
}

// Aliases
Field.Text = Field.String;
Field.Boolean = alias('boolean', Field.Number);
Field.Float = alias('float', Field.Number);
Field.Double = alias('double', Field.Number);
Field.Blob = alias('blob', Field.String);
Field.Char = alias('char', Field.String, handleLength);
Field.Varchar = alias('varchar', Field.String, handleLength);
Field.Binary = alias('binary', Field.String, handleLength);
Field.Varbinary = alias('varbinary', Field.String, handleLength);

module.exports = Base.Field;