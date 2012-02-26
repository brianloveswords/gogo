var _ = require('underscore')
  , vows = require('vows')
  , assert = require('assert')
  , should = require('should')
  
  , common = require('./common.js')
  , Hyde = require('..')(common.conf)
  , Base = Hyde.Base
  , client = Hyde.client

common.prepareTesting(client);
vows.describe('testing migrations').addBatch({
  'Test some migrations, yo' : {
    topic: function () {
      var User = Base.extend({
        table: 'user',
        schema: { id: Base.Schema.Id }
      });
      
      return User;
    },
    // 'getCreateTable': function () {
    //   var t = Base.Migration(User);
    // },
    'getAlterSql': {
      topic: function (User) { return User.Migration(User) },
      'add' : function (t) {
        var sql = t.getAlterSql({ yam: Base.Schema.Text }, 'add');
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
        sql[0].should.equal('ALTER TABLE `user` DROP `words`');
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
      topic: function (User) {
        var t = Base.Migration(User);
        t.addColumn({emperor: Base.Schema.String({default: 'x'})}, this.callback);
      },
      'does what it says on the tin' : function (err, result) {
        assert.ifError(err);
        result.affectedRows.should.equal(1);
      },
    }
  }
}).export(module);

