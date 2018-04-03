const snoowrap = require('snoowrap');
const config = require('../config');
const r = new snoowrap({
	userAgent: 'Key4Key 0.1',
	clientId: config.clientId,
	clientSecret: config.clientSecret,
	username: config.user,
	password: config.pw,
});
// this will redirect to somewhere else
// I know this is horrible and not in the same style as the rest of snoowrap, but time is of the essence
r.getCircleInfo = async user => {
	const circleJson = await r._get({ uri: `user/${user}/circle.json` });
	const flair = circleJson.author_flair_text;
	return {
		murderer: flair.includes('∅'),
		betrayed: circleJson.is_betrayed,
		size: parseInt(flair),
		id: circleJson.name,
	};
};
r.unlockCircle = async (postid, pw) => {
	const resJson = await r._post({ uri: `api/guess_voting_key.json`, form: { id: postid, vote_key: pw }});
	return resJson[Object.keys(resJson)[0]];
};
module.exports = r;
