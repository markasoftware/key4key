module.exports = {
	webClientId: '54321',
	webClientSecret: '0987654321',
	webRedirectUrl: 'http://127.0.0.1:8880/callback',
	clientId: '12345',
	clientSecret: '1234567890',
	baseName: '/',
	user: 'user',
	pw: 'password',
	port: 8880,
	// how often refreshes will be attempted, so to not hit rate limits
	refreshInterval: 5000,
	// will not refresh an account if it has been updated within this amount of time
	minRefreshGap: 300000,
	listExchangeLimit: 50,
	exchangeSpacing: 120000,
	rateLimitPeriod: 60 * 30,
	rateLimitAmount: 3,
	// allow betrayed or size 0 circles to join?
	allowBetrayed: true,
	dbPath: '/tmp/key4key.sqlite',
	blacklist: ['spez'],
	// cookie signing keys
	keys: [ 'correct', 'horse', 'battery', 'staple' ],
};
