all: client-dist/all.css client-dist/all.js

client-dist/all.css: client/css/*.sass
	./node_modules/sass client/css/index.sass client-dist/all.css

client-dist/all.js: client/js/**/*.js
	./node_modules/browserify client/js/index.js -o client-dist/all.js

clean:
	rm -f client-dist/all*
