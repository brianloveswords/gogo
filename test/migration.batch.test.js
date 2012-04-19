var _ = require('underscore');
var vows = require('vows');
var assert = require('assert');
var should = require('should');
var fmap = require('functools').map;
var common = require('./common.js');
var Gogo = require('..')(common.conf);
var client = Gogo.client;

common.prepareTesting(client);

var TestModel = Gogo.Base.extend({
  table: 'batch_migration_test',
  version: '100',
  schema: { id: Gogo.Field.Id }
});

var suite = vows.describe('awesome migration batch testing');
suite.addBatch({
  'A migration set': {
    topic : function () {
      var m = TestModel.Migration({
        '001: this should not run': {
          up: function (t) { assert.ok(false) },
          down: false,
        },
        '101: add name column': {
          up: function (t) { t.addColumn({ name: Gogo.Field.Text }) },
          down: function (t) { t.dropColumn('name') }
        },
        '102: add email column': {
          up: function (t) { t.addColumn({ email: Gogo.Field.Varchar(140) }) },
          down: function (t) { t.dropColumn('email') }
        },
        '103: rename email to electronicmail': {
          up: function (t) { t.renameColumn({ email: 'electronicmail' }) },
          down: function (t) { t.renameColumn({ electronicmail: 'email' }) }
        }
      });
      m.makeTable(this.callback);
    },
    'can be run as a batch': {
      topic : function (m) {
        m.runBatch(this.callback);
      },
      'without erroring' : function (err, result) {
        assert.ifError(err);
        assert.ok(!(result instanceof Error));
      },
      'and the schema version': {
        topic: function (a) {
          TestModel.getSchemaVersion(this.callback)
        },
        'should be 103' : function (version) {
          version.should.equal('103: rename email to electronicmail');
        },
      }
    }
  }
})

suite.export(module);