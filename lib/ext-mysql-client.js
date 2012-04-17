var _ = require('./ext-underscore');
var mysql = require('mysql');
var clientProto = mysql.Client.prototype;

// Query Convenience Methods
// =========================
clientProto.insert = function insert (table, fields, callback) {
  var keys = _.keys(fields);
  var values = _.values(fields);
  var placeholders = _.placeholders(fields);

  var qs = _.strjoin([
    _.upcase('insert into'),
    _.backtick(table),
    _.paren(_.map(keys, _.backtick).join()),
    _.upcase('values'),
    _.paren(placeholders.join())
  ]);

  this.query(qs, values, callback);
};

clientProto.update = function update (table, fields, where, callback) {
  var keys = _.keys(fields);
  var values = _.values(fields);
  var preparedSetters = _.map(keys, function(k){
    return _.backtick(k) + ' = ?';
  }).join();
  
  var qs = [
    _.upcase('update'),
    _.backtick(table),
    _.upcase('set'),
    preparedSetters,
    _.upcase('where')
  ];

  _.keys(where).forEach(function (k) {
    qs.push( _.backtick(k) + ' = ?' );
    values.push(where[k]);
  });
  
  this.query(qs.join(' '), values, callback);
};

// #TODO: allow upserting based on fields other than `id`
clientProto.upsert = function upsert (table, fields, callback) {
  if (!fields['id']) return this.insert(table, fields, callback);
  this.update(table, fields, { id: fields['id'] }, callback);
};

clientProto.select = function (fields) {
  var F = Object.create(clientProto);
  var client = this;
  F.qs = [];
  F.values = [];
  F.qs.str = function () {
    return this.join(' ');
  };

  function NormalStatement (cmd) {
    return function (input) {
      F.qs.push(cmd);
      if ( _.isString(input) || _.isArray(input) ) {
        F.qs.push(input+'');
      }
      else {
        var items = [];
        _.each(input, function (value, key) {
          items.push(key + ' AS ' + value);
        });
        F.qs.push(items.join(','));
      }
      return F;
    };
  }

  function CompareStatement (cmd) {
    return function (comparison) {
      var rest = [].slice.call(arguments, 1);
      var values = this.values;
      var qs = this.qs;
      qs.push(cmd, comparison);
      if (rest.length) {
        if (rest.length === 1 && _.isArray(rest[0])) rest = rest[0];
        values.push.apply(values, rest);
      }
      return this;
    };
  }

  F.select = NormalStatement('SELECT');
  F.from = NormalStatement('FROM');
  F.join = function join (type, tables) {
    var cmd = [];
    if (type) cmd.push(type.toUpperCase());
    cmd.push('JOIN');
    return NormalStatement(cmd.join(' '))(tables);
  };
  F.innerJoin = F.join.bind(F, 'inner');
  F.outerJoin = F.join.bind(F, 'outer');
  F.rightJoin = F.join.bind(F, 'right');
  F.leftJoin = F.join.bind(F, 'left');
  F.crossJoin = F.join.bind(F, 'cross');
  F.on = CompareStatement('ON');
  F.where = CompareStatement('WHERE');
  F.and = CompareStatement('AND');
  F.or = CompareStatement('OR');

  F.limit = function limit (obj) {
    var argv = [].slice.call(arguments);
    F.qs.push('LIMIT');
    if (obj.hasOwnProperty('count') || obj.hasOwnProperty('offset')) {
      argv = [];
      if(obj['offset']) argv.push(obj['offset']);
      argv.push(obj['count'] || 0);
    }
    F.qs.push(argv.join(','));
    return this;
  };

  F.go = function go (callback) {
    var queryString = F.qs.join(' ');
    return client.query(queryString, this.values, callback);
  };

  F.select(fields);
  return F;
};
