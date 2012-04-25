var _ = require('underscore');
var vows = require('vows');
var assert = require('assert');
var should = require('should');
var Gogo = require('..');

vows.describe('Validator whaaaaat').addBatch({
  'validator helpers': {
    topic: Gogo.Validator,
    'Gogo.Validator.Require': function (v) {
      v.Require(null).name.should.equal('required');
      should.not.exist(v.Require('rad'));
      assert.isFunction(v.Require()()())
    },
    'Gogo.Validator.Require.when': function (v) {
      var test = v.Require.when({field:'type', is:'signed'})
      var o = {type: 'signed'}
      test(null, o).name.should.equal('required-when');
      should.not.exist(test(true, o));
    },
    'Gogo.Validator.Length (positional)' : {
      topic: function (v) { return v.Length(4) },
      'invalid things should return an object' : function (test) {
        function $ (e) { e.name.should.equal('length') }
        $(test('12345'));
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test('123'));
        $(test(undefined));
      }
    },
    'Gogo.Validator.Length (named)' : {
      topic: function (v) { return v.Length({min: 2, max: 4}) },
      'invalid things should return an object' : function (test) {
        function $ (e) { e.name.should.equal('length') }
        $(test('12345'));
        $(test('1'));
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test('1234'));
        $(test('12'));
        $(test(undefined));
      }
    },
    'Gogo.Validator.Serializable' : {
      topic: function (v) { return v.Serializable(JSON.stringify) },
      'invalid things should return an object' : function (test) {
        function $ (e) { e.name.should.equal('serializable') }
        $(test(function(){}));
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test({ a: 1, b: function(){} }))
        $(test(undefined));
      }
    },
    'Gogo.Validator.Type.Enum' : {
      topic: function (v) { return v.Type.Enum(['lame', 'sauce']) },
      'invalid things should return an object' : function (test) {
        function $ (e) { e.name.should.equal('type.enum') }
        $(test('jackrabbit'));
        $(test('blargh'));
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test('sauce'));
        $(test(undefined));
      }
    },
    'Gogo.Validator.Type.Number' : {
      topic: function (v) { return v.Type.Number },
      'invalid things should return an object' : function (test) {
        function $ (e) { e.name.should.equal('type.number') }
        $(test(function(){})),
        $(test([1,2,3])),
        $(test('nopenopenope')),
        $(test(NaN))
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test(10))
        $(test('10'))
        $(test('10e1'))
        $(test(10e1))
        $(test(10.10921))
        $(test(undefined))
      },
      'should return itself until given a value': function (test) {
        test.should.equal(test()()());
      }
    },
    'Gogo.Validator.Type.String' :{
      topic: function (v) { return v.Type.String },
      'invalid things should return object' : function (test) {
        function $ (thing) { thing.name.should.equal('type.string') }
        $(test({}));
        $(test(['l','o','l']));
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test('lol'));
        $(test(String({})));
      },
      'should return itself until given a value' : function (test) {
        test.should.equal(test()()());
      }
    },
    'Gogo.Validator.Type.Object' : {
      topic: function (v) { return v.Type.Object },
      'invalid things should return object' : function (test) {
        function $ (thing) { thing.name.should.equal('type.object') }
        $(test(['l','o','l']));
        $(test('just some string'));
        $(test(function(){}));
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test({}));
        $(test(undefined));
      },
      'should return itself until given a value' : function (test) {
        test.should.equal(test()()());
      }
    },
    'Gogo.Validator.Type.Array' : {
      topic: function (v) { return v.Type.Array },
      'invalid things should return object' : function (test) {
        function $ (thing) { thing.name.should.equal('type.array') }
        $(test({ oooo: 'lala' }));
        $(test('just some string'));
        $(test(function(){}));
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test(['i', 'am', 'an', 'array']));
        $(test(undefined));
      },
      'should return itself until given a value' : function (test) {
        test.should.equal(test()()());
      }
    },
    'Gogo.Validator.Regexp' : {
      topic: function (v) { return v.Regexp(/blargh/) },
      'invalid things should return object' : function (test) {
        function $ (thing) { thing.name.should.equal('regexp') }
        $(test('roas'))
        $(test('roaioajsds'))
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test(undefined));
        $(test('blargh'));
        $(test('superblargh'));
      },
      'invalid regexp should throw' : function () {
        assert.throws(function () {
          Gogo.Validator.Regexp({})
        }, /invalid/);
      },
    },
    'Gogo.Validator.Email' : {
      topic: function (v) { return v.Email },
      'invalid things should return object' : function (test) {
        function $ (thing) { thing.name.should.equal('email') }
        $(test('roas'))
        $(test('roaioajsds'))
      },
      'valid things should return nothing' : function (test) {
        function $ (e) { should.not.exist(e) }
        $(test('blargh@rad.com'));
        $(test('superblargh@awesome.org'));
      },
      'should return itself until given a value' : function (test) {
        test.should.equal(test()()());
      }
    },
    'Gogo.Validator.Require.all': {
      'precedes all validators with Require': function (v) {
        var validators = {
          one: [],
          two: v.Email,
          three: v.Document({
            four: v.Email
          })
        }
        v.Require.all(validators);
        assert.include(validators.one, v.Require);
        assert.include(validators.two, v.Require);
        validators.two[0].should.equal(v.Require);
        validators.three.meta.name.should.equal('doc');
      },
    },
    'Gogo.Validator.Document' : {
      'if an entry is required, parent is required' : function (v) {
        var test = v.Document({
          thing: v.Require
        })
        test({}).name.should.equal('doc');
        test({}).errors[0].name.should.equal('required');
        should.not.exist(test({thing: false}));
      },
      'can handle array of validators' : function (v) {
        var test = v.Document({
          thing: [v.Require, v.Email]
        })
        test({}).name.should.equal('doc');
        test({}).errors[0].name.should.equal('required');
        should.not.exist(test({thing: 'wut@lol.com'}));
      },
      'can be nested' : function (v) {
        var test = v.Document({
          thing: v.Document({
            otherThing: v.Document({
              oneMoreThing: [v.Require, v.Email]
            })
          })
        })
        var empty = test({});
        empty.name.should.equal('doc');
        empty.errors[0].name.should.equal('doc');
        empty.errors[0].errors[0].name.should.equal('doc');
        empty.errors[0].errors[0].errors[0].name.should.equal('required');
        
        var t = test({thing: {otherThing: {oneMoreThing: 'yep@rad.org'}}});
        should.not.exist(t);
      },
      'errors on subs get the right field name' : function (v) {
        var test = v.Document({
          thing: v.Document({
            otherThing: v.Document({
              oneMoreThing: v.Require()
            })
          })
        })
        test({}).name.should.equal('doc');
        test({}).errors[0].name.should.equal('doc');
        test({}).errors[0].errors[0].name.should.equal('doc');
        test({}).errors[0].errors[0].field.should.equal('otherThing');
        test({}).errors[0].errors[0].errors[0].field.should.equal('oneMoreThing');
      },
      'can get real complicated' : {
        topic: function (v) {
          var test = v.Document({
            recipient: [v.Require, v.Email],
            evidence: v.Regexp(/w/),
            expires: v.Regexp(/w/),
            issued_on: v.Regexp(/w/),
            badge: v.Document(v.Require.all({
              version: v.Regexp(/w/),
              name: v.Length(128),
              description: v.Length(128),
              image: v.Regexp(/w/),
              criteria: v.Regexp(/w/),
              issuer: v.Document({
                origin: [v.Require, v.Regexp(/w/)],
                name: [v.Require, v.Length(128)],
                org: v.Length(128),
                contact: v.Email
              })
            }))
          });
          return test;
        },
        'can fail and have all proper failures' : function (test) {
          function findby(f) { return function(o){ return o.field === f } }
          function testFor(a, f) { return _.any(a, function (v) { return v.field === f }); }
          var empty = test({})
          var level1 = empty.errors
          var level2 = _.find(level1, findby('badge')).errors
          var level3 = _.find(level2, findby('issuer')).errors
          assert.ok(testFor(level1, 'recipient'));
          assert.ok(testFor(level1, 'badge'));
          assert.ok(testFor(level2, 'version'));
          assert.ok(testFor(level2, 'name'));
          assert.ok(testFor(level2, 'description'));
          assert.ok(testFor(level2, 'image'));
          assert.ok(testFor(level2, 'criteria'));
          assert.ok(testFor(level2, 'issuer'));
          assert.ok(testFor(level3, 'origin'));
              assert.ok(testFor(level3, 'name'));
        },
        'can pass' : function (test) {
          var err = test({
            recipient: 'y@y.com',
            evidence: 'w',
            badge: {
              version: 'w',
              name: 'w',
              description: 'w',
              image: 'w',
              criteria: 'w',
              issuer: {
                origin: 'w',
                name: 'w'
              }
            }
          })
          should.not.exist(err);
        }
      }
    }
  }
}).export(module);
