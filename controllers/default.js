const Sequelize = require('sequelize');
const Decimal = require('decimal');
const sequelize = require('../definitions/sequelize');
const Hedge = require('../models/Hedge');
const Order = require('../models/Order');
const Account = require('../models/Account');
const AccountLog = require('../models/AccountLog');
const Setting = require('../models/Setting');
const MarketplaceManager = require('../marketplace/Manager');

const Op = Sequelize.Op;

exports.install = function() {
    ROUTE('GET /',        get_index);
    // Login/Logout
    ROUTE('GET /login',  get_login);
    ROUTE('POST /login',  post_login);
    ROUTE('GET /logout', get_logout,   ['authorize']);

    ROUTE('GET /dashboard',        get_dashboard, ['authorize', '@admin']);
    ROUTE('GET /',        get_hedge_index, ['authorize', '@admin']);
    ROUTE('GET /setting',   get_setting_detail, ['authorize', '@admin']);
    ROUTE('POST /setting',  post_setting_detail, ['authorize', '@admin']);
    ROUTE('GET /hedge',   get_hedge_index, ['authorize', '@admin']);
    ROUTE('POST /hedge',  post_hedge_index, ['authorize', '@admin']);
    ROUTE('POST /orders',  post_order_index, ['authorize', '@admin']);
    ROUTE('POST /account/{marketplace}/{market}/',  post_account_detail, ['authorize', '@admin']);
    ROUTE('GET /account',   get_account_index, ['authorize', '@admin']);
    ROUTE('POST /account',  post_account_index, ['authorize', '@admin']);
    ROUTE('GET /account_log/{accountId}',   get_account_log_detail, ['authorize', '@admin']);
    ROUTE('POST /account_log',  post_account_log_index, ['authorize', '@admin']);
    ROUTE('POST /account_sync', post_account_sync, ['authorize', '@admin']);
};

function get_index() {
    const self = this;

    if (!self.cookie('__user')) {
        self.redirect('/login');
    }else {
        self.redirect('/dashboard');
    }
}

function get_dashboard() {
    const self = this;

    self.view('dashboard');
}

function get_login() {
    const self = this;

    if (!self.cookie('__user')) {
        self.layout('');
        self.view('authentication-login');
    }else {
        self.redirect('/hedge');
    }
}

function post_login(){
    const self = this;
    const username = self.body.username || NaN;
    const password = self.body.password || NaN;
    if(username === 'admin' && password === '12345'){
        self.cookie('__user', username, '1 day');
        CACHE('authorization|' + username, true, '1 day');

        self.json({code: 200, msg: 'success'});
    }
    self.json({code: 500, msg: '用户名或密码错误'});
}

function get_logout() {
    const self = this;
    F.cache.remove('authorization|' + self.cookie('__user'));
    self.cookie('__user', '', '-1 day');

    self.redirect('/');
}

async function get_setting_detail() {
    const setting = await Setting.findOne();
    // console.log(setting);
    this.view('setting_detail', setting);
}

async function post_setting_detail() {
    const self = this;
    const setting = await Setting.findOne();

    setting.update({
        available: self.body.available,
        market: self.body.market,
        marketplace_a: self.body.marketplace_a,
        marketplace_b: self.body.marketplace_b,
        depth: self.body.depth,
        volume_limit: self.body.volume_limit,    // 挂牌量大于该值，才进行交易判断
        volume: self.body.volume,          // 每次交易请求量
        safe_ratio: self.body.safe_ratio,      // 安全系数
        trade_timeout: self.body.trade_timeout,   // 交易超时阈值(s)
        check_cron: self.body.check_cron,
        enabled: self.body.enabled
    });

    self.json({code: 200, msg: 'success'});
}

function get_hedge_index() {
    const self = this;
    self.view('hedge_index');
}

async function post_hedge_index() {
    const self = this;
    const result = await Hedge.findAll({
        limit: 200,
        offset: 0,
        order: [
            ['id', 'DESC']
        ]
    });

    self.json({code: 200, msg: 'success', data: result});
}

async function post_order_index() {
    const self = this;
    const result = await Order.findAll({
        where: {
            hedge_id: self.body.hedge_id
        },
        limit: 200,
        offset: 0,
        order: [
            ['id', 'DESC']
        ]
    });

    self.json({code: 200, msg: 'success', data: result});
}

async function post_account_detail(marketplace, market) {
    const self = this;
    const currencies = market.split('_');
    const result = await Account.findAll({
        where: {
            marketplace: marketplace,
            currency: {
                [Op.in]: currencies
            }
        },
        limit: 200,
        offset: 0,
        order: [
            ['id', 'DESC']
        ]
    });

    self.json({code: 200, msg: 'success', data: result});
}

function get_account_index() {
    const self = this;
    self.view('account_index');
}

async function post_account_index() {
    const self = this;

    const { total } = await Account.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
    });

    const sort = [];
    for(let i=0; i<6; i++){
        if(self.body['order['+i+'][column]']) {
            sort.push([self.body['order['+i+'][column]'], self.body['order['+i+'][dir]']]);
        }
    }

    const result = await Account.findAll({
        limit: self.body.length,
        offset: self.body.start,
        order: sort
    });

    self.json({code: 200, msg: 'success', total, data: result});
}

function get_account_log_detail(accountId){
    const self = this;
    self.view('account_log_index', { accountId });
}


async function post_account_log_index() {
    const self = this;

    const { total } = await AccountLog.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']],
        where: {
            account_id: self.body.account_id
        }
    });

    const sort = [];
    for(let i=0; i<6; i++){
        if(self.body['order['+i+'][column]']) {
            sort.push([self.body['order['+i+'][column]'], self.body['order['+i+'][dir]']]);
        }
    }

    const result = await AccountLog.findAll({
        include: [{
            model: Account,
            where: { id: Sequelize.col('account_id') }
        }],
        where: {
            account_id: self.body.account_id
        },
        limit: self.body.length,
        offset: self.body.start,
        order: sort
    });

    self.json({code: 200, msg: 'success', total, data: result});
}

async function post_account_sync() {
    const self = this;

    const setting  = await Setting.instance();
    const accounts = await Account.findAll();

    const marketplaces =[];
    accounts.forEach(account => {
        if(!marketplaces[account.marketplace]){
            marketplaces[account.marketplace] = [];
        }
        marketplaces[account.marketplace].push(account);
    });

    const marketplaceKeys = Object.keys(marketplaces);
    for(let i=0; i<marketplaceKeys.length; i++){
        const mp = MarketplaceManager.get(marketplaceKeys[i], setting.market);
        const upstreamAccounts = await mp.getAccountList();

        await sequelize.transaction(async t=> {
            marketplaces[marketplaceKeys[i]].forEach(account => {
                let upstreamAvailable = 0, upstreamLocked = 0;
                upstreamAccounts.forEach(upstreamAccount => {
                    if (upstreamAccount.currency === account.currency) {
                        upstreamAvailable = upstreamAccount.available;
                        upstreamLocked = upstreamAccount.locked;
                    }
                });

                const available_change = Decimal(account.available).sub(upstreamAvailable).toNumber();
                const locked_change = Decimal(account.locked).sub(upstreamLocked).toNumber();

                const accountLog = new AccountLog({
                    account_id: account.id,
                    available_change: available_change,
                    available: upstreamAvailable,
                    locked_change: locked_change,
                    locked: upstreamLocked,
                    memo: '对账'
                });
                account.update({
                    available: upstreamAvailable,
                    locked: upstreamLocked
                }, {transaction: t});

                accountLog.save({transaction: t});
            });
        });
    }

    self.json({code: 200, msg: 'success'});
}