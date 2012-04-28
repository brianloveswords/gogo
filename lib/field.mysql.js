// Field helpers
// --------------
var _ = require('./ext-underscore');

// include validators
var Validators = require('./validators.js');

/**
 * Helper for handling generic options for field generators.
 *
 * @param {Object} spec
 * @param {Object} opts see below
 * @param {String} field
 *
 * @param {Boolean} opts.null when false, adds `required` validator,
 *   `not null` to field
 * @param {Boolean} opts.required opposite of `opts.null`
 * @param {Boolean|Integer} opts.unique integer specifies length of key
 * @param {String|Number} opts.default the default value for the field
 */

function finishSpec(spec, opts, field) {
  if (opts.unique) {
    var keylength = parseInt(opts.unique, 10) ? opts.unique : undefined;
    
    if (opts.unique === true && spec.sql.match(/^(text|blob)/i)) {
      var msg = 'When adding a unique key to an unsized type (text or blob), unique must be set with a length e.g. { unique: 128 }';
      throw new Error(msg);
    }

    spec.keysql = _.strjoin(
      _.upcase('unique key'),
      _.backtick(field),
      _.paren(_.strjoin(
        _.backtick(field),
        _.paren(keylength)
      ))
    );
  }

  if (opts['null'] === false || opts.required === true) {
    spec.sql = _.strjoin(spec.sql, 'NOT NULL');
    spec.validators.unshift(Validators.Require);
  }

  if (opts['default'] !== undefined) {
    var defval = opts['default'];
    var textType = opts.type.match(/blob|text|char|enum|binary/i);
    spec.sql = _.strjoin(
      spec.sql,
      'DEFAULT',
      (textType ? _.quote(defval) : defval)
    );
  }
  
  return spec;
}


var Field = {
  Id: function idFieldFactory() {
    return function idField(field) {
      return {
        sql: 'BIGINT AUTO_INCREMENT',
        validators: [ Validators.Type.Number ],
        keysql: _.strjoin('PRIMARY KEY', _.paren(_.backtick(field)))
      };
    };
  },

  
  Number: function numberFieldFactory(typeOrLength, opts) {
    // #TODO: uncomplicate this. it's probably trying to do too much.
    // #TODO: implement numeric sizes. e.g. TINYINT(1).
    if (_.isObject(typeOrLength)) {
      opts = typeOrLength;
      typeOrLength = null;
    }

    function parseArgs(typeOrLength, opts) {
      var lengths = ['tiny', 'small', 'medium', 'big'];
      var types = ['int', 'double', 'float'];
      var defaults = { type: 'int', length: '' };
      _.defaults(opts, defaults);
      if (!typeOrLength) return;
      typeOrLength = typeOrLength.toLowerCase();
      if (_.include(lengths, typeOrLength)) opts.length = typeOrLength;
      else if (_.include(types, typeOrLength)) opts.type = typeOrLength;
    }

    opts = opts || {};
    parseArgs(typeOrLength, opts);

    // #TODO: implement DECIMAL
    if (opts.type.match(/decimal/i))
      throw Error("not implemented");

    var spec = {
      sql: opts.length + opts.type,
      validators : [ Validators.Type.Number ]
    };

    if (opts.unsigned || opts.signed === false) spec.sql += ' UNSIGNED';
    if (opts.signed === true) spec.sql += ' SIGNED';

    return function numberField(field) {
      finishSpec(spec, opts, field);
      spec.sql = spec.sql.toUpperCase();
      return spec;
    };
  },

  String: function stringFieldFactory(opts) {
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
    if (type && type.match(/char/i) && !size)
      throw new Error('type mismatch: ' + type + ' must be set with a size');

    // don't test stringiness on binary things.
    if (!type.match(/binary/i))
      spec.validators.unshift(Validators.Type.String);

    spec.sql = _.upcase(spec.sql);
    return function stringField(field) {
      finishSpec(spec, opts, field);
      return spec;
    };
  },

  Enum: function enumFieldFactory(values, opts) {
    if (_.isObject(values)) {
      opts = values;
      values = null;
    }
    opts = opts || {};
    _.defaults(opts, { type: 'enum' });
    values = values || opts.values;

    var spec = {
      sql: 'ENUM ' + _.paren(values.map(_.quote).join(', ')),
      validators : [ Validators.Type.Enum(values) ]
    };

    return function (field) {
      finishSpec(spec, opts, field);
      return spec;
    };
  },

  Foreign: function foreignFieldFactory(opts) {
    _.defaults(opts, { field: 'id' });
    var fschema = opts.model.getSchema();
    var fspec = fschema[opts.field];
    var ftype = fspec.sql.split(' ').shift();
    var ftable = opts.model.prototype.table;

    var spec = {
      dependsOn: opts.model,
      sql: ftype,
      mutators: {
        storage: function (v) {
          if (_.isObject(v))
            return _.extract(v, ['attributes', 'id']);
          else return v;
        }
      }
    };

    return function foreignField(field) {
      spec.keysql = _.strjoin([
        _.upcase("foreign key"),
        _.backtick(opts.model.prototype.table + '_fkey'),
        _.paren(_.backtick(field)),
        _.upcase("references"),
        _.backtick(ftable),
        _.paren(_.backtick(opts.field))
      ]);
      return spec;
    };
  },

  Document: function documentFieldFactory(opts) {
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

    // #TODO: allow for keys/indices?
    return function documentField() {
      return finishSpec(spec, opts);
    };
  },

  Time: function timeFieldFactory(opts) {
    opts = opts || {};
    _.defaults(opts, { type: 'timestamp' });
    var spec = { sql: _.upcase(opts.type) };
    return function timeField() {
      return finishSpec(spec, opts);
    };
  },

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
Field.Timestamp = Field.Time;
Field.Boolean = alias('boolean', Field.Number);
Field.Float = alias('float', Field.Number);
Field.Double = alias('double', Field.Number);
Field.Blob = alias('blob', Field.String);
Field.Char = alias('char', Field.String, handleLength);
Field.Varchar = alias('varchar', Field.String, handleLength);
Field.Binary = alias('binary', Field.String, handleLength);
Field.Varbinary = alias('varbinary', Field.String, handleLength);

module.exports = Field;
