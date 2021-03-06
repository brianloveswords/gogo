// create a new object with raw underscore as it's prototype
var _ = Object.create(require('underscore'), {});

function strwrap(c) {
  return function (str) {
    return (str ? c + str + c : undefined);
  };
}
function sstrwrap(l, r) {
  return function (str) {
    return (str ? l + str + r : undefined);
  };
}

function partial(fun, args) {
  for (var i = 0; i < args.length; i++)
    fun = _.bind(fun, null, args[i] === undefined ? null : args[i]);
  return fun;
}
// this takes advantage of ES5 bind's awesome ability to do partial application
function curry(fn, obj) {
  // create a local copy of the function. don't apply anything yet
  // optionally bind an object to the `this` of the function.
  var newFunction = _.bind(fn, (obj || null));

  // curried functions always take one argument
  return function () {
    // create another copy of the function with the arguments applied
    var me = _.partial(newFunction, arguments);

    // take advantage of the fact that bind changes the method signature:
    // if we have no arguments left, run the method
    if (!me.length) return me();

    // otherwise, curry again and return that.
    return curry(me);
  };
}

_.extend(_, {
  $ : _.compose,
  curry: curry,
  partial: partial,

  // turn a thing into an array (or leave it an array)
  arrayify: function (o) { return _.isArray(o) ? o : [o] },
  
  // boolean: do our best to figure out if something is a true object
  isObject: function (value) {
    return (String(value) === '[object Object]' && !_.isString(value));
  },

  // boolean: true if null|undefined, false otherwise
  isMissing: function (value) {
    return (undefined === value || null === value);
  },

  // takes a field, returns a function that takes an object and returns the
  // value of the field or undefined if either object or field is missing
  getv: curry(function (f, o) {
    return o ? o[f] : undefined;
  }),

  // perform a root canal on an object. depends on getv
  extract: function (o, path) {
    function iterator(m, p) { return _.getv(p)(m); }
    return _.reduce(path, iterator, o);
  },

  // takes an object, return a function that takes an object and
  // returns the value of the field.
  get: curry(function (o, f) { return o[f]; }),

  // takes a function, returns a function that processes arguments in reverse
  frev: function (fn) {
    return function () {
      return fn.apply(fn, _.tail(arguments, 0).reverse());
    };
  },

  // takes a function with signature (a, b),
  // returns a new function with the signature (b, a)
  swap: function (fn) {
    return function (a, b) {
      return fn(b, a);
    };
  },

  // takes a function that returns true given a certain value,
  // returns a function that returns false given that same value
  not: function (fn) {
    return function () {
      return !fn.apply(fn, arguments);
    };
  },

  // takes a number `i`,
  // returns a function that gets a[i]
  nth: function (i) {
    return function (a) {
      return a[i];
    };
  },

  // takes an object, returns [ [ field, value ], ...]
  seq: function (o) { return _.map(o, _.swap(Array)); },

  // iterator: takes [ field, val ], adds field : value to memo
  assoc: function (h, a) { h[a[0]] = a[1]; return h; },

  // inverse of seq: takes [ [ field, value ], ...],
  // returns { field: value, ... }
  zippo: function (a) { return _.reduce(a, _.assoc, {}); },

  // takes field arr, value arr, returns { field: value, ... }
  zipmap: function (a1, a2) { return _.zippo(_.zip(a1, a2)); },

  // push only defined elements to the array
  push: function (a) {
    var elements = _.reject(_.rest(arguments), _.isMissing);
    return a.push.apply(a, elements);
  },

  // takes { key: [ Function ] }, { key: value },
  // returns { key: Function (value) }
  callmap: function (fns, vals) {
    function caller(fn, key) { return [key, fn(vals[key])]; }
    return _.zippo(_.map(fns, caller));
  },

  strwrap: strwrap,
  sstrwrap: sstrwrap,
  paren: sstrwrap('(', ')'),
  quote: strwrap('"'),
  squote: strwrap("'"),
  backtick: strwrap("`"),
  chomp: function (str, search) {
    // naive, will break if search is not regex escaped
    search = search ? new RegExp(search + '$') : /\s*$/;
    return str.replace(search, '');
  },
  upcase: function (str) { return str.toUpperCase(); },
  downcase: function (str) { return str.toLowerCase(); },
  strjoin: function (arr) {
    if (arguments.length > 1) arr = _.tail(arguments, 0);
    arr = _.reject(_.flatten(arr), _.isMissing);
    return arr.join(' ');
  },
  placeholders: function (arr) { return _.map(arr, function () { return '?'; }); }
});

// export augmented underscore
module.exports = _;