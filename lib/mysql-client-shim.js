var mysql = require('mysql')
  , _ = require('underscore');

// Query Convenience Methods
// =========================
mysql.Client.prototype.insert = function (table, fields, callback) {
  var keys = Object.keys(fields)
    , values = keys.map(function (k) { return fields[k] })
    , placeholders = keys.map(function () { return '?' });
  var querystring
    = 'INSERT INTO `'+table+'` '
    + '('+keys.join(', ')+') '
    + 'VALUES '
    + '('+placeholders.join(', ')+')';

  this.query(querystring, values, callback);
}

mysql.Client.prototype.upsert = function (table, fields, callback) {
  if (!fields['id']) return this.insert(table, fields, callback);
  var keys = Object.keys(fields)
    , values = keys.map(function (k) { return fields[k] })
  var querystring
    = 'UPDATE `'+table+'` SET '
    + keys.map(function (k) { return k + ' = ?'}).join(', ')
    + ' WHERE id = ?'

  values.push(fields['id']);
  this.query(querystring, values, callback)
}

mysql.Client.prototype.select = function (fields) {
  var F = Object.create(mysql.Client.prototype)
    , client = this;
  F.qs = [];
  F.values = [];
  F.qs.str = function () { return this.join(' '); }
  
  function NormalStatement (cmd) {
    return function (input) {
      F.qs.push(cmd);
      if (_.isString(input) || _.isArray(input)) {
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
    }
  }
  
  function CompareStatement (cmd) {
    return function (comparison) {
      var rest = [].slice.call(arguments, 1)
        , values = this.values
        , qs = this.qs
      qs.push(cmd, comparison);
      if (rest.length) {
        if (rest.length === 1 && _.isArray(rest[0])) rest = rest[0];
        values.push.apply(values, rest);
      }
      return this;
    }
  }
  
  function BooleanStatement(cmd) {
   return function () { F.qs.push(cmd); return this; }
  }
  
  F.select = NormalStatement('SELECT');
  F.from = NormalStatement('FROM');
  F.join = function (type, tables) {
    var cmd = [];
    if (type) cmd.push(type.toUpperCase());
    cmd.push('JOIN')
    return NormalStatement(cmd.join(' '))(tables);
  }
  F.innerJoin = F.join.bind(F, 'inner')
  F.outerJoin = F.join.bind(F, 'outer')
  F.rightJoin = F.join.bind(F, 'right')
  F.leftJoin = F.join.bind(F, 'left')
  F.crossJoin = F.join.bind(F, 'cross')
  F.on = CompareStatement('ON');
  F.where = CompareStatement('WHERE');
  F.and = CompareStatement('AND');
  F.or = CompareStatement('OR');
  
  F.limit = function (obj) {
    var argv = [].slice.call(arguments);
    F.qs.push('LIMIT')
    if (obj.hasOwnProperty('count') || obj.hasOwnProperty('offset')) {
      argv = [];
      if(obj['offset']) argv.push(obj['offset']);
      argv.push(obj['count'] || 0);
    }
    F.qs.push(argv.join(','));
    return this;
  }
  
  F.go = function (callback) {  
    var queryString = F.qs.join(' ');
    return client.query(queryString, this.values, callback);
  }
  
  F.select(fields);
  return F;
}
