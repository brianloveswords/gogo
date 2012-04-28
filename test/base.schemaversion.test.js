var vows = require('vows');
var assert = require('assert');
var should = require('should');

var common = require('./common.js');
var Gogo = require('..')(common.conf);
var Base = Gogo.Base;
var client = Gogo.client

common.prepareTesting(client);
vows.describe('Schema Version table').addBatch({
  'Base#updateSchemaVersion': {
    'when no version is set' : {
      topic : function () {
        var M = Base.extend({
          table: 'schema_ver_test',
          schema: { id: Gogo.Field.Id, name: Gogo.Field.String }
        });
        M.updateSchemaVersion(this.callback);
      },
      'creates or updates the table' : {
        topic : function () {
          client.query('select * from `'+Base.SCHEMA_TABLE+'` where `table` = "schema_ver_test"', this.callback)
        },
        'with the version set to `0000`' : function (err, res) {
          assert.ifError(err);
          assert.ok(typeof res !== Error);
          res.length.should.equal(1);
          res[0].table.should.equal('schema_ver_test');
          res[0].version.should.equal('0000');
        },
      }
    },
    'when a version is set in the schema def' : {
      topic : function () {
        var M = Base.extend({
          version: '0621',
          table: 'schema_ver_specific',
          schema: { id: Gogo.Field.Id, name: Gogo.Field.String }
        });
        M.updateSchemaVersion(this.callback);
      },
      'updates the table' : {
        topic : function () {
          client.query('select * from `'+Base.SCHEMA_TABLE+'` where `table` = "schema_ver_specific"', this.callback)
        },
        'with the version set to `0621`' : function (err, res) {
          assert.ifError(err);
          assert.ok(typeof res !== Error);
          res.length.should.equal(1);
          res[0].table.should.equal('schema_ver_specific');
          res[0].version.should.equal('0621');
        },
      }
    },
    'when a version is passed to the method' : {
      topic : function () {
        var M = Base.extend({
          table: 'schema_ver_passed_in',
          schema: { id: Gogo.Field.Id, name: Gogo.Field.String }
        });
        M.updateSchemaVersion('1234', this.callback);
      },
      'updates the table' : {
        topic : function () {
          client.query('select * from `'+Base.SCHEMA_TABLE+'` where `table` = "schema_ver_passed_in"', this.callback)
        },
        'with the version set to `0621`' : function (err, res) {
          assert.ifError(err);
          assert.ok(typeof res !== Error);
          res.length.should.equal(1);
          res[0].table.should.equal('schema_ver_passed_in');
          res[0].version.should.equal('1234');
        },
      }
    }
  },
  'Base#getSchemaVersion': {
    'given a created model with a specific version': {
      topic : function () {
        var self = this;
        var M = Base.extend({
          table: 'schema_ver_test2',
          version: '1000',
          schema: { id: Gogo.Field.Id, name: Gogo.Field.String }
        });
        M.updateSchemaVersion(function (err) {
          if (err) throw err;
          M.getSchemaVersion(self.callback);
        });
      },
      'should get the schema version' : function (err, version) {
        assert.ifError(err);
        version.should.equal('1000');
      },
    },
    'given a created model without a version': {
      topic : function () {
        var self = this;
        var M = Base.extend({
          table: 'schema_ver_test3',
          schema: { id: Gogo.Field.Id, name: Gogo.Field.String }
        });
        M.updateSchemaVersion(function (err) {
          if (err) throw err;
          M.getSchemaVersion(self.callback);
        });
      },
      'should get the default version' : function (err, version) {
        assert.ifError(err);
        version.should.equal('0000');
      },
    },
    'given an uncreated model': {
      topic : function () {
        var self = this;
        var M = Base.extend({
          table: 'schema_ver_test3',
          schema: { id: Gogo.Field.Id, name: Gogo.Field.String }
        });
        M.getSchemaVersion(self.callback);
      },
      'should get the default version' : function (err, version) {
        assert.ifError(err);
        should.not.exist(version);
      },
    }
  }
}).export(module);
