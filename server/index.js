const Koa = require('koa');
const koaStatic = require('koa-static');
const koaBody = require('koa-body');
const koaSession = require('koa-session');
const koaRouter = require('koa-router');
const koaViews = require('koa-views');
const koaCsrf = require('koa-csrf');
const Debug = require('debug');
const config = require('../config');
const circles = require('./circles');
const exchanges = require('./exchanges');
const reddit = require('./reddit-api');
const app = new Koa();
const router = new koaRouter();
app.use(koaStatic(`${__dirname}/../static`));
// so csrf is always available in templates
app.use((ctx, next) => { ctx.state.csrf = ctx.csrf; return next() });
app.use(koaViews(`${__dirname}/../views`, { extension: 'pug' }));
app.use(koaBody());
app.keys = config.keys;
app.use(koaSession(app));
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
		!isSimpleString(reqBody.pw) ||
		!isSimpleString(reqBody.acpw)) {
		debug('Not simple strings');
		ctx.state.errorRegister = 'request format error (user, pw, acpw not simple strings)';
		return;
	}
	const eligible = await circles.checkEligibility(reqBody.user);
	if (!eligible) {
		debug('Not eligible');
		ctx.state.errorRegister = 'Account not eligible for registration. Either you do not have a circle, you entered the incorrect circle password, or your circle was betrayed, or you are a traitor yourself!';
		return;
	}
	await circles.create(Object.assign({
		user: reqBody.user,
		pw: reqBody.pw,
		acpw: reqBody.acpw,
	}, eligible));
	ctx.session.user = reqBody.user;
};

const login = async ctx => {
	const debug = Debug('key4key:login');
	const reqBody = ctx.request.body;
	if (!isSimpleString(reqBody.user) || !isSimpleString(reqBody.acpw)) {
		ctx.state.errorLogin = 'invalid request (user and acpw simple strings';
	}
	const authed = await circles.checkAcAuth(reqBody.user, reqBody.acpw);
	if (!authed) {
		ctx.state.errorLogin = 'authentication failure, check your password';
	}
	ctx.session.user = reqBody.user;
};

const exchange = async ctx => {
	const exchanged = await exchanges.initiate(ctx.session.user);
	if (!exchanged) {
		ctx.state.errorMatch = 'No pair found :( Try lowering your limits or trying again later';
	}
};

const render = async (ctx, next) => {
	const debug = Debug('key4key:render');
	// make sure account exists, otherwise kick 'em out
	if (ctx.session.user) {
		const circlesRes = await circles.get(ctx.session.user);
		if (circlesRes.length === 0) {
			ctx.session.user = null;
		}
	}
	await next();
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
