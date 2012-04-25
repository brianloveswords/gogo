# Gogo - a migration & nested document capable database abstraction for insane people

## This is 0.0.1 software -- it probably isn't ready for public consumption yet.

## Example

```js
var Gogo = require('gogo')({
  driver: 'mysql',
  host: '127.0.0.1',
  user: 'user',
  password: 'password',
  database: 'your_app'
});
var Base = Gogo.Base;

// defining models
// simple
var User = Base.extend({
  table: 'user',
  engine: 'InnoDB',
  schema: {
    id: Base.Field.Id,
    email: Base.Field.Text('tiny', { required: true, unique: true }),
    password: Base.Field.Varchar(255, { required: true }),
    last_login: Base.Field.Timestamp({ default: "CURRENT_TIMESTAMP" })
    admin: Base.Field.Boolean({ default: 0 })
  },
  
  // adding `required: true` to fields above gives us presence validators
  // for free, so we don't need to specify those.
  validators: {
    email: Base.Validator.Email,
    password: Base.Validator.Length({ min: 8 })
  },
  
  setPassword: function(password) {
    this.set('password', bcrypt(password));
  },

  checkPassword: function(attempt) {
    return this.get('password') === bcrypt(attempt);
  }
};

// more complex
var Stories = Base.extend({
  table: 'story',
  engine: 'InnoDB',
  schema: {
    id: Base.Field.Id,
    user_id: Base.Field.Foreign({ model: User, field: 'id' }),
    title: Base.Field.Text,
    content: Base.Field.Text('long'),
    published: Base.Field.Enum(['public', 'private', 'draft'], { required: true, default: 'draft' }),
    metadata: Base.Field.Document({
      serialize: JSON.stringify,
      deserialize: JSON.parse
    })
  }

  validators: {
    metadata: Base.Validator.Document({
      tags: Base.Validator.Type.Array,
      social: Base.Validator.Document({
        tweets: Base.Validator.Type.Number,
        likes: Base.Validator.Type.Number,
        plusones: Base.Validator.Type.Number,
      })
    })
  }
};

// instantiating models.
```
 


[![Build Status](https://secure.travis-ci.org/brianloveswords/gogo.png)](http://travis-ci.org/brianloveswords/gogo)
