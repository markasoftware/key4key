const Koa = require('koa');
const koaStatic = require('koa-static');
const koaBody = require('koa-body');
const koaSession = require('koa-session');
const koaRouter = require('koa-router');
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
 * - pw
 * 
 * response: HTTP code only
 * =200: you're logged in
 * =201: just created!
 * =401: Auth failed
 * =404: reddit acc does not exist
 * =418: circle key is incorrect or other similar error
 * 
 */
router.post('/api/login', async ctx => {
	const reqBody = ctx.request.body;
	if (!isSimpleString(reqBody.user) || !isSimpleString(reqBody.pw)) {
		ctx.throw(400, 'make sure user and pw exist and are simple strings');
	}
	const authed = await circles.checkAuth(reqBody.user, reqBody.pw);
	if (authed === 'fail') {
		ctx.throw(401, 'invalid pw');
	}
	if (authed === 'missing') {
		/*
		* Create circle
		* 
		* 1. Check that the circle exists and get size
		* 2. Check that the pw is correct
		* 3. Fetch user karma and age
		* 4. Insert into DB
		*/
		// 1.
		let circleInfo;
		try {
			circleInfo = await reddit.getCircleInfo(reqBody.user);
		} catch (e) {
			if (e.error.error === 404) {
				ctx.throw(404, 'reddit account does not exist');
			}
			throw e;
		}
		if(circleInfo.murderer) {
			ctx.throw(418, 'murderer');
		}
		if (circleInfo.betrayed) {
			ctx.throw(418, 'betrayed');
		}
		// 2.
		if (!(await reddit.unlockCircle(circleInfo.id, reqBody.pw))) {
			ctx.throw(418, 'Incorrect circle password');
		}
		// 3.
		const user = reddit.getUser(reqBody.user);
		const karma = (await user.link_karma) + (await user.comment_karma);
		const age = await user.created_utc;
		// 4.
		await circles.create({
			user: reqBody.user,
			pw: reqBody.pw,
			karma,
			age,
			size: circleInfo.size,
		});
	}
	// authed === 'ok' defaults to here as well...
	ctx.status = 200;
	ctx.session.user = reqBody.user;
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
	if (curCircle.initialized) {
		ctx.throw(303, 'already initialized');
	}
	await curCircle.initialize(ctx.session.user, {
		reqkarma: reqBody.reqkarma,
		reqage: reqBody.reqage,
		reqsize: reqBody.reqsize,
	});
	ctx.status = 200;
});

app.use(router.routes());

app.listen(config.port);
