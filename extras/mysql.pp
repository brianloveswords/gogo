class mysql::server {
  package { "mysql-server": ensure => installed; }
  package { "mysql-client": ensure => installed; } 
  package { "libmysqlclient-dev": ensure => installed; }
}

class mysql::db {  
  define mysqldb( $user, $password ) {
    exec { "create-${name}-db":
      unless => "/usr/bin/mysql -u${user} -p${password} ${name}",
      command => "/usr/bin/mysql -uroot -p$mysql_password -e \"create database ${name}; grant all on ${name}.* to ${user}@localhost;\"",
    }
  }
  mysqldb { "test_hyde":
    user => "test_hyde",
  }  
}

