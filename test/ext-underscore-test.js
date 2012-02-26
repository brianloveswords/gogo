var vows = require('vows')
  , assert = require('assert')
  , should = require('should')
var _ = require('underscore')
require('../lib/ext-underscore');



vows.describe('underscore extensions').addBatch({
  '#isObject': function () {
    _.isObject({}).should.equal(true);
    _.isObject('ham').should.equal(false);
  },
  '#missing' : function () {
    _.missing('nope').should.equal(false);
    _.missing('').should.equal(false);
    _.missing(false).should.equal(false);
    _.missing(null).should.equal(true);
    _.missing(undefined).should.equal(true);
  },
  '#not': function () {
    var exists = _.not(_.missing);
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
  '#getter' : function () {
    _.getter({things: 'yes'})('things').should.equal('yes');
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
  '#ozip': function () {
    var arr = _.ozip({one: 1, two: 2});
    arr[0][0].should.equal('one');
    arr[0][1].should.equal(1);
    arr[1][0].should.equal('two');
    arr[1][1].should.equal(2);
  },
  '#xth': function () {
    var arr = [1,2,3,4];
    var first = _.xth(0)
      , last = _.xth(arr.length-1);
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
    _.chomp("what       \n").should.equal('what');
  },
  '#downcase' : function () {
    _.downcase('HMMM').should.equal('hmmm');
  },
  '#upcase' : function () {
    _.upcase('yes').should.equal('YES');
  },
  '#strjoin' : function () {
    _.strjoin([1, 2]).should.equal('1 2');
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
  '#callWith' : function () {
    var fns = { beer: function () { return 'delicious' }}
    var vals = { beer: 'pbr' }
    var newvals = _.callWith(fns, vals);
    newvals['beer'].should.equal('delicious');
  },
  
}).export(module);