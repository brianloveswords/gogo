var util = require('util');
module.exports = function (driver) {
  return require(util.format('./field.%s.js', driver));
};
