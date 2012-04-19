* Use 2 real spaces for indentation.

* Semicolons: 'round these parts, we use 'em.

![deal with it](http://i.imgur.com/JFuNF.gif)


* `var`s: use a seperate var keyword per assignment.

![batman approves](http://i.imgur.com/X2PkH.gif)

```js
// yep
var one = 1;
var two = 2;
var three = 3;
```

![the dude disapproves](http://i.imgur.com/iKYQB.gif)

```js
// nope
var one = 1
  , two = 2
  , three = 3;
```

* Prefer spaces near opening/closing braces and brackets. The exception is
  when you are getting an attribute from an object.

```js
// preferred
var arr = [ 1, 2, 3 ];
var hash = { one: 1, two: 2 };

// exception
var x = obj['attribute'];
```

* Assignment in a conditionals okay, but must be wrapped with extra parens.

```js
// okay
var clamps;
if ((clamps = true)) { ... }
```

* Strongly prefer function statements to assignment of function
  expressions. In cases where function expressions are unavoidable, give them
  a name to help with stack traces and recursion without using
  arguments.callee.

![clint likes it](http://i.imgur.com/R1AKc.gif)

```js
// strongly encouraged
function times(a, b) { return a * b; }
var operations = {
  times: times,
  add: function add(a, b) { return a + b; }
}
```

![stewart says nope](http://i.imgur.com/ASUVk.gif)

```js
// discouraged
var times = function (a, b) { return a * b; };
var operations = {
  add: function (a, b) { return a + b; }
}
```

* Ternary statements are fine where it helps readability.

* Prefer `===` to `==` except in completely unambiguous cases.
