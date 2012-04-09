var _ = require('underscore')
  , vows = require('vows')
  , assert = require('assert')
  , should = require('should')
  , fmap = require('functools').map
  
  , common = require('./common.js')
  , Hyde = require('..')(common.conf)
  , Base = Hyde.Base
  , client = Hyde.client

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
};

function binder(o) { _.bindAll(o); }
_.map(_.values(Models), binder);
      

vows.describe('testing migrations').addBatch({
  'Test some migrations, yo' : {
    topic: function () {
      var maker = function (M, callback) { M.makeTable(callback) }
      
      fmap.async(maker, _.values(Models), function (err, res) {
        if (err) throw err;
        this.callback(null, Models);
      }.bind(this));
    
    
    },
    // 'getCreateTable': function () {
    //   var t = Base.Migration(User);
    // },
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
      'simple like' : {
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
          var t = Base.Migration(M.User);
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
          Hyde.client.query('show create table volatile', this.callback)
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
          Hyde.client.query('show create table volatile', this.callback)
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
          Hyde.client.query('show create table volatile', this.callback)
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
}).export(module);

