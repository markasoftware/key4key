const knex = require('knex');
const config = require('../config');
const db = knex({
	client: 'sqlite3',
	connection: {
		filename: config.dbPath,
	},
});
module.exports = db;
