all: lint test

test:
	@NODE_ENV=test DB_DRIVER=mysql ./node_modules/.bin/vows
	@NODE_ENV=test DB_DRIVER=sqlite DB_FILE=testrun.db ./node_modules/.bin/vows
	rm testrun.db

lint:
	./node_modules/.bin/jshint lib/*js

.PHONY: test lint
