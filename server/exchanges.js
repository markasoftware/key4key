const Debug = require('debug');
const circles = require('./circles');
const config = require('../config');
const db = require('./db');

const exchanges = {
	// str sender => bool
	initiate: async sender => {
		const debug = Debug('key4key:exchanges:initiate');
		debug(`Starting exchange for ${sender}`);
		const paired = await circles.findPairing(sender);
		if (!paired) {
			debug('no pair found :(');
			return false;
		}
		debug(`Pair found with ${paired}`);
		await db('exchanges').insert({
			initiator: sender,
			acceptor: paired,
			created: Math.floor(Date.now() / 1000),
			// TODO: multi-status
			status: 'complete',
		});
	},
	// str user => [ { user, pw, created } ]
	get: user =>
		db('exchanges')
			.select('circles.user', 'circles.pw', 'exchanges.created')
			.join('circles', function() {
				this.on('exchanges.initiator', 'circles.user')
					.orOn('exchanges.acceptor', 'circles.user');
			})
			.where(function() {
				this.where('exchanges.initiator', user)
					.orWhere('exchanges.acceptor', user);
			})
			.where('circles.user', '!=', user)
			.orderBy('exchanges.created', 'desc')
			.limit(config.listExchangeLimit),
};
module.exports = exchanges;
