const Sequelize = require('sequelize');
const Decimal = require('decimal');
const sequelize = require('../definitions/sequelize');
const Hedge = require('../models/Hedge');
const Order = require('../models/Order');
const Account = require('../models/Account');
const AccountLog = require('../models/AccountLog');
const Setting = require('../models/Setting');
const AccountStatistics = require('../models/AccountStatistics');
const MarketplaceManager = require('../marketplace/Manager');

const Op = Sequelize.Op;

exports.install = function() {
    ROUTE('GET /',        get_index);
    // Login/Logout
    ROUTE('GET /login',  get_login);
    ROUTE('POST /login',  post_login);
    ROUTE('GET /logout', get_logout,   ['authorize']);

    ROUTE('GET /dashboard',        get_dashboard, ['authorize', '@admin']);
    ROUTE('GET /dashboard-account-statistics-chart', get_dashboard_account_statistics_chart, ['authorize', '@admin']);
    ROUTE('GET /dashboard-hedge-profit-chart', get_dashboard_hedge_profit_chart, ['authorize', '@admin']);
    ROUTE('GET /dashboard-hedge-success-chart', get_dashboard_hedge_success_chart, ['authorize', '@admin']);
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

async function get_dashboard_account_statistics_chart() {
    const self = this;
    const marketplace_a = 'zb';
    const marketplace_b = 'okex';

    const accountStatistics = await AccountStatistics.findAll({
        where: {
            marketplace_a,
            marketplace_b
        },
        limit: 100,
        order: [
            ['id', 'DESC']
        ]
    });

    let currency_a = '';
    let currency_b = '';
    const labels = [];
    const amount = [];
    const currency_a_a = [];
    const currency_a_b = [];
    const currency_b_a = [];
    const currency_b_b = [];

    for(const accountStatistic of accountStatistics){
        if(currency_a === ''){
            [currency_a, currency_b] = accountStatistic.market.trim().toUpperCase().split('_');
        }
        labels.unshift(accountStatistic.id);
        amount.unshift(accountStatistic.amount);
        currency_a_a.unshift(accountStatistic.currency_a_a);
        currency_a_b.unshift(accountStatistic.currency_a_b);
        currency_b_a.unshift(accountStatistic.currency_b_a);
        currency_b_b.unshift(accountStatistic.currency_b_b);
    }

    const res = {
        marketplace_a,
        marketplace_b,
        currency_a,
        currency_b,
        currency: currency_b,
        labels
    };

    switch (parseInt(self.query.type)) {
        case 0:
        default:
            res.amount_a = amount;
            res.amount_b = amount;
            break;
        case 1:
            res.currency = currency_a;
            res.amount_a = currency_a_a;
            res.amount_b = currency_b_a;
            break;
        case 2:
            res.currency = currency_b;
            res.amount_a = currency_a_b;
            res.amount_b = currency_b_b;
            break;
        case 3:
            res.amount_a = currency_a_a;
            res.amount_b = currency_a_b;
            break;
        case 4:
            res.amount_a = currency_b_a;
            res.amount_b = currency_b_b;
            break;
    }

    self.json({code: 200, msg: 'success', data: res});
}

async function get_dashboard_hedge_success_chart() {
    const self = this;
    const { total } = await Hedge.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
    });

    const { success } = await Hedge.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'success']],
        where: {
            state: Hedge.SUCCESS
        },
    });

    const res = {
        total,
        success
    };

    self.json({code: 200, msg: 'success', data: res});
}

async function get_dashboard_hedge_profit_chart() {
    const self = this;
    const result = await Hedge.findAll({
        limit: 100,
        order: [
            ['id', 'DESC']
        ]
    });

    const labels = [];
    const longSets = [];

    for(const hedge of result){
        labels.unshift(hedge.id);
        const long = (((new Date(hedge.ftime)) - (new Date(hedge.stime)))/1000).toFixed(0);
        longSets.unshift(long > 0 ? long : 0);
    }

    const res = {
        labels,
        longSets
    };

    self.json({code: 200, msg: 'success', data: res});
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

    const { total } = await Hedge.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
    });

    const sort = getSort(self.body);

    const result = await Hedge.findAll({
        limit: self.body.length,
        offset: self.body.start,
        order: sort
    });

    self.json({code: 200, msg: 'success', total, data: result});
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

function getSort(body) {
    const sort = [];
    for(let i=0; i<6; i++){
        if(body['order['+i+'][column]']) {
            sort.push([body['order['+i+'][column]'], body['order['+i+'][dir]']]);
        }
    }
    return sort;
}

async function post_account_index() {
    const self = this;

    const { total } = await Account.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
    });

    const sort = getSort(self.body);

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
    await Account.sync();

    self.json({code: 200, msg: 'success'});
}
