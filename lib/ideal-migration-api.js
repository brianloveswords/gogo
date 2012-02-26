var User = require('./models/user.js');

Base.Migration(User, {
  '0001: add column `yams`' : {
    up: function (t) {
      t.addColumn({yams: t.Schema.String});
      t.changeColumn({yams: t.Schema.String({type: 'varchar', length: 255})})
      t.executeSql('select 1');
    },
    down: function (t) { t.dropColumn('yams'); }
  },
  '0002: remove column `yams`' : {
    up: function (t) {
      t.renameColumn('yams', 'beets');
    },
    down: function (t) {
      t.renameColumn({beets: 'yams'});
    },
  },
  '0003: remove column `yams`' : {
    up: function (t) {
      t.dropColumn('yams');
    },
    down: false
  },
});
