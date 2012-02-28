var _ = require('underscore')
  , vows = require('vows')
  , assert = require('assert')
  , should = require('should')
  , Hyde = require('..')
  , Base = Hyde.Base

vows.describe('schema helpers').addBatch({
  'schema helpers': {
    topic: Hyde.Schema,
    'Hyde.Schema.Id' : function (f) {
      var spec = f.Id()('id');
      assert.include(spec, 'sql');
      spec.sql.should.equal('BIGINT AUTO_INCREMENT');
      spec.keysql.should.equal('PRIMARY KEY (`id`)');
      assert.include(spec, 'validators');
      assert.include(spec.validators, Hyde.Validators.Type.Number);
    },
    'Hyde.Schema.Number' : {
      'standard fare': function (s) {
        var spec = s.Number()();
            spec.sql.should.equal('INT');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.Number);
      },
      'big ones': function (s) {
        var spec = s.Number('big')();
        spec.sql.should.equal('BIGINT');
      },
      'small ones': function (s) {
        var spec = s.Number('small')();
        spec.sql.should.equal('SMALLINT');
      },
      'floats': function (s) {
        var spec = s.Number('float')();
        spec.sql.should.equal('FLOAT');
      },
      'doubles': function (s) {
        var spec = s.Number('dOuBlE')();
        spec.sql.should.equal('DOUBLE');
        
        spec = s.Number({type: 'dOuBlE'})();
        spec.sql.should.equal('DOUBLE');
      },
      'signed/unsigned': function (s) {
        var spec = s.Number('small', { unsigned: true })();
        spec.sql.should.equal('SMALLINT UNSIGNED');
        
        spec = s.Number('small', { signed: false })();
        spec.sql.should.equal('SMALLINT UNSIGNED');
        
        spec = s.Number('small', { signed: true })();
        spec.sql.should.equal('SMALLINT SIGNED');
      },
      'unique': function (s) {
        var spec = s.Number('small', { signed: false, unique: true })('w');
        spec.sql.should.equal('SMALLINT UNSIGNED');
        spec.keysql.should.equal('UNIQUE KEY `w` (`w`)');
      },
      'null/not null': function (s) {
        var spec = s.Number('small', { null: false })();
        spec.sql.should.equal('SMALLINT NOT NULL');
            // #TODO: file bug with should.js about should.include not supporting objects
        spec.validators.should.include(Hyde.Validators.Require);
        
        spec = s.Number('small', { required: true })();
        spec.sql.should.equal('SMALLINT NOT NULL');
        spec.validators.should.include(Hyde.Validators.Require);
      },
      'default': function (s) {
        var spec = s.Number({ default: 10 })();
        spec.sql.should.equal('INT DEFAULT 10');
      },
    },
    'Hyde.Schema.Float' : {
      'standard fare': function (s) {
        var spec = s.Float()('abv');
        spec.sql.should.equal('FLOAT');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.Number);
      },
    },
    'Hyde.Schema.Double' : {
      'standard fare': function (s) {
        var spec = s.Double()('abv');
        spec.sql.should.equal('DOUBLE');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.Number);
      },
    },
    'Hyde.Schema.Blob' : {
      'standard fare': function (s) {
        var spec = s.Blob({default: 'ya'})('the blob');
        spec.sql.should.equal('BLOB DEFAULT "ya"');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.String);
      },
    },
    'Hyde.Schema.Varchar' : {
      'standard fare': function (s) {
        var spec = s.Varchar(128)('word');
        spec.sql.should.equal('VARCHAR(128)');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.String);
      },
      'with options': function (s) {
        var spec = s.Varchar({length: 128, default: 'yep'})('word');
        spec.sql.should.equal('VARCHAR(128) DEFAULT "yep"');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.String);
      },
      'with unique': function (s) {
        var spec = s.Varchar({length: 128, unique: 128})('word');
        spec.sql.should.equal('VARCHAR(128)');
        spec.keysql.should.equal('UNIQUE KEY `word` (`word` (128))');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.String);
      },
    },
    'Hyde.Schema.Char' : {
      'char standard fare': function (s) {
        var spec = s.Char(128)('word');
        spec.sql.should.equal('CHAR(128)');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.String);
      },
      'with options': function (s) {
        var spec = s.Char({length: 128, default: 'yep'})('word');
        spec.sql.should.equal('CHAR(128) DEFAULT "yep"');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.String);
      },
    },
    'Hyde.Schema.Binary' : {
      'standard fare': function (s) {
        var spec = s.Binary(128)('word');
        spec.sql.should.equal('BINARY(128)');
        assert.include(spec, 'validators');
        spec.validators[0].should.not.equal(Hyde.Validators.Type.String);
      },
      'with options': function (s) {
        var spec = s.Binary({length: 128, default: 'yep'})('word');
        spec.sql.should.equal('BINARY(128) DEFAULT "yep"');
        assert.include(spec, 'validators');
        spec.validators[0].should.not.equal(Hyde.Validators.Type.String);
      },
    },
    'Hyde.Schema.Char' : {
      'char standard fare': function (s) {
        var spec = s.Varbinary(128)('word');
        spec.sql.should.equal('VARBINARY(128)');
        assert.include(spec, 'validators');
        spec.validators[0].should.not.equal(Hyde.Validators.Type.String);
      },
      'with options': function (s) {
        var spec = s.Varbinary({length: 128, default: 'yep'})('word');
        spec.sql.should.equal('VARBINARY(128) DEFAULT "yep"');
        assert.include(spec, 'validators');
        spec.validators[0].should.not.equal(Hyde.Validators.Type.String);
      },
    },
    'Hyde.Schema.String' : {
      'standard fare': function (s) {
        var spec = s.String()();
        spec.sql.should.equal('TEXT');
        assert.include(spec, 'validators');
        assert.include(spec.validators, Hyde.Validators.Type.String);
      },
      'char': function (s) {
        var spec = s.String({size: 28, type: 'char'})();
        spec.sql.should.equal('CHAR(28)');
      },
      'blob': function (s) {
        var spec = s.String({type: 'blob'})();
        spec.sql.should.equal('BLOB');
      },
      'blob with default': function (s) {
        var spec = s.String({type: 'blob', default: 'the blob!'})();
        spec.sql.should.equal('BLOB DEFAULT "the blob!"');
      },
      'char without size throws error': function (s) {
            assert.throws(function () {
              s.String({type: 'char'})();
            }, /type mismatch.*/);
      },
      'longtext': function (s) {
        var spec = s.String({size: 'long', type: 'text'})();
        spec.sql.should.equal('LONGTEXT');
        
        spec = s.String({size: 'long'})();
        spec.sql.should.equal('LONGTEXT');
      },
      'tinytext': function (s) {
        var spec = s.String({size: 'tiny', type: 'text'})();
        spec.sql.should.equal('TINYTEXT');
        spec = s.String({size: 'tiny'})();
        spec.sql.should.equal('TINYTEXT');
      },
      'unique with length': function (s) {
        var spec = s.String({unique: true, length: 21})('t');
        spec.sql.should.equal('VARCHAR(21)');
        spec.keysql.should.equal('UNIQUE KEY `t` (`t`)');
        
        assert.throws(function () {
          s.String({unique: true})('t');
        }, /key/)
        
        spec = s.String({ unique: 128 })('t');
        assert.include(spec, 'keysql');
        spec.keysql.should.equal('UNIQUE KEY `t` (`t` (128))');
      },
      'null/not null': function (s) {
        var spec = s.String({ type: 'smalltext',  null: false })();
        spec.sql.should.equal('SMALLTEXT NOT NULL');
        
        spec = s.String({ required: true })();
        spec.sql.should.equal('TEXT NOT NULL');
        spec.validators.should.include(Hyde.Validators.Require);
      }
    },
    'Hyde.Schema.Enum' : {
      'standard fare': function (s) {
        var spec = s.Enum(['green', 'eggs', 'ham'])();
        spec.sql.should.equal('ENUM ("green", "eggs", "ham")');
        assert.include(spec, 'validators');
        spec.validators[0].meta.name.should.equal('type.enum');
        
        spec = s.Enum({ values: ['bold'] })();
        spec.sql.should.equal('ENUM ("bold")');
      },
      'null/not null': function (s) {
        var spec = s.Enum(['yo', 'la', 'tengo'], { required: true })();
        assert.include(spec, 'validators');
        spec.validators[0].should.equal(Hyde.Validators.Require);
      },
      'default': function (s) {
        var spec = s.Enum(['yo', 'la', 'tengo'], { default: 'tengo' })();
        spec.sql.should.equal('ENUM ("yo", "la", "tengo") DEFAULT "tengo"');
      }
    },
    'Hyde.Schema.Foreign' : {
      'basic test' : function (s) {
        var User = Base.extend({
          table: 'user',
          schema: { id : 'BIGINT AUTO_INCREMENT PRIMARY KEY' }
        })
        
        var ss = s.Foreign({
          model: User,
          field: 'id'
        })('user_id');
        
        var correct = {
          dependsOn: User,
          sql: "BIGINT",
          keysql: "FOREIGN KEY `user_fkey` (`user_id`) REFERENCES `user` (`id`)"
        };
        ss.dependsOn.should.equal(correct.dependsOn);
        ss.sql.should.equal(correct.sql);
        ss.keysql.should.equal(correct.keysql);
      },
    },
    'Hyde.Schema.Document': {
      'basic test' : function (s) {
        function intta (v) { return v; }
        function outta (v) { return v; }
        var ss = s.Document({
          serializer:   intta,
          deserializer: outta
        })();
        var correct = {
          sql: "BLOB",
          validators: [Hyde.Validators.Serializable(intta)],
          mutators: { storage: intta, retrieval: outta }
        };
        ss.sql.should.equal(correct.sql);
        should.exist(ss.mutators);
        ss.mutators.storage.should.equal(correct.mutators.storage);
        ss.mutators.retrieval.should.equal(correct.mutators.retrieval);
        ss.validators[0].meta.name.should.equal('serializable');
        ss.validators[0].meta.serializer.should.equal(correct.mutators.storage);
      },
      'should default to JSON' : function (s) {
        var ss = s.Document()();
        ss.mutators.storage.should.equal(JSON.stringify);
        ss.mutators.retrieval.should.equal(JSON.parse);
        ss.validators[0].meta.name.should.equal('serializable');
        ss.validators[0].meta.serializer.should.equal(JSON.stringify);
      },
      'null/not null' : function (s) {
        var ss = s.Document({required: true})();
        ss.sql.should.match(/not null/i);
        ss.validators[0].should.equal(Hyde.Validators.Require);
      },
    },
    'Hyde.Schema.Boolean': {
      'basic' : function (s) {
        var ss = s.Boolean()();
        ss.sql.should.match(/^boolean$/i)
      },
      'should respect defaults' : function (s) {
        var ss = s.Boolean({ default: 1 })();
        ss.sql.should.match(/default 1/i)
      }
    },
    'Hyde.Schema.Timestamp': {
      'basic' : function (s) {
        var ss = s.Time()();
        ss.sql.should.match(/^timestamp$/i)
      },
      'should respect defaults' : function (s) {
        var ss = s.Time({ default: 'CURRENT_TIMESTAMP' })();
        ss.sql.should.match(/current_timestamp/i)
      },
      'should respect type' : function (s) {
        var ss = s.Time({ type: 'datetime' })();
        ss.sql.should.match(/^datetime$/i)
      }
    }
  },
  '.createTableSql()': {
    'fails when there is no table': function () {
      var M = Base.extend({ engine: 'rad'}, { fieldspec: { id: { sql: '1' } } });
      assert.throws(function () {
        M.createTableSql();
      }, /table/);
    },
    'combines things in the correct order': function () {
      var M = Base.extend({
        table: 'stuff',
        engine: 'rad'
      });
      var sql = M.createTableSql({
        id: { sql: '1' },
        email: { sql: '2' },
        passwd: { sql: '3' },
        rel: { sql: '4', keysql: 'related' },
        rel2: { sql: '5', keysql: 'other related' }
      });
      sql.should.equal('CREATE TABLE IF NOT EXISTS `stuff` (`id` 1, `email` 2, `passwd` 3, `rel` 4, `rel2` 5, related, other related) ENGINE = rad');
    }
  },
  '.makeTable': {
    'simple schema' : {
      topic: function () {
        var M = Base.extend({
          table: 'tesstsajo',
          schema: { id: Hyde.Schema.Id, name: Hyde.Schema.String('long') }
        });
        return M;
      },
      'can be saved ': {
        topic: function (M) {
          M.prototype.table = 'wuskj';
          M.makeTable(this.callback);
        },
        'without erroring': function (err, result) {
          assert.ifError(err);
        }
      }
    },
    'complicated schema' : {
      topic: function () {
        var User = Base.extend({
          schema: {
            id: Hyde.Schema.Id,
            email: Hyde.Schema.String({ length: 255, unique: true, required: true }),
            last_login: Hyde.Schema.Number({ null: true }),
            active: Hyde.Schema.Boolean({ default: 1 }),
            passwd: Hyde.Schema.String({ length: 255 }),
            salt: Hyde.Schema.String({ type: 'blob', length: 'tiny' })
          }
        });
        return User;
      },
      'can be saved ': {
        topic: function (M) {
          M.prototype.table = 'wuskjjklasd';
          M.makeTable(this.callback);
        },
        'without erroring': function (err, result) {
          assert.ifError(err);
        }
      }
    },
    'foreign constrained schema' : {
      topic: function () {
        var User = Base.extend({
          table: 'jlakj9',
          schema: {
            id: Hyde.Schema.Id,
            email: Hyde.Schema.String({ length: 255, unique: true, required: true })
          }
        });
        var Badge = Base.extend({
          schema: {
            id: Hyde.Schema.Id,
            user_id: Hyde.Schema.Foreign({
              model: User,
              field : 'id'
            }),
            type: Hyde.Schema.Enum(['hosted', 'signed'], { null: false })
          }
        })
        return Badge;
      },
      'can be saved ': {
        topic: function (M) {
          M.prototype.table = 'ohsup';
          M.parseSchema();
          M.makeTable(this.callback);
        },
        'without erroring': function (err, result) {
          assert.ifError(err);
        }
      }
    }
  }
}).export(module);