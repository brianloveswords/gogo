// Validation Helpers
// ------------------
var _ = require('underscore');

var Base = { Validators: {} };

Base.Validators = {
  Require: function require (value) {
    if (!arguments.length) return arguments.callee;
    if (_.missing(value)) return { name: 'required', value: value };
  },
  Length: function lengthF () {
    var min, max, arg = arguments[0];
    if (String(arg) === '[object Object]') {
      min = arg['min'];
      max = arg['max'];
    } else {
      max = arg;
    }
    var fn = function length (value) {
      if (_.missing(value)) return;
      if ((max && value.length > max) || (min && value.length < min)) {
        return { name: 'length', value: value, max: max, min: min };
      }
    }
    fn.meta = { name: 'length', max: max, min: min };
    return fn;
  },
  Serializable: function serializableF (serializer) {
    var fn = function serializable (value) {
      if (_.missing(value)) return;
      var string = serializer(value);
      if (!string) return { name: 'serializable', value: value };
    }
    fn.meta = { name: 'serializable', serializer: serializer };
    return fn;
  },
  Regexp: function regexpF (re) {
    if (!_.isRegExp(re)) throw new Error('Regexp validator given an invalid regexp');
    
    return function regexp (value) {
      if (!value) return;
      if (!re.test(value)) {
        return { name: 'regexp', value: value, regexp: re }
      }
    }
  },
  Email: function email (value) {
    if (!arguments.length) return arguments.callee;
    var re = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
    var err = Base.Validators.Regexp(re)(value);
    if (err) { err.name = 'email'; return err }
  },
  
  // `validators` is an object where each property is a potential array of
  //  validation functions (including, maybe, a call to this method)
  Doc: function docF (validators) {
    var fn = function (doc, attr, debug) {
      var errors = [];
      doc = doc || {};
      attr = attr || {}
      
      function arrayify (o) { if (_.isArray(o)) return o; else return [o] };
      
      _.each(validators, function (valset, field) {
        var err = null
          , value = doc[field]
        
        // turn validators into an array if it isn't one
        valset = arrayify(valset);
        
        // run all the validation for this field
        _.each(valset, function (validator) {
          
          // if there's already an error, don't bother           
          if (err) return;
          err = validator(value, attr, (field=='badge'));
      
        });
        
        // set the correct field on the error
        if (err) err.field = field;
        
        // jam it into the array with the rest of 'em
        errors.push(err);
      });
      
      // throw out any undefined or nulls that snuck in there
      errors = _.reject(errors, _.missing);
      
      if (errors.length) {
        return { name: 'doc', errors: errors }
      };
    }
    fn.meta = { name : 'doc' };
    return fn;
  },
  
  Type: {
    Enum: function (valid) {
      var fn = function (value) {  
        if (_.missing(value)) return;
        if (!_.include(valid, value)) {
          return { name: 'type.enum', value: value };
        }
      }
      fn.meta = { name: 'type.enum', valid: valid};
      return fn;
    },
    Number: function (value) {
      if (!arguments.length) return arguments.callee;
      if (_.missing(value)) return;
      if (Number(value) != value) return { name: 'type.number', value: value };
    },
    String: function (value) {
      if (!arguments.length) return arguments.callee;
      if (_.missing(value)) return;
      if (!_.isString(value)) return { name: 'type.string', value: value };
    },
    Object: function (value) {
      if (!arguments.length) return arguments.callee;
      if (_.missing(value)) return;
      if (String(value) !== '[object Object]' || _.isString(value)) {
        return { name: 'type.object', value: value };
      }
    }
  }
}

Base.Validators.Require.when = function (opt) {
  var field = opt['field']
    , fieldValue = opt['is'];
  return function (value, attrs) {
    if (attrs[field] && attrs[field] === fieldValue && _.missing(value)) {
      return _.extend({ name: 'required-when', value: value }, opt);
    }
  }
};

Base.Validators.Require.all = function (obj) {
  var req = Base.Validators.Require;
  _.each(obj, function (v, k) {
    if (v && v.meta && v.meta.name === 'doc') return;
    if (_.isArray(v) && v[0] !== req) v.unshift(req)
    if (_.isFunction(v)) obj[k] = [req, v]
    if (_.missing(v)) obj[k] = req
  })
  return obj;
};

module.exports = Base.Validators;