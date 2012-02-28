var _ = require('underscore')
  , vows = require('vows')
  , assert = require('assert')
  , should = require('should')
  , fmap = require('functools').map
    
  , common = require('./common.js')
  , Hyde = require('..')
  , Base = Hyde.Base
  , client;

var spec = function (m) { return m.fieldspec };

Hyde.initialize(common.conf);
client = Hyde.client

common.prepareTesting(client);

vows.describe('base basics').addBatch({
  'Base basics': {
    'exists': function () { should.exist(Base) },
    '.extend': {
      'exists and is function': function () {
        should.exist(Base.extend);
        assert.isFunction(Base.extend);
      },
      'creates a new function': function () {
        var M = Base.extend({});
        assert.isFunction(M);
        assert.isFunction((new M).save)
      },
      'stores stuff': function () {
        var m = new (Base.extend({hey: 'sup'}));
        m.hey.should.equal('sup');
      },
      '#table': function () {
        var M = Base.extend({table: 'ohai'});
        M.table().should.equal('ohai');
      },
    },
    'default': {
      'driver is mysql': function () {
        var m = new (Base.extend({}));
        m.driver.should.equal('mysql');
      
        m = new (Base.extend({driver: 'postgres'}))
        m.driver.should.equal('postgres');
      },
      'engine is InnoDB': function () {
        var m = new (Base.extend({}));
        m.engine.should.equal('InnoDB');
      }
    },
    'models have access to client' : function () {
      var M = Base.extend({});
      assert.isFunction(M.client.query);
    },
    'instances have access to client' : function () {
      var M = Base.extend({})
        , m = new M;
      assert.isFunction(m.client.query);
    },
    '.getSchema should': {
      'error on missing schema': function () {
        var M = Base.extend({});
        assert.throws(function () {
          M.getSchema();
        }, /schema/);
      },
      'error on invalid schema type': function () {
        var M = Base.extend({schema: 'hey yo'});
        assert.throws(function () {
          M.getSchema();
        }, /schema/);
      },
      'handle strings as raw sql': function () {
        var M = Base.extend({
          schema: { id: 'BIGINT AUTO_INCREMENT PRIMARY KEY' }
        });
        var x = M.getSchema();
        x.id.sql.should.equal('BIGINT AUTO_INCREMENT PRIMARY KEY');
      },
      'pass through objects': function () {
        var M = Base.extend({
          schema: { id: { sql: 'BIGINT AUTO_INCREMENT PRIMARY KEY' } }
        });
        var x = M.getSchema();
        x.id.sql.should.equal('BIGINT AUTO_INCREMENT PRIMARY KEY');
      },
      'treat functions as generating objects': function () {
        var M = Base.extend({
          schema: { id: function (k) { return {
            keysql: 'unique key (id)',
            validators: [],
            sup: true
          } } }
        });
        var x = M.getSchema();
        x.id.sup.should.equal(true);
        x.id.keysql.should.equal('unique key (id)');
      },
      'handle higher order functions': function () {
        var hdlr = function () { return function () { return { sql: 'ya' } } };
        hdlr.higherOrder = true;
        var M = Base.extend({
          schema: { id: hdlr }
        });
        var x = M.getSchema();
        x.id.sql.should.equal('ya');
      },
    },
  }
}).addBatch({
  'Base model instances, saving': {
    'a basic model' : {
      topic: function () {
        var M = Base.extend({
          table: 'ljsaf',
          schema: { id: Hyde.Schema.Id, name: Hyde.Schema.String }
        });
        M.makeTable();
        return M;
      },
      'attributes exist' : function (M) {
        var x = new M({what: 'lol'})
        should.exist(x.attributes);
      },
      'can get attributes' : function (M) {
        var x = new M({what: 'lol'})
        x.get('what').should.equal('lol');
      },
      'can set attributes' : function (M) {
        var x = new M({what: 'lol'})
        x.set('what', 'rad')
        x.get('what').should.equal('rad');
      },
      'can save': {
        topic: function (M) {
          var x = new M({name: 'yaaaaaaaaaa'});
          var self = this;
          x.save(function (err, inst) {
            inst.save(function (err, inst) {
              inst.save(self.callback);
            });
          });
        },
        'and id gets assigned': function (err, result) {
          assert.isNumber(result.get('id'));
        }
      }
    }
  }
}).addBatch({
  'Base model, finding & saving': {
    topic: function () {
      var self = this;
      var M = Base.extend({
        table: 'findtest',
        schema: {
          id: Hyde.Schema.Id,
          email: Hyde.Schema.String,
          eggs: Hyde.Schema.String,
          drop: Hyde.Schema.String
        }
      })
      M.makeTable();
      var x = new M({email: 'hey', drop: 'what'});
      var y = new M({email: 'yo', other: 'garbage', ruining: 'everything'});
      var z = new M({email: 'sup', eggs: 'lots'});
      
      var callback = _.after(3, function () {
        self.callback(null, M);
      });
      
      x.save(function (err, res) {
        x.set('drop', 'yeah');
        x.save(callback)
      });
      y.save(callback);
      z.save(callback);
    },
    '.find, simple' : {
      topic: function (M) {
        M.find({email: 'hey'}, this.callback);
      },
      'totally works': function (err, results) {
        assert.ifError(err);
        results.should.have.lengthOf(1);
        results[0].get('email').should.equal('hey');
        results[0].get('drop').should.equal('yeah');
      }
    },
    '.find, advanced' : {
      topic: function (M) {
        M.find({email: 'sup', eggs: 'lots'}, this.callback);
      },
      'totally works': function (err, results) {
        assert.ifError(err);
        results.should.have.lengthOf(1);
        results[0].get('email').should.equal('sup');
      }
    },
    '.findOne' : {
      topic: function (M) {
        M.findOne({email: 'yo'}, this.callback);
      },
      'totally works': function (err, res) {
        assert.ifError(err);
        res.get('email').should.equal('yo');
      }
    },
    '.findById' : {
      topic: function (M) {
        M.findById(1, this.callback);
      },
      'totally works': function (err, res) {
        assert.ifError(err);
        res.get('email').should.equal('hey');
      }
    },
    '.findAll' : {
      topic: function (M) {
        M.findAll(this.callback);
      },
      'totally works': function (err, results) {
        assert.ifError(err);
        results.should.have.lengthOf(3);
        results[0].get('email').should.equal('hey');
      }
    },
  }
}).addBatch({
  'Instance validation': {
    topic: function () {
      var M = Base.extend({
        schema: { email: Hyde.Schema.String({required: true }) },
        validators: {
          email: [
            function beginWithH(v) { if (!v.match(/^h/)) return { message: 'must begin with h', name: 'begins-with-h' } },
            function contains(v) { if (!v.match(/sy0/)) return { message: 'must contain sy0', name: 'contains' } },
            function contains(v) { if (!v.match(/cl1/)) return { message: 'must contain cl1', name: 'contains' } },
            function contains(v) { if (!v.match(/@/)) return { message: 'must contain @', name: 'contains' } },
            function endWithIo(v) { if (!v.match(/io$/)) return { message: 'must end with io', name: 'end-with-io' } }
          ]
        }
      })
      return M;
    },
    'model#validate' : {
      'fail early' : function (M) {
        var m = new M({});
        var errors = m.validate();
        should.exist(errors);
        assert.include(errors, 'email');
      },
      'run all the tests': function (M) {
        var m = new M({email: 'hsy0cl1@what.xxx'});
        var errors = m.validate();
        should.exist(errors);
        assert.ok(errors);
        assert.include(errors, 'email');
        errors.email.name.should.equal('end-with-io');
      },
      'possible to pass' : function (M) {
        var m = new M({email: 'hsy0cl1@what.io'});
        var errors = m.validate();
        should.not.exist(errors);
      }
    },
    'validate on save' : {
      topic: function (M) {
        var m = new M({email: 'hsy0cl1@what.xxx'});
        m.save(this.callback);
      },
      'does a fine ass job': function (err, result) {
        should.exist(err);
        assert.include(err, 'validation');
        err.validation.email.name.should.equal('end-with-io');
      }
    }
  }
}).addBatch({
  'Instance mutators': {
    topic: function () {
      var M = Base.extend({ schema: { id: Hyde.Schema.Id, doc: Hyde.Schema.Document() } })
      return M;
    },
    'model#mutate' : {
      'should mutate' : function (M) {
        var m = new M({ doc: { one: 1, two: 2 } });
        var mattr = m.mutate();
        should.exist(mattr);
        mattr.doc.should.equal(JSON.stringify({ one: 1, two: 2 }));
        m.get('doc').one.should.equal(1);
      }
    },
    'model#demutate' : {
      'should demutate': function (M) {
        var m = new M({ doc: { one: 1, two: 2 } });
        var attr = m.demutate(m.mutate());
        should.exist(attr);
        attr.doc.one.should.equal(1);
        attr.doc.two.should.equal(2);
      }
    }
  }
}).addBatch({
  'Pro saving': {
    topic: function () {
      var M = Base.extend({
        table: 'prosavetest',
        schema: { id: Hyde.Schema.Id, doc: Hyde.Schema.Document() }
      })
      M.makeTable();
      return M;
    },
    'a document-laden instance': {
      topic: function (M) {
        var bands = new M({ doc: {pollard: 'GBV', shields: 'MBV'}})
        bands.save(this.callback);
      },
      'can be saved just fine': function (err, bands) {
        bands.get('id').should.equal(1);
      },
      'can be retrieved': {
        topic: function (m) {
          var M = m.constructor;
          M.findById(1, this.callback);
        },
        'with correct data' : function (err, bands) {
          bands.get('doc').pollard.should.equal('GBV');
          bands.get('doc').shields.should.equal('MBV');
        }
      }
    }
  }
}).addBatch({
  'Getters and setters': {
    topic: function () {
      var M = Base.extend({
        getters: {
          money: function (v) { return 'banking' },
          half: function (v) { return v/2 }
        },
        setters: {
          nums: function (v) { this.attributes.nums = '12345'; }
        }
      })
      return M;
    },
    'getters get get get': function (M) {
      var m = new M({ money: 'yah', half: 20 });
      m.get('money').should.equal('banking');
      m.get('half').should.equal(10);
    },
    'setters set set set': function (M) {
      var m = new M({});
      m.set('nums');
      m.get('nums').should.equal('12345');
    }
  }
}).addBatch({
  'Getting from foreign key': {
    topic: function () {
      var self = this;
      var Beer = Base.extend({
        table: 'beertest',
        schema: {
          id: Base.Schema.Id,
          name: Base.Schema.Varchar(128),
          abv: Base.Schema.Double
        }
      });
      
      var User = Base.extend({
        table: 'usertest',
        schema: {
          id: Base.Schema.Id,
          email: Base.Schema.Text,
          beer: Base.Schema.Foreign({ model: Beer })
        }
      });

      User.makeTable(function (err) {
        if (err) return self.callback(err);
        var rasputin = new Beer({name: 'Old Rasputin Russian Imperial Stout', abv: 9.0 });
        var things = [
          rasputin,
          new Beer({name: 'Guinness', abv: 4.3 }),
          new Beer({name: 'Pabst Blue Ribbon', abv: 4.7 }),
          new Beer({name: 'Dogfish Head Raison D\'etre', abv: 8.0 }),
          new User({email: 'brian@example.com', beer: rasputin })
        ]
        
        var saver = function (m, callback) { m.save(callback) }
        
        fmap.async(saver, things, function (err, things) {
          if (err) self.callback(err);
          self.callback(null, things);
        })
      })
    },
    'lookin good' : function (err, beers) {
      return;
      assert.ifError(err);
      var user = beers.pop();
      assert.ok('rad');
    },
  }
}).export(module);
