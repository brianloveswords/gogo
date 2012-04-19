var vows = require('vows')
var assert = require('assert')
var should = require('should')
var _ = require('../lib/ext-underscore')
var u = require('underscore')

vows.describe('underscore extensions').addBatch({
  'does not pollute underscore' : function () {
    should.not.exist(u.isMissing);
    should.not.exist(u.not);
    should.not.exist(u.getv);
  },
  '#isObject': function () {
    _.isObject({}).should.equal(true);
    _.isObject('ham').should.equal(false);
  },
  '#isMissing' : function () {
    _.isMissing('nope').should.equal(false);
    _.isMissing('').should.equal(false);
    _.isMissing(false).should.equal(false);
    _.isMissing(null).should.equal(true);
    _.isMissing(undefined).should.equal(true);
  },
  '#not': function () {
    var exists = _.not(_.isMissing);
    exists('nope').should.equal(true);
    exists('').should.equal(true);
    exists(false).should.equal(true);
    exists(null).should.equal(false);
    exists(undefined).should.equal(false);
  },
  '#getv' : function () {
    _.getv('es')({es : 'crow'}).should.equal('crow');
    should.not.exist(_.getv('es')({}))
    should.not.exist(_.getv('es')(undefined))
  },
  '#get' : function () {
    _.get({things: 'yes'})('things').should.equal('yes');
  },
  '#frev': function () {
    var Yarra = _.frev(Array);
    Yarra(1,2,3,4)[0].should.equal(4)
  },
  '#swap': function () {
    function div(a, b) { return a / b }
    div(10, 100).should.equal(0.1);
    _.swap(div)(10, 100).should.equal(10);
  },
  '#seq': function () {
    var arr = _.seq({one: 1, two: 2});
    arr[0][0].should.equal('one');
    arr[0][1].should.equal(1);
    arr[1][0].should.equal('two');
    arr[1][1].should.equal(2);
  },
  '#nth': function () {
    var arr = [1,2,3,4];
    var first = _.nth(0)
    var last = _.nth(arr.length-1);
    first(arr).should.equal(1);
    last(arr).should.equal(4);
  },
  '#strwrap' : function () {
    _.strwrap('`')('what').should.equal('`what`')
  },
  '#sstrwrap' : function () {
    _.sstrwrap('(', ')')('what').should.equal('(what)')
  },
  '#paren' : function () {
    _.paren('lol').should.equal('(lol)');
  },
  '#quote' : function () {
    _.quote('rsd').should.equal('"rsd"');
  },
  '#squote' : function () {
    _.squote('ioooooiw').should.equal("'ioooooiw'");
  },
  '#backtick' : function () {
    _.backtick('12').should.equal('`12`');
  },
  '#chomp' : function () {
    var str = "what       \n"
    _.chomp(str).should.equal('what');
    _.chomp(str, 'nope').should.equal(str);
    _.chomp('yepnope', 'nope').should.equal('yep');
    _.chomp('nopeyep', 'nope').should.equal('nopeyep');
  },
  '#downcase' : function () {
    _.downcase('HMMM').should.equal('hmmm');
  },
  '#upcase' : function () {
    _.upcase('yes').should.equal('YES');
  },
  '#strjoin' : function () {
    _.strjoin([1, 2]).should.equal('1 2');
    _.strjoin(1, 2).should.equal('1 2');
    _.strjoin([1,[[[2]]]]).should.equal('1 2');
  },
  '#placeholders' : function () {
    var p = _.placeholders([1,2]);
    p.should.have.lengthOf(2)
    p[0].should.equal('?');
    p[1].should.equal('?');
  },
  '#extract' : function () {
    var spec = { beer: { mutators: { storage: function () { return 'yes' }}}}
    _.extract(spec, ['beer', 'mutators', 'storage'])().should.equal('yes');
    should.not.exist(_.extract({}, ['this', 'should', 'not', 'exist']))
  },
  '#callmap' : function () {
    var fns = { beer: function () { return 'delicious' }}
    var vals = { beer: 'pbr' }
    var newvals = _.callmap(fns, vals);
    newvals['beer'].should.equal('delicious');
  },
  '#push': function () {
    var arr = [];
    _.push(arr, 1, 2, undefined, undefined, undefined, undefined, 3);
    arr[0].should.equal(1);
    arr[1].should.equal(2);
    arr[2].should.equal(3);
  },
  '#curry': function () {
    var identity = _.curry(function (a) { return a });
    var add =  _.curry(function (a, b) { return a + b });
    var sum = _.curry(function sum(a,b,c){
      return a+b+c;
    })
    
    assert.equal(sum()(3)()(1)(4), 8);
    assert.equal(sum(3,1,4), 8);
    assert.equal(sum(3)(1,4), 8);

    assert.equal(identity(1), 1);
    assert.equal(identity(2), 2);
    assert.equal(identity(3), 3);
    
    assert.equal(add(3)(10), 13);
    assert.equal(add(10)(50), 60);
    assert.equal(add(10, 50), 60);
    
    var obj = { x: 10, plus10: function (a, b) { return this.x + a + b; } }
    var plusser = _.curry(obj.plus10, obj);
    
    assert.equal(plusser(10)(10), 30);
    assert.equal(plusser(10, 10), 30);
  }
}).export(module);