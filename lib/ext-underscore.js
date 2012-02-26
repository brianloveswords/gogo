var _ = require('underscore')
_.$ = _.compose;

_.mixin({
  isObject: function (value) {
    return (String(value) === '[object Object]' && !_.isString(value))
  },
  missing : function (value){
    return (undefined === value || null === value);
  },
  // given a field, return a function that gets that takes an
  // object and get the value of the field
  getv: function (f) { return function (o) { return o ? o[f] : undefined } },
  // given an object, return a function that takes an objec and
  // returns the value of the field.
  getter: function (o) { return function (f) { return o[f] } },
  // takes a function, returns a function that processes arguments in reverse
  frev: function (fn) { return function () {
    return fn.apply(fn, [].slice.call(arguments).reverse());
  }},
  swap: function (fn) { return function (a, b) { return fn(b, a) } },
  // generate a function that is the boolean opposite of the given function
  not: function (fn) { return function () { return !fn.apply(fn, arguments) } },
  // generate a function that gets the `n`th element of an array
  xth: function (n) { return function (a) { return a[n] } },
  // takes an object, returns [ [ field, value ], ...] 
  ozip: function (o) { return _.map(o, _.swap(Array)); },
  // reducer: takes [ field, val ], adds field : value to memo
  assoc: function (h, a) { h[a[0]] = a[1]; return h; },
  // the inverse of ozip: takes [ [ field, value ], ...],
  // returns { field: value, ... }
  zippo: function (a) { return _.reduce(a, _.assoc, {}) },
  // takes field arr, value arr, returns { field: value, ... }
  zippo2: function (a1, a2) { return _.zippo(_.zip(a1, a2)) },
  // root canal on an object.
  extract: function (o, path) {
    var memo = function (m, p) { return _.getv(p)(m) }
    return _.reduce(path, memo, o);
  },
  callWith: function (fns, vals) {
    var caller = function (fn, key) { return [key, fn(vals[key])]; }
    return _.zippo(_.map(fns, caller))
  }})
  
// string helpers
// --------------
_.mixin({
  strwrap: function (c) {
    return function (str) { return (str ? c + str + c : undefined ) }
  },
  sstrwrap: function (l, r) {
    return function (str) { return (str ? l + str + r : undefined) }
  }
})


// string methods
// --------------
_.mixin({
  paren: _.sstrwrap('(', ')'),
  quote: _.strwrap('"'),
  squote: _.strwrap("'"),
  backtick: _.strwrap("`"),
  chomp: function (str) { return str.replace(/\s*$/, '') },
  upcase: function (str) { return str.toUpperCase() },
  downcase: function (str) { return str.toLowerCase() },
  strjoin: function (arr) {
    if (arguments.length > 1) arr = [].slice.call(arguments);
    arr = _.reject(arr, _.missing);
    arr = _.map(arr, function (v) {
      if (_.isArray(v)) return sbuild(v);
      return v;
    });
    return arr.join(' ');
  },
  placeholders: function (arr) { return _.map(arr, function(){ return '?' }) }
});
