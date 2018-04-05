const Debug = require('debug');
const config = require('../config');
const db = require('./db');

const ips = {
	// str user -> str ip => bool wasNew
	add: async (user, ip) => {
		debug = Debug('key4key:ips:add');
		debug(`Logging IP ${ip} for ${user}`);
		try {
			debug('logged');
			await db('ips').insert({ user, ip });
		} catch (e) {
			debug('already logged');
			return false;
		}
		return true;
	},
	// str ip -> bool
	isBanned: async ip => {
		const dbRes = await db('ips').count('*')
			.whereIn('user', config.blacklist)
			.where('ip', ip);
		return !!(dbRes[0]['count(*)'])
	},
	hasAccessedFromBanned: async user => {
		const dbRes = await db('ips').count('*')
			.whereIn('user', config.blacklist)
			.whereNotIn('ip', config.ipWhitelist)
			.whereIn('ip', function() {
				this.select('ip').from('ips').where('user', user);
			});
		return !!(dbRes[0]['count(*)']);
	},
	// str ip -> [ str users ]
	findUsers: async ip => {
		const dbRes = await db('ips').select('user').where('ip', ip);
		return dbRes.map(c => c.users);
	},
	// str user -> [ str ips ]
	findIps: async user => {
		const dbRes = await db('ips').select('ip').where('user', user);
		return dbRes.map(c => c.ip);
	},
};
module.exports = ips;
