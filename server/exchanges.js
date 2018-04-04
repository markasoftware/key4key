const Debug = require('debug');
const circles = require('./circles');
const config = require('./config');
const db = require('./db');

const exchanges = {
	// str sender => bool
	initiate: async sender => {
		const paired = await circles.findPairing(sender);
		if (!paired) {
			return false;
		}
		db('exchanges').insert({
			initiator: sender,
			acceptor: paired,
			created: Math.floor(Date.now() / 1000),
			// TODO: multi-status
			status: 'complete',
		});
	},
	// str user => [ { user, pw, created } ]
	get: async user => {
		const dbRes = await db('exchanges')
			.select('exchanges.acceptor', 'exchanges.created', 'circles.pw')
			.join('circles', 'exchanges.initiator', 'circles.user'),
			.where('exchanges.initiator', user)
			.orderBy('exchanges.exchangeid', 'desc')
			.limit(config.listExchangeLimit);
		return dbRes.map(c => ({
			user: c.exchanges.acceptor,
			created: c.exchanges.created,
			pw: c.circles.pw,
		}));
	},
};
module.exports = exchanges;
