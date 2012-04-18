var _ = require('underscore');
var vows = require('vows');
var assert = require('assert');
var should = require('should');
var fmap = require('functools').map;
  
var common = require('./common.js');
var Gogo = require('..')(common.conf);
var Base = Gogo.Base;
var client = Gogo.client;

common.prepareTesting(client);

var Models = {
  Volatile: Base.extend({
    table: 'volatile',
    schema: { id: Base.Schema.Id, drop: Base.Schema.Number, rename: Base.Schema.Number }
  }),
  
  User: Base.extend({
    table: 'user',
    schema: { id: Base.Schema.Id }
  }),
  
  Stuff: Base.extend({
    table: 'stuff',
    schema: { id: Base.Schema.Id }
  }),

  Multiple: Base.extend({
    table: 'multimigrate',
    schema: { id: Base.Schema.Id }
  })
};

function binder(o) { _.bindAll(o); }
_.map(_.values(Models), binder);
      

vows.describe('testing migrations').addBatch({
  'Test the migration helpers' : {
    topic: function () {
      function maker (M, callback) { M.makeTable(callback); }
      
      fmap.async(maker, _.values(Models), function (err, res) {
        if (err) throw err;
        this.callback(null, Models);
      }.bind(this));
    },
    'getAlterSql': {
      topic: function (M) { return M.User.Migration() },
      'add' : function (t) {
        var sql = t.getAlterSql({ yam: Base.Schema.String() }, 'add');
        sql[0].should.equal('ALTER TABLE `user` ADD `yam` TEXT');
      },
      'change': {
        'takes a spec' :function (t) {
          var sql = t.getAlterSql({ beets: Base.Schema.Number() }, 'change');
          sql[0].should.equal('ALTER TABLE `user` CHANGE `beets` INT');
        },
        'takes a straaaaang': function (t) {
          var sql = t.getAlterSql({ clams: 'TASTY CLAMS' }, 'change');
          sql[0].should.equal('ALTER TABLE `user` CHANGE `clams` TASTY CLAMS');
        },
        'handles unique intelligently': function (t) {
          var sql = t.getAlterSql({ clams: Base.Schema.Text({unique: 128}) }, 'change');
          sql.should.have.lengthOf(2);
          sql[1].should.equal('ALTER TABLE `user` ADD UNIQUE KEY `clams` (`clams` (128))');
        }
      },
      'drop': function (t) {
        var sql = t.getAlterSql('words', 'drop');
        sql[0].should.equal('ALTER TABLE `user` DROP COLUMN `words`');
      },
      'engine': function (t) {
        var sql = t.getAlterSql('MyISAM', 'engine');
        sql[0].should.equal('ALTER TABLE `user` ENGINE = MyISAM');
      },
      'add key': function (t) {
        var sql = t.getAlterSql({yeah: { type: 'unique' }}, 'add key')
        sql[0].should.equal('ALTER TABLE `user` ADD UNIQUE KEY `yeah` (`yeah`)');

        sql = t.getAlterSql({yeah: { type: 'unique', name: 'yo' }}, 'add key')
        sql[0].should.equal('ALTER TABLE `user` ADD UNIQUE KEY `yeah` (`yo`)');

        sql = t.getAlterSql({yeah: { type: 'unique', name: 'yo', length: 128 }}, 'add key')
        sql[0].should.equal('ALTER TABLE `user` ADD UNIQUE KEY `yeah` (`yo` (128))');
      }
    },
    'addColumn' : {
      'real simple like' : {
        topic: function (M) {
          var t = M.User.Migration();

          var cb_addCol = function (err, result) {
            if (err) return this.callback(err);
            Base.client.query('show create table user', this.callback)
          }.bind(this);

          var spec = { emperor: Base.Schema.String({
            type: 'varchar',length: 255,unique: 128,default: 'x'
          })}

          try {
            t.addColumn(spec, cb_addCol);
          } catch (err) {
            this.callback(err);
          }
        },
        'does what it says on the tin' : function (err, result) {
          assert.ifError(err);
          var sql = result.pop()['Create Table'];
          sql.should.match(/unique key `emperor` \(`emperor`\(128\)\)/i);
          sql.should.match(/`emperor` varchar\(255\).*default 'x'/i);
        }
      },
      'more complex addColumn' : {
        topic: function (M) {
          var t = M.User.Migration();
          _.bindAll(t);


          var adder = function (spec, callback) {
            t.addColumn(spec, callback);
          }

          var cb_addCol = function (err, result) {
            if (err) return this.callback(err);
            Base.client.query('show create table user', this.callback)
          }.bind(this);

          var specs =[
            { sss: Base.Schema.String({type: 'char', length: 128, unique: true, default: 'y'})},
            { nnn: Base.Schema.Number() },
            { eee: Base.Schema.Enum(['one', 'two']) },
            { stuff_id: Base.Schema.Foreign({model: M.Stuff, field: 'id'})}
          ]
          try {
            fmap.async(adder, specs, cb_addCol);
          } catch (err) {
            this.callback(err);
          }
        },

        'adds all the fields fine' : function (err, result) {
          var sql = result[0]['Create Table'];
          sql.should.match(/`sss` char\(128\).*default 'y'/i);
          sql.should.match(/`nnn` int\(\d+\).*default null/i);
          sql.should.match(/`eee` enum\('one','two'\).*default null/i);
          sql.should.match(/`stuff_id` (big)?int\(\d+\).*default null/i);
        },

        'adds all the keys fine' : function (err, result) {
          var sql = result[0]['Create Table'];
          sql.should.match(/unique key `sss` \(`sss`\)/i);
          sql.should.match(/key `stuff_fkey` \(`stuff_id`\)/i);
          sql.should.match(/constraint `user_ibfk_1` foreign key \(`stuff_id`\) references `stuff` \(`id`\)/i);
        }
      }
    },
    'dropColumn' : {
      topic: function (M) {
        var t = M.Volatile.Migration();
        var cb = function (err, result) {
          if (err) return this.callback(err);
          Gogo.client.query('show create table volatile', this.callback)
        }.bind(this);

        try {
          t.dropColumn('drop', cb);
        } catch (error) {
          this.callback(error);
        }
      },
      'should drop the damn column': function (err, result) {
        assert.ifError(err);
        result.should.not.match(/drop/);
      }
    },
    'renameColumn' : {
      topic: function (M) {
        var t = M.Volatile.Migration();
        var cb = function (err, result) {
          if (err) return this.callback(err);
          Gogo.client.query('show create table volatile', this.callback)
        }.bind(this);

        try {
          t.renameColumn('rename', 'lol', cb);
        } catch (error) {
          this.callback(error);
        }
      },
      'should rename the column': function (err, result) {
        assert.ifError(err);
        var sql = result[0]['Create Table'];
        sql.should.not.match(/rename/);
      }
    },
    'executeSql' : {
      topic: function (M) {
        var t = M.Volatile.Migration();
        var cb = function (err, result) {
          if (err) return this.callback(err);
          Gogo.client.query('show create table volatile', this.callback)
        }.bind(this);

        try {
          t.executeSql('alter table `volatile` change column `id` `rad` int auto_increment not null', cb);
        } catch (error) {
          this.callback(error);
        }
      },
      'should rename the column': function (err, result) {
        assert.ifError(err);
        var sql = result[0]['Create Table'];
        sql.should.not.match(/`id`/);
      }
    }
  }
})
  .addBatch({
  'single migration testing': {
    topic: function () {
      Models.Multiple.makeTable(this.callback);
    },
    'a migration set with an up and a down' : {
      topic : function (M) {
        return M.Migration({
          '0001 : add a `name` field' : {
            up: function (t) {
              t.addColumn({ name: Base.Schema.String });
              t.addColumn({ radness: Base.Schema.Number });
            },
            down: function (t) {
              t.dropColumn('name');
              t.dropColumn('radness');
            }
          }
        })
      },
      'can `up` a specific migration' : {
        topic: function (runner) {
          runner.up('0001', this.callback);
        },
        'without error': function (err, res) {
          assert.ifError(err);
          assert.ok(!(res instanceof Error))
        },
        'ask for the schema version' : {
          topic: function () {
            Models.Multiple.getSchemaVersion(this.callback);
          },
          'and get the new one back' : function (err, version) {
            version.should.equal('0001');
          },
        },
        'get the columns' : {
          topic: function () {
            client.query('show columns in multimigrate', this.callback);
          },
          'and find the new columns' : function (err, results) {
            assert.ok( _.any(results, function (c) { return c.Field == 'name' }) );
            assert.ok( _.any(results, function (c) { return c.Field == 'radness' }) );
          },
          'then run the `down` migration' : {
            topic : function (x, y, z, runner) {
              runner.down('0001', this.callback);
            },
            'ask for the schema version' : {
              topic: function () {
                Models.Multiple.getSchemaVersion(this.callback);
              },
              'and get the previous one back' : function (err, version) {
                version.should.equal('0000');
              },
            },
            'get the columns' : {
              topic: function () {
                client.query('show columns in multimigrate', this.callback);
              },
              'and not find the new columns' : function (err, results) {
                assert.ok( !_.any(results, function (c) { return c.Field == 'name' }) );
                assert.ok( !_.any(results, function (c) { return c.Field == 'radness' }) );
              },
            }
          }
        }
      }
    }
  }
})
  .export(module);

