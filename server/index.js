const Koa = require('koa');
const koaStatic = require('koa-static');
const koaBody = require('koa-body');
const koaSession = require('koa-session');
const koaRouter = require('koa-router');
const koaViews = require('koa-views');
const koaCsrf = require('koa-csrf');
const Debug = require('debug');
const config = require('../config');
const ips = require('./ips');
const circles = require('./circles');
const exchanges = require('./exchanges');
const reddit = require('./reddit-api');
const snoowrap = require('snoowrap');
const app = new Koa();
const router = new koaRouter();
app.proxy = config.proxy;
app.use(koaStatic(`${__dirname}/../static`));
// so csrf is always available in templates
app.use((ctx, next) => { ctx.state.csrf = ctx.csrf; return next() });
app.use(koaViews(`${__dirname}/../views`, { extension: 'pug' }));
app.use(koaBody());
app.keys = config.keys;
app.use(koaSession({ key: config.cookieId }, app));
//app.use(new koaCsrf());


const isSimpleString = str => /^[\x00-\x7F]{2,255}$/.test(str);
const isNumber = str => parseInt(str).toString() === str;

const updateAccount = async ctx => {
	const debug = Debug('key4key:updateAccount');
	debug(`Updating ${ctx.session.user}`);
	const reqBody = ctx.request.body;
	if (!isNumber(reqBody.reqkarma) || !isNumber(reqBody.reqage) || !isNumber(reqBody.reqsize) || !isNumber(reqBody.reqjoined)) {
		debug('reqkarma, reqage, reqsize, reqjoined are all required numbers');
		return;
	}
	debug('performing update');
	await circles.update(ctx.session.user, {
		reqkarma: reqBody.reqkarma,
		reqage: Date.now() / 1000 - reqBody.reqage * 86400,
		reqsize: reqBody.reqsize,
		reqjoined: reqBody.reqjoined,
	});
};

const register = async ctx => {
	const debug = Debug('key4key:create');
	const reqBody = ctx.request.body;
	if (!isSimpleString(reqBody.user) ||
		!isSimpleString(reqBody.pw)) {
		debug('Not simple strings');
		ctx.state.errorRegister = 'request format error (user, pw, acpw not simple strings)';
		return;
	}
	const user = reqBody.user.toLowerCase();
	debug(`Joining from IP ${ctx.ip}`);
	const ipOk = !(await ips.isBanned(ctx.ip));
	if (!ipOk) {
		debug('IP is banned');
	}
	if (!config.registrationOpen) {
		debug('registrations closed');
		ctx.state.errorRegister = 'Registration is temporarily closed. Please try again later!';
		return;
	}
	const eligible = ipOk && await circles.checkEligibility(user, reqBody.pw);
	if (!eligible) {
		debug('Not eligible');
		ctx.state.errorRegister = 'Account not eligible for registration. Either you do not have a circle, you entered the incorrect circle password, or you are a traitor!';
		return;
	}
	await circles.create(Object.assign({
		user: user,
		pw: reqBody.pw,
		acpw: 'dummy',
	}, eligible));
	await login(ctx);
};

const login = async ctx => {
	const debug = Debug('key4key:login');
	const reqBody = ctx.request.body;
	if (!isSimpleString(reqBody.user)) {
		ctx.state.errorLogin = 'invalid request (user and acpw simple strings';
		return;
	}
	const user = reqBody.user.toLowerCase();
	const circlesRes = await circles.get(user);
	if (circlesRes.length === 0) {
		ctx.state.errorLogin = 'Please register first.';
		return;
	}
	const redirTo = snoowrap.getAuthUrl({
		clientId: config.webClientId,
		redirectUri: config.webRedirectUrl,
		scope: [ 'identity' ],
		permanent: false,
	});
	ctx.redirect(redirTo);
};

const exchange = async ctx => {
	const debug = Debug('key4key:exchange');
	debug(`Exchanging for ${ctx.session.user}`);
	const exchangesInLastPeriod = await exchanges.findExchangesInPeriod(ctx.session.user, Date.now() / 1000 - config.rateLimitPeriod);
	debug(`exchanges in period: ${exchangesInLastPeriod}`);
	if (exchangesInLastPeriod >= config.rateLimitAmount) {
		debug('Rate limited');
		ctx.state.errorMatch = `Above rate limit of ${config.rateLimitAmount} per ${config.rateLimitPeriod/60} minutes`;
		return;
	}
	debug('Rate limit bypassed.');
	const exchanged = await exchanges.initiate(ctx.session.user);
	if (!exchanged) {
		ctx.state.errorMatch = 'No pair found :( Try lowering your limits or trying again later';
		return;
	}
};

const render = async (ctx, next) => {
	const debug = Debug('key4key:render');
	// make sure account exists, otherwise kick 'em out
	if (ctx.session.user) {
		await ips.add(ctx.session.user, ctx.ip);
		const circlesRes = await circles.get(ctx.session.user);
		if (circlesRes.length === 0) {
			ctx.session.user = null;
		} else {
			await circles.update(ctx.session.user, { viewed: Math.floor(Date.now() / 1000) });
		}
	}
	await next();
	if (ctx.headerSent) {
		return;
	}
	if (ctx.session.user) {
		const circle = await circles.get(ctx.session.user);
		// TODO: maybe don't give them all the properties?
		Object.assign(ctx.state, circle);
		const exs = await exchanges.get(ctx.session.user);
		debug(`Exchanges: ${exchanges}`);
		ctx.state.exchanges = exs;
		await ctx.render('dashboard');
	} else {
		await ctx.render('index');
	}
};

router.get('/callback', async ctx => {
	const debug = Debug('key4key:callback');
	if (!isSimpleString(ctx.query.code)) {
		debug('code was not simple string');
		ctx.throw(400, 'missing code query param');
	}
	debug(`code: ${ctx.query.code}`);
	const snooOpts = {
		userAgent: 'Key4Key by markasoftware',
		code: ctx.query.code,
		clientId: config.webClientId,
		clientSecret: config.webClientSecret,
		redirectUri: config.webRedirectUrl,
	};
	debug(`snooOpts: ${JSON.stringify(snooOpts)}`);
	const userReddit = await snoowrap.fromAuthCode(snooOpts);
	const user = (await userReddit.getMe().name).toLowerCase();
	// in render() it is verified that they have an account, so no need to do it again
	ctx.session.user = user;
	ctx.redirect(config.baseName);
});

router.post('/', render, async ctx => {
	switch (ctx.request.body.action) {
		case 'register':
			await register(ctx);
			break;
		case 'login':
			await login(ctx);
			break;
	}
	// the ones beyond this point need auth
	if (!ctx.session.user) {
		return;
	}
	switch (ctx.request.body.action) {
		case 'changereq':
			await updateAccount(ctx);
			break;
		case 'exchange':
			await exchange(ctx);
			break;
		case 'logout':
			ctx.session.user = null;
			break;
	}
});

router.get('/', render);

// update user info cron
setInterval(async () => {
	const debug = Debug('key4key:cron');
	const stalestInfo = await circles.findStalest();
	debug(`Stalest: ${JSON.stringify(stalestInfo)}`);
	if (!stalestInfo) {
		debug('No rows');
		return;
	}
	if (Date.now() - stalestInfo.refreshed < config.minRefreshGap) {
		debug(`Above min refresh gap of ${config.minRefreshGap}, skipping`);
		return;
	}
	debug('Performing update...');
	await circles.autoUpdate(stalestInfo.user);
}, config.refreshInterval);

app.use(router.routes());
app.listen(config.port);
