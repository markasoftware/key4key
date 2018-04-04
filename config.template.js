module.exports = {
	clientId: '12345',
	clientSecret: '1234567890',
	user: 'user',
	pw: 'password',
	port: 8880,
	// how often refreshes will be attempted, so to not hit rate limits
	refreshInterval: 5000,
	// will not refresh an account if it has been updated within this amount of time
	minRefreshGap: 300000,
	dbPath: '/tmp/key4key.sqlite',
	// cookie signing keys
	keys: [ 'correct', 'horse', 'battery', 'staple' ],
};
