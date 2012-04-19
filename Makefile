all: lint test

test:
	@NODE_ENV=test ./node_modules/.bin/vows

lint:
	./node_modules/.bin/jshint lib/*js

.PHONY: test lint
