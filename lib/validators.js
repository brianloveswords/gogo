// Validation Helpers
// ------------------
var _ = require('./ext-underscore');
var Validator = {
  Require: function requireValidator(value) {
    if (!arguments.length) return requireValidator;
    if (_.isMissing(value)) return { name: 'required', value: value };
  },
  
  Length: function lengthFactory() {
    var min, max, arg = arguments[0];
    if (String(arg) === '[object Object]') {
      min = arg['min'];
      max = arg['max'];
    } else {
      max = arg;
    }
    function lengthValidator(value) {
      if (_.isMissing(value)) return;
      if ((max && value.length > max) || (min && value.length < min))
        return { name: 'length', value: value, max: max, min: min };
    }
    lengthValidator.meta = { name: 'length', max: max, min: min };
    return lengthValidator;
  },
  
  Serializable: function serializableFactory(serializer) {
    function serializableValidator(value) {
      if (_.isMissing(value)) return;
      var string = serializer(value);
      if (!string) return { name: 'serializable', value: value };
    }
    serializableValidator.meta = { name: 'serializable', serializer: serializer };
    return serializableValidator;
  },
  
  Regexp: function regexpFactory(re) {
    if (!_.isRegExp(re)) throw new Error('Regexp validator given an invalid regexp');

    return function regexpValidator(value) {
      if (!value) return;
      if (!re.test(value))
        return { name: 'regexp', value: value, regexp: re };
    };
  },
  
  Email: function emailValidator(value) {
    if (!arguments.length) return emailValidator;
    var re = /[a-z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*@(?:[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?/;
    var err = Validator.Regexp(re)(value);
    if (err) {
      err.name = 'email';
      return err;
    }
  },

  // `validators` is an object where each property is a potential array of
  //  validation functions (including, maybe, a call to this method)
  Document: function documentFactory(validators) {
    function documentValidator(doc, attr, debug) {
      doc = doc || {};
      attr = attr || {};
      
      var errors = [];

      _.each(validators, function (valset, field) {
        var err = null;
        var value = doc[field];

        // turn validators into an array if it isn't one
        valset = _.arrayify(valset);

        // run all the validation for this field
        _.each(valset, function (validator) {

          // if there's already an error, don't bother
          if (err) return;
          err = validator(value, attr, (field == 'badge'));

        });

        // set the correct field on the error
        if (err) err.field = field;

        // jam it into the array with the rest of 'em
        errors.push(err);
      });

      // throw out any undefined or nulls that snuck in there
      errors = _.reject(errors, _.isMissing);

      if (errors.length) {
        return { name: 'doc', errors: errors };
      }
    }
    documentValidator.meta = { name : 'doc' };
    return documentValidator;
  },

  Type: {
    Enum: function enumFactory(valid) {
      function enumValidator(value) {
        if (_.isMissing(value)) return;
        if (!_.include(valid, value)) {
          return { name: 'type.enum', value: value };
        }
      }
      enumValidator.meta = { name: 'type.enum', valid: valid };
      return enumValidator;
    },
    Number: function numberValidator(value) {
      if (!arguments.length) return numberValidator;
      if (_.isMissing(value)) return;
      if (Number(value) != value) return { name: 'type.number', value: value };
    },
    String: function stringValidator(value) {
      if (!arguments.length) return stringValidator;
      if (_.isMissing(value)) return;
      if (!_.isString(value)) return { name: 'type.string', value: value };
    },
    Object: function objectValidator(value) {
      if (!arguments.length) return objectValidator;
      if (_.isMissing(value)) return;
      if (String(value) !== '[object Object]' || _.isString(value)) {
        return { name: 'type.object', value: value };
      }
    },
    Array: function arrayValidator(value) {
      if (!arguments.length) return arrayValidator;
      if (_.isMissing(value)) return;
      if (!_.isArray(value)) return { name: 'type.array', value: value };
    }
  }
};

Validator.Require.when = function requireWhenFactory(opt) {
  var field = opt['field'];
  var fieldValue = opt['is'];
  return function requireWhenValidator(value, attrs) {
    if (attrs[field] && attrs[field] === fieldValue && _.isMissing(value)) {
      return _.extend({ name: 'required-when', value: value }, opt);
    }
  };
};

Validator.Require.all = function requireAllValidator(obj) {
  var req = Validator.Require;
  _.each(obj, function (v, k) {
    if (v && v.meta && v.meta.name === 'doc') return;
    if (_.isArray(v) && v[0] !== req) v.unshift(req);
    if (_.isFunction(v)) obj[k] = [req, v];
    if (_.isMissing(v)) obj[k] = req;
  });
  return obj;
};

module.exports = Validator;