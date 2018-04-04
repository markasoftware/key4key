const Debug = require('debug');
const reddit = require('./reddit-api');
const db = require('./db');

// hashing passwords is for amateurs

const circles = {
	// str name -> str acpw => bool
	checkAcAuth: async (user, acpw) => {
		const dbRes = await db('circles').select('user')
			.where('user', user)
			.where('acpw', acpw);
		return !!dbRes.length;
	},
	// str name | [ names ] => { }
	get: user =>
		db('circles').select('*')
			.whereIn('user', user.length ? user : [user]),
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
	// user => { size, karma, age} | false
	checkEligibility: async (user, attemptUnlock = false) => {
		const debug = Debug('key4key:circles:checkEligibility');
		let circleInfo;
		try {
			debug(`Getting circle info for ${user}`);
			circleInfo = await reddit.getCircleInfo(reqBody.user);
		} catch (e) {
			if (e.error.error === 404) {
				debug('Circle does not exist!');
				return false;
			}
			throw e;
		}
		debug(`Circle exists, murderer: ${circleInfo.murderer}`);
		debug(`betrayed: ${circleInfo.betrayed}`);
		if(circleInfo.murderer || circleInfo.betrayed) {
			return false;
		}
		if (attemptUnlock) {
			debug('Attempting unlock...');
			if (!(await reddit.unlockCircle(circleInfo.id, reqBody.pw))) {
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
			db('circles').delete().where('user', user);
			return;
		}
		await circles.update(userInfo);
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
			.where('age', '<=', senderInfo.reqage)
			.where('reqage', '>=', senderInfo.age)
			.whereNotIn('user', function() {
				this.select('initiator').from('users')
					.where('acceptor', user);
			})
			// we probably don't need both of these, but fuck it
			.whereNotIn('user', function() {
				this.select('acceptor').from('users')
					.where('initiator', user);
			})
			.orderByRaw('RANDOM()')
			.limit(1);
		return dbRes.length ? dbRes[0].user : false;
	},
};
module.exports = circles;