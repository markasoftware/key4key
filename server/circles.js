const Debug = require('debug');
const config = require('../config');
const reddit = require('./reddit-api');
const db = require('./db');

// hashing passwords is for amateurs

const circles = {
	// str name -> str acpw => bool
	checkAcAuth: async (user, acpw) => {
		const debug = Debug('key4key:circles:checkAcAuth');
		const dbRes = await db('circles').select('user')
			.where('user', user)
			.where('acpw', acpw);
		return !!dbRes.length;
	},
	// str name | [ names ] => { }
	get: async user => {
		const dbRes = await db('circles').select('*')
			.whereIn('user', user.length ? user : [user]);
		return dbRes.length === 1 ? dbRes[0] : dbRes;
	},
	// { user, pw, reqkarma, reqage, reqsize } => undef
	create: acinfo =>
		db('circles').insert(Object.assign({ refreshed: Date.now() }, acinfo)),
	update: (user, stuff) =>
		db('circles').update(stuff).where('user', user),
	findStalest: async () => {
		const dbRes = await db('circles').select('user', 'refreshed').orderBy('refreshed', 'asc').limit(1);
		return dbRes[0];
	},
	// checks whether a circle is eligible, i.e it is not a murderer,
	// has not been betrayed, and exists
	// user => { size, joined, betrayed, karma, age} | false
	checkEligibility: async (user, pw = false) => {
		const debug = Debug('key4key:circles:checkEligibility');
		let circleInfo;
		try {
			debug(`Getting circle info for ${user}`);
			circleInfo = await reddit.getCircleInfo(user);
		} catch (e) {
			if (e.error && e.error.error === 404) {
				debug('Circle does not exist!');
				return false;
			}
			throw e;
		}
		debug(`Circle exists, murderer: ${circleInfo.murderer}`);
		debug(`betrayed: ${circleInfo.betrayed}`);
		if(circleInfo.murderer || (!config.allowBetrayed && circleInfo.betrayed)) {
			debug('not eligible due to murderer or betrayed status');
			return false;
		}
		if (pw && !circleInfo.betrayed) {
			debug('Attempting unlock...');
			if (!(await reddit.unlockCircle(circleInfo.id, pw))) {
				debug('Unlock failed!');
				return false;
			}
			debug('Unlock successful');
		}
		const redditUser = reddit.getUser(user);
		debug('Getting user info...');
		const karma = (await redditUser.link_karma) + (await redditUser.comment_karma);
		const age = await redditUser.created_utc;
		debug(`karma: ${karma} age: ${age}`);
		return {
			size: circleInfo.size,
			joined: circleInfo.joined,
			betrayed: circleInfo.betrayed,
			karma,
			age,
		};
	},
	autoUpdate: async user => {
		const debug = Debug('key4key:circles:autoUpdate');
		debug(`Autoupdating ${user}`);
		const userInfo = await circles.checkEligibility(user);
		if (!userInfo) {
			// this user has done the bad thing!
			// they cannot create an account either because we do the
			// same check there
			debug('user is not eligible for account, deleting it.');
			await db('circles').delete().where('user', user);
			return;
		}
		userInfo.refreshed = Date.now();
		debug(`Updating user with: ${JSON.stringify(userInfo)}`);
		await circles.update(user, userInfo);
	},
	// str user => user | false
	findPairing: async user => {
		const debug = Debug('key4key:circles:findPairing');
		debug(`Finding pairing for ${user}`);
		// yes, we could do it in a single query, but fuck knex
		const senderInfo = await circles.get(user);
		const dbRes = await db('circles').select('user')
			.where('karma', '>=', senderInfo.reqkarma)
			.where('reqkarma', '<=', senderInfo.karma)
			.where('size', '>=', senderInfo.reqsize)
			.where('reqsize', '<=', senderInfo.size)
			.where('joined', '>=', senderInfo.reqjoined)
			.where('reqjoined', '<=', senderInfo.joined)
			.where('age', '<=', senderInfo.reqage)
			.where('reqage', '>=', senderInfo.age)
			// lol
			.where('user', '!=', user)
			.whereNotIn('user', function() {
				this.select('initiator').from('exchanges')
					.where('acceptor', user);
			})
			// we probably don't need both of these, but fuck it
			.whereNotIn('user', function() {
				this.select('acceptor').from('exchanges')
					.where('initiator', user);
			})
			.orderByRaw('RANDOM()')
			.limit(1);
		return dbRes.length ? dbRes[0].user : false;
	},
};
module.exports = circles;
