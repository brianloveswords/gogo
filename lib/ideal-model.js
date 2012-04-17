var User = require('./user.js')
var Badge = Base.extend({
  // which migration this is on.
  // this is used when doing the initial migration so new checkouts know 
  // which version of the schema this represents and either runs migrations
  // or sets the `schema_version` table accordingly
  version: '3',
  
  table: 'badge',
  
  // default
  driver: 'mysql',
  
  //default
  engine: 'InnoDB',
  
  //-----------------------------------------------------------------------
  //        (sec 1.a)  strings are passed through as raw sql
  //-----------------------------------------------------------------------
  
  schema: {
    id: "BIGINT AUTO_INCREMENT PRIMARY KEY",
    user_id: "BIGINT",
    type: "ENUM('hosted', 'signed') NOT NULL",
    endpoint: "TINYTEXT",
    public_key: "TEXT",
    jwt: "TEXT",
    image_path: "VARCHAR(255) NOT NULL",
    rejected: "BOOLEAN DEFAULT 0",
    body: "MEDIUMBLOB NOT NULL",
    body_hash: "VARCHAR(255) UNIQUE NOT NULL",
    validated_on: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  },
  
  //-----------------------------------------------------------------------
  //           (sec 1.b)  or the helper methods can be used 
  //-----------------------------------------------------------------------
  
  schema: {
    id:           Base.Schema.Id,
    user_id:      Base.Schema.Foreign({
      model: User,
      field : 'id',
    }),
    type:         Base.Schema.Enum(['hosted', 'signed'], { null: false }),
    endpoint:     Base.Schema.Text('tiny'),
    public_key:   Base.Schema.Text,
    jwt:          Base.Schema.Text,
    image_path:   Base.Schema.Text(255, { null: false }),
    from_demo:    Base.Schema.Boolean({ default: 0 }),
    body:         Base.Schema.Document({
      serialize:   JSON.stringify, //default
      deserialize: JSON.parse, // default
      required: true // same thing as null: false
    }),
    body_hash:    Base.Schema.Text(255, { unique: true, null: false }),
    validated_on: Base.Schema.Timestamp({ default: "CURRENT_TIMESTAMP" })
  },

  validators: {
    endpoint: Base.Validators.Required.when({field: "type", is: "hosted"}),
    jwt: Base.Validators.Required.when({field: "type", is: "signed"}),
    public_key: Base.Validator.Required.when({field: "type", is: "signed"}),
    body: V.Doc({
      recipient: [V.Required, V.Email],
      evidence: V.Regexp,
      expires: V.Regexp,
      issued_on: V.Regexp,
      badge: V.Doc(V.RequireAll, {
        version: V.Regexp,
        name: V.Length(128),
        description: V.Length(128),
        image: V.Regexp,
        criteria: V.Regexp,
        issuer: V.Doc({
          origin: [V.Required, V.Regexp],
          name: [V.Required, V.Length(128)],
          org: V.Length(128),
          contact: V.Email
        })
      })
    })
  },
  
  //==============================================================================
  //  (sec 2) the above (sec 1.b) should generate the the following after
  //  everything is processed. nobody SHOULD be forced to write this, but
  //  they should be able to.
  //==============================================================================

  _fields: {
    id: {
      sql: "BIGINT AUTO_INCREMENT PRIMARY KEY",
      validators: [Base.Validate.Type.Number]
    },
    user_id: {
      dependsOn: User,  // triggers schema creation on User.
      sql: "BIGINT",
      keySql: "FOREIGN KEY user_fkey (user_id) REFERENCES `user`(id)",
      validators: [Base.Validate.Type.Number]
    },
    type: {
      sql: "ENUM('hosted', 'signed') NOT NULL",
      validators: [
        Base.Validate.Required,
        Base.Validate.Type.Enum(['hosted', 'signed'])
      ]
    },
    endpoint: {
      sql: "TINYTEXT",
      validators: [
        Base.Validate.Required.when({field: "type", is: "hosted"}),
        Base.Validate.Type.Text
      ]
    },
    public_key: {
      sql: "TEXT",
      validators: [Base.Validate.Required.when({field: "type", is: "signed"})]
    },
    jwt: {
      sql: "TEXT",
      validators: [Base.Validate.Required.when({field: "type", is: "signed"})]
    },
    image_path: {
      sql: "VARCHAR(255) NOT NULL",
      validators: [
        Base.Validate.Required,
        Base.Validate.Type.Text,
        Base.Validate.Length({max: 255})
      ]
    },
    from_demo: {
      sql: "BOOLEAN DEFAULT 0",
      validators: []
    },
    body: {
      sql: "MEDIUMBLOB NOT NULL",
      validators: [
        Base.Validate.Required,
        Base.Validate.Serializable(JSON.stringify, JSON.parse),
        Base.Validate.Type.Object,
        Badge.Validate.Body
      ],
      mutators: {
        storage: JSON.stringify,
        retrieval: JSON.parse
      }
    },
    body_hash: {
      sql: "VARCHAR(255) UNIQUE NOT NULL",
      validators: [
        Base.Validate.Required,
        Base.Validate.Type.Text,
        Base.Validate.Length({max: 255})
      ]
    },
    validated_on: {
      sql: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      validators: [
        Base.Validate.Type.Timestamp
      ]
    }
  }
});