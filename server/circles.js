const db = require('./db');

// hashing passwords is for amateurs

const circle = {
	// str name -> str pw => str ('ok' | 'fail' | 'missing')
	checkAuth: async (user, pw) => {
		const dbRes = await db('circles').select('pw').where('user', user);
		if (dbRes.length === 0) {
			return 'missing';
		}
		return dbRes[0].pw === pw ? 'ok' : 'fail';
	},
	// str name => { }
	get: user =>
		db('circles').select('*').where('user', user),
	// { user, pw, reqkarma, reqage, reqsize } => undef
	create: acinfo =>
		db('circles').insert(Object.assign({ refreshed: Date.now() }, acinfo)),
	initialize: (user, reqstuff) =>
		db('circles').update(Object.assign({ initialized: 1 }, reqstuff)).where('user', user),
};
module.exports = circle;
