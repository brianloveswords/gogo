var _ = require('underscore')

_.mixin({
  isObject: function (value) {
    return (String(value) === '[object Object]' && !_.isString(value))
  },
  missing : function (value){
    return (undefined === value || null === value);
  },
  getter: function (o) { return function (v) { return o[v] } },
  zippo: function (a1, a2) {
    var a1a2 = _.zip(a1, a2)
    , oneFieldTwoValue = function(m, a) { m[a[0]] = a[1]; return m }
    return _.reduce(a1a2, oneFieldTwoValue, {});
  },
})
  
// string helpers
// --------------
_.mixin({
  strwrp: function (c, str) { return (str ? c + str + c : undefined )},
  sstrwrp: function (l, r, str) { return (str ? l + str + r : undefined) }
})

// string methods
// --------------
_.mixin({
  paren: _.sstrwrp.bind(null, '(', ')'),
  quote: _.strwrp.bind(null, '"'),
  squote: _.strwrp.bind(null, "'"),
  backtick: _.strwrp.bind(null, "`"),
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
