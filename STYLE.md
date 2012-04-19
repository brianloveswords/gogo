* Use 2 real spaces for indentation.

* Semicolons: use 'em.

* `var`s: use a seperate var keyword per assignment.

```js
// yes
var one = 1;
var two = 2;
var three = 3;

// no
var one = 1
  , two = 2
  , three = 3;
```

* Prefer spaces near opening/closing braces and brackets

```
// preferred
var arr = [ 1, 2, 3 ];
var hash = { one: 1, two: 2 };
```

* Assignment in a conditionals okay, but must be wrapped with extra parens.

```
// okay
var clamps;
if ((clamps = true)) { ... }
```

* Strongly prefer function statements to assignment of function
  expressions. In cases where function expressions are unavoidable, give them
  a name to help with stack traces and recursion without using
  arguments.callee.

```
// strongly encouraged
function times(a, b) { return a * b; }
var operations = {
  times: times,
  add: function add(a, b) { return a + b; }
}

// discouraged
var times = function (a, b) { return a * b; };
var operations = {
  add: function (a, b) { return a + b; }
}
```

* Ternary statements are fine where it helps readability.

* Prefer === to == except in completely unambiguous cases.
