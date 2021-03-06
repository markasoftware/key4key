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
		return true;
	},
	// str user -> int time (ms) => int number_of_exchanges
	findExchangesInPeriod: async (user, time) => {
		const debug = Debug('key4key:exchanges:findExchangesInPeriod');
		debug(`Exchanges in period for ${user} and ${time}`);
		const dbRes = await db('exchanges').count('*')
			.where(function() {
				this.where('initiator', user)
					.orWhere('acceptor', user);
			})
			.where('created', '>=', time);
		debug(JSON.stringify(dbRes));
		return dbRes[0]['count(*)'];
	},
	// str user => [ { user, pw, created } ]
	get: user =>
		db('exchanges')
			.select('circles.user', 'circles.pw', 'circles.betrayed', 'exchanges.created')
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
