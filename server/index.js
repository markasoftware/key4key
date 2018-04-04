const Koa = require('koa');
const koaStatic = require('koa-static');
const koaBody = require('koa-body');
const koaSession = require('koa-session');
const koaRouter = require('koa-router');
const Debug = require('debug');
const config = require('../config');
const circles = require('./circles');
const reddit = require('./reddit-api');
const app = new Koa();
const router = new koaRouter();
app.use(koaStatic(`${__dirname}/../client-dist`));
app.use(koaBody());
app.keys = config.keys;
app.use(koaSession(app));


const isSimpleString = str => /^[\x00-\x7F]{2,255}$/.test(str);
const isNumber = str => parseInt(str).toString() === str;
const loggedIn = async (ctx, next) => {
	if (!ctx.session.user) {
		ctx.throw(401, 'please login');
	}
	await next();
}

/*
 * request:
 * - user
 * - pw (circle)
 * - acpw (account)
 * 
 * response: HTTP code only
 * =201: ok, and you're logged in
 * =418: You are not eligible for an account
 */
router.post('/api/circles', async ctx => {
	const debug = Debug('key4key:create');
	const reqBody = ctx.request.body;
	if (!isSimpleString(reqBody.user) ||
		!isSimpleString(reqBody.pw) ||
		!isSimpleString(reqBody.acpw)) {
		debug('Not simple strings');
		ctx.throw(400, 'requires user, pw, and acpw all to be simple strings');
	}
	const eligible = await circles.checkEligibility(reqBody.user);
	if (!eligible) {
		ctx.throw(418, 'account not eligible');
	}
	await circles.create(Object.assign({
		user: reqBody.user,
		pw: reqBody.pw,
		acpw: reqBody.acpw,
	}, eligible));
	ctx.session.user = reqBody.user;
	ctx.status = 201;
});

/*
 * request:
 * - user
 * - acpw
 * 
 * response: HTTP code only
 * =200: you're logged in
 * =401: Auth failed
 * =418: circle key is incorrect or other similar error
 * 
 */
router.post('/api/login', async ctx => {
	const debug = Debug('key4key:login');
	const reqBody = ctx.request.body;
	if (!isSimpleString(reqBody.user) || !isSimpleString(reqBody.acpw)) {
		ctx.throw(400, 'make sure user and pw exist and are simple strings');
	}
	const authed = await circles.checkAuth(reqBody.user, reqBody.acpw);
	if (!authed) {
		ctx.throw(401, 'invalid pw');
	}
	ctx.session.user = reqBody.user;
	ctx.status = 200;
});

/*
 * request: empty
 * 
 * response: HTTP 200
 */
router.post('/api/logout', async ctx => {
	ctx.session = null;
	ctx.status = 200;
});

/*
 * request:
 * - reqkarma
 * - reqage
 * - reqsize
 * 
 * response: HTTP code only
 * =200: Done as you requested
 * =303: Already initialized, can't do it again
 */
router.put('/api/circles', async ctx => {
	const reqBody = ctx.request.body;
	if (!isNumber(reqBody.reqkarma) || !isNumber(reqBody.reqage) || !isNumber(reqBody.reqsize)) {
		ctx.throw(400, 'reqkarma, reqage, and reqsize are all required and need to be numbers');
	}
	const curCircle = await circles.get(ctx.session.user);
	await curCircle.update(ctx.session.user, {
		reqkarma: reqBody.reqkarma,
		reqage: reqBody.reqage,
		reqsize: reqBody.reqsize,
	});
	ctx.status = 200;
});

// update user info cron
setInterval(async () => {
	const debug = Debug('key4key:cron');
	const stalestInfo = await circles.findStalest();
	debug(`Stalest: ${JSON.stringify(stalestInfo)}`);
	if (!stalestInfo) {
		debug('No rows');
		return;
	}
	if (Date.now() - stalestInfo.refreshed * 1000 < config.minRefreshGap) {
		debug(`Above min refresh gap of ${config.minRefreshGap}, skipping`);
		return;
	}
	debug('Performing update...');
	await circles.autoUpdate(stalest);
}, config.refreshInterval);

app.use(router.routes());
app.listen(config.port);
