const Sequelize = require('sequelize');
const Decimal = require('../definitions/decimal');
const { DateFormat } = require('../definitions/utils');
const sequelize = require('../definitions/sequelize');
const Hedge = require('../models/Hedge');
const Order = require('../models/Order');
const Account = require('../models/Account');
const AccountLog = require('../models/AccountLog');
const Setting = require('../models/Setting');
const AccountStatistics = require('../models/AccountStatistics');
const MarketplaceManager = require('../marketplace/Manager');
const Lstm = require('../strategy/Lstm');

const Op = Sequelize.Op;

exports.install = function() {
    ROUTE('GET /',        get_index);
    // Login/Logout
    ROUTE('GET /login',  get_login);
    ROUTE('POST /login',  post_login);
    ROUTE('GET /logout', get_logout,   ['authorize']);

    ROUTE('GET /dashboard',        get_dashboard, ['authorize', '@admin']);
    ROUTE('GET /dashboard/{setting_id}', get_dashboard, ['authorize', '@admin']);
    ROUTE('GET /dashboard-account-statistics-chart', get_dashboard_account_statistics_chart, ['authorize', '@admin']);
    ROUTE('GET /dashboard-hedge-profit-chart', get_dashboard_hedge_profit_chart, ['authorize', '@admin']);
    ROUTE('GET /dashboard-hedge-life-chart', get_dashboard_hedge_life_chart, ['authorize', '@admin']);
    ROUTE('GET /dashboard-hedge-success-chart', get_dashboard_hedge_success_chart, ['authorize', '@admin']);
    ROUTE('GET /dashboard-order-side-chart', get_dashboard_order_side_chart, ['authorize', '@admin']);
    ROUTE('POST /dashboard/settings',        post_dashboard_settings, ['authorize', '@admin']);
    ROUTE('GET /',        get_hedge_index, ['authorize', '@admin']);
    ROUTE('GET /settings',   get_setting_index, ['authorize', '@admin']);
    ROUTE('POST /settings',  post_setting_index, ['authorize', '@admin']);
    ROUTE('GET /setting',   get_setting_detail, ['authorize', '@admin']);
    ROUTE('GET /setting/{setting}',   get_setting_detail, ['authorize', '@admin']);
    ROUTE('DELETE /setting',   delete_setting_detail, ['authorize', '@admin']);
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
    ROUTE('GET /predict', get_predict_detail, ['authorize', '@admin']);
    ROUTE('POST /train', post_train_detail, ['put', 600000, 'authorize', '@admin']);
    ROUTE('POST /predict', post_predict_detail, ['put', 60000, 'authorize', '@admin']);
};

function get_index() {
    const self = this;

    if (!self.cookie('__user')) {
        self.redirect('/login');
    }else {
        self.redirect('/dashboard');
    }
}

async function get_dashboard(setting_id) {
    const self = this;
    const setting = await Setting.findOne({
        where: {
            id: (setting_id || -1)
        }
    });
    let result = [];

    let where = {};

    if(setting){
        where = {
            market: setting.market
        };
    }
    const { profit } = await Hedge.findOne({
        raw: true,
        attributes: [[Sequelize.fn('SUM', Sequelize.col('profit')), 'profit']],
        where: {
            state: Hedge.SUCCESS,
            ...where,
        },
    });

    const { fee } = await Hedge.findOne({
        raw: true,
        attributes: [[Sequelize.fn('SUM', Sequelize.col('fee')), 'fee']],
        where: {
            state: Hedge.FAILED,
            ...where,
        },
    });

    self.view('dashboard', { setting, profit: Decimal(profit).toNumber().toFixed(6), fee: Decimal(fee).toNumber().toFixed(6) });
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

async function post_dashboard_settings(){
    const self = this;

    const { total } = await Setting.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
    });

    const sort = getSort(self.body);

    const settings = await Setting.findAll({
        limit: self.body.length,
        offset: self.body.start,
        order: sort
    });

    const result = [];
    for(const setting of settings){
        const { market, marketplace_a, marketplace_b } = setting;

        const { profit } = await Hedge.findOne({
            raw: true,
            attributes: [[Sequelize.fn('SUM', Sequelize.col('profit')), 'profit']],
            where: {
                state: Hedge.SUCCESS,
                market,
                [Op.or]: [
                    {
                        marketplace_buy: marketplace_a,
                        marketplace_sell: marketplace_b
                    }, {
                        marketplace_buy: marketplace_b,
                        marketplace_sell: marketplace_a
                    }
                ]
            },
        });

        const { total } = await Hedge.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']],
            where: {
                market,
                [Op.or]: [
                    {
                        marketplace_buy: marketplace_a,
                        marketplace_sell: marketplace_b
                    }, {
                        marketplace_buy: marketplace_b,
                        marketplace_sell: marketplace_a
                    }
                ]
            }
        });
        const { success } = await Hedge.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'success']],
            where: {
                state: Hedge.SUCCESS,
                market,
                [Op.or]: [
                    {
                        marketplace_buy: marketplace_a,
                        marketplace_sell: marketplace_b
                    }, {
                        marketplace_buy: marketplace_b,
                        marketplace_sell: marketplace_a
                    }
                ]
            },
        });

        result.push({
            id: setting.id,
            market: setting.market,
            marketplace_a: setting.marketplace_a,
            marketplace_b: setting.marketplace_b,
            total,
            success_ratio: total == 0 ? '0.00%' : Decimal(success).div(total).mul(100).toNumber().toFixed(2) + '%',
            profit: parseFloat(profit || '0').toFixed(8),
            enabled: setting.enabled,
            side_a: setting.side_a,
            side_b: setting.side_b
        });
    }

    self.json({code: 200, msg: 'success', total, data: result});
}

async function get_dashboard_account_statistics_chart() {
    const self = this;

    const setting = await Setting.findOne({
        where: {
            id: (self.query.id || 1)
        }
    });

    const { market, marketplace_a, marketplace_b } = setting;
    const timeLimit = (new Date().getTime()) - 3600 * 24 * 1000;

    const accountStatistics = await AccountStatistics.findAll({
        where: {
            market,
            marketplace_a,
            marketplace_b,
            ctime: {
                [Op.gte]: timeLimit
            }
        },
        limit: 100,
        order: [
            ['id', 'DESC']
        ]
    });

    let currency_a = '';
    let currency_b = '';
    const labels = [];
    const label_a = '';
    const label_b = '';
    const amount = [];
    const amount_t = [];
    const amount_a = [];
    const amount_b = [];
    const currency_a_a = [];
    const currency_a_b = [];
    const currency_b_a = [];
    const currency_b_b = [];

    for(const accountStatistic of accountStatistics){
        if(currency_a === ''){
            [currency_a, currency_b] = accountStatistic.market.trim().toUpperCase().split('_');
        }
        labels.unshift(DateFormat((new Date(accountStatistic.ctime)),'hh:mm:ss')); //accountStatistic.id); //
        amount.unshift(accountStatistic.amount);
        amount_t.unshift(Decimal(accountStatistic.currency_a_a/12).add(accountStatistic.currency_b_b/12).add(accountStatistic.currency_a_b).add(accountStatistic.currency_b_a).toNumber());
        amount_a.unshift(Decimal(accountStatistic.currency_a_a).add(accountStatistic.currency_b_b).toNumber());
        amount_b.unshift(Decimal(accountStatistic.currency_a_b).add(accountStatistic.currency_b_a).toNumber());
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
            res.label_a = '净值';
            res.label_b = '和值';
            res.amount_a = amount;
            res.amount_b = amount_t;
            break;
        case 1:
            res.label_a = currency_a;
            res.label_b = currency_b;
            res.amount_a = amount_a;
            res.amount_b = amount_b;
            break;
        case 2:
            res.label_a = marketplace_a;
            res.label_b = marketplace_b;
            res.amount_a = currency_a_a;
            res.amount_b = currency_b_b;
            break;
        case 3:
            res.label_a = marketplace_a;
            res.label_b = marketplace_b;
            res.amount_a = currency_a_b;
            res.amount_b = currency_b_a;
            break;
        case 4:
            res.label_a = currency_a;
            res.label_b = currency_b;
            res.amount_a = currency_a_a;
            res.amount_b = currency_a_b;
            break;
        case 5:
            res.label_a = currency_a;
            res.label_b = currency_b;
            res.amount_a = currency_b_b;
            res.amount_b = currency_b_a;
            break;
    }

    self.json({code: 200, msg: 'success', data: res});
}

async function get_dashboard_hedge_success_chart() {
    const self = this;
    const setting = await Setting.findOne({
        where: {
            id: (self.query.id || -1)
        }
    });
    if(!setting){
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

        self.json({code: 200, msg: 'success', data: { total, success }});
    }else{
        const { market, marketplace_a, marketplace_b } = setting;

        const { total } = await Hedge.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']],
            where: {
                market,
                [Op.or]: [
                    {
                        marketplace_buy: marketplace_a,
                        marketplace_sell: marketplace_b
                    }, {
                        marketplace_buy: marketplace_b,
                        marketplace_sell: marketplace_a
                    }
                ]
            }
        });

        const { success } = await Hedge.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'success']],
            where: {
                state: Hedge.SUCCESS,
                market,
                [Op.or]: [
                    {
                        marketplace_buy: marketplace_a,
                        marketplace_sell: marketplace_b
                    }, {
                        marketplace_buy: marketplace_b,
                        marketplace_sell: marketplace_a
                    }
                ]
            },
        });

        self.json({code: 200, msg: 'success', data: { total, success }});
    }
}

async function get_dashboard_hedge_profit_chart() {
    const self = this;

    const setting = await Setting.findOne({
        where: {
            id: (self.query.id || -1)
        }
    });
    let result = [];

    if(!setting){
        result = await Hedge.findAll({
            where: {
                state: Hedge.SUCCESS
            },
            limit: 9999,
            order: [
                ['id', 'DESC']
            ]
        });
    } else {
        const { market, marketplace_a, marketplace_b } = setting;
        result = await Hedge.findAll({
            where: {
                state: Hedge.SUCCESS,
                market,
                [Op.or]: [
                    {
                        marketplace_buy: marketplace_a,
                        marketplace_sell: marketplace_b
                    }, {
                        marketplace_buy: marketplace_b,
                        marketplace_sell: marketplace_a
                    }
                ]
            },
            limit: 9999,
            order: [
                ['id', 'DESC']
            ]
        });
    }

    const labels = [];
    const pureProfitSetInits = [];

    for(const hedge of result){
        labels.unshift(DateFormat((new Date(hedge.ftime)),'hh:mm:ss'));
        // labels.unshift(hedge.id);
        pureProfitSetInits.unshift(hedge.profit);
    }
    const pureProfitSets = [];
    let pureProfit = 0;
    for(let i=0; i< pureProfitSetInits.length; i++){
        pureProfit += pureProfitSetInits[i];
        pureProfitSets.push(pureProfit.toFixed(5));
    }

    const profitSetInits = [];
    const feeSetInits = [];

    for(const hedge of result){
        profitSetInits.unshift((hedge.price_sell - hedge.price_buy) * hedge.volume);
        feeSetInits.unshift(hedge.fee);
    }
    const profitSets = [];
    let profit = 0;
    for(let i=0; i< profitSetInits.length; i++){
        profit += profitSetInits[i];
        profitSets.push(profit.toFixed(5));
    }
    const feeSets = [];
    let fee = 0;
    for(let i=0; i< feeSetInits.length; i++){
        fee += feeSetInits[i];
        feeSets.push(fee.toFixed(5));
    }

    const res = {
        labels,
        pureProfitSets,
        profitSets,
        feeSets
    };

    self.json({code: 200, msg: 'success', data: res});
}

async function get_dashboard_hedge_life_chart() {
    const self = this;

    const setting = await Setting.findOne({
        where: {
            id: (self.query.id || -1)
        }
    });
    let result = [];
    if(!setting) {
        result = await Hedge.findAll({
            where: {
                state: Hedge.SUCCESS
            },
            limit: 999,
            order: [
                ['id', 'DESC']
            ]
        });
    } else {
        const { market, marketplace_a, marketplace_b } = setting;
        result = await Hedge.findAll({
            where: {
                state: Hedge.SUCCESS,
                market,
                [Op.or]: [
                    {
                        marketplace_buy: marketplace_a,
                        marketplace_sell: marketplace_b
                    }, {
                        marketplace_buy: marketplace_b,
                        marketplace_sell: marketplace_a
                    }
                ]
            },
            limit: 999,
            order: [
                ['id', 'DESC']
            ]
        });
    }

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

async function get_dashboard_order_side_chart() {
    const self = this;
    const setting = await Setting.findOne({
        where: {
            id: (self.query.id || -1)
        }
    });
    let res = {
        labels: [],
        marketplace_a: '',
        marketplace_b: '',
        side_a: [],
        side_b: []
    };

    if(setting){
        const orders = await Order.findAll({
            where: {
                market: setting.market
            },
            limit: 99,
            order: [
                ['id', 'DESC']
            ]
        });

        const labels = [];
        const marketplace_a = setting.marketplace_a;
        const marketplace_b = setting.marketplace_b;
        const side_a = [];
        const side_b = [];

        const side_a_inits = [];
        const side_b_inits = [];

        for(const order of orders){
            labels.unshift(order.id);
            if(order.marketplace === marketplace_a) {
                side_a_inits.unshift(order.side === Order.SIDE_BUY ? 1 : -1);
                side_b_inits.unshift(0);
            }
            if(order.marketplace === marketplace_b) {
                side_b_inits.unshift(order.side === Order.SIDE_BUY ? 1 : -1);
                side_a_inits.unshift(0);
            }
        }

        let side_a_tmp = 0;
        for(let i=0; i< side_a_inits.length; i++){
            side_a_tmp += side_a_inits[i];
            side_a.push(side_a_tmp);
        }

        let side_b_tmp = 0;
        for(let i=0; i< side_b_inits.length; i++){
            side_b_tmp += side_b_inits[i];
            side_b.push(side_b_tmp);
        }

        res = {
            labels,
            marketplace_a,
            marketplace_b,
            side_a,
            side_b
        };
    }

    self.json({code: 200, msg: 'success', data: res});
}

async function get_setting_index() {
    const self = this;
    self.view('setting_index');
}

async function post_setting_index() {
    const self = this;

    const { total } = await Setting.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
    });

    const sort = getSort(self.body);

    const result = await Setting.findAll({
        limit: self.body.length,
        offset: self.body.start,
        order: sort
    });

    self.json({code: 200, msg: 'success', total, data: result});
}

async function get_setting_detail(settingId) {
    settingId = settingId || -1;
    const setting = await Setting.findOne({
        where: {id: settingId}
    });

    this.view('setting_detail', setting);
}

async function post_setting_detail() {
    const self = this;

    const params = {available: self.body.available,
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
    };

    if(parseInt(self.body.id) > 0){
        const setting = await Setting.findOne({
            where: {id: self.body.id}
        });
        await setting.update(params);
    }else{
        await Setting.create(params);
    }

    self.json({code: 200, msg: 'success'});
}

async function delete_setting_detail() {
    const self = this;
    if(parseInt(self.body.id) > 0){
        const setting = await Setting.findOne({
            where: {id: self.body.id}
        });
        await setting.destroy();
    }

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
    await Account.synchronize();

    self.json({code: 200, msg: 'success'});
}

function get_predict_detail(marketplace, market, granularity) {
    //
    const self = this;

    self.view('predict', { market, marketplace, granularity });
}

async function post_train_detail() {
    //
    const self = this;
    let lstm = new Lstm(this.body);
    const res = await lstm.trainModel();
    

    // const res = {
    //     labels,
    //     testData,
    //     predData
    // };

    self.json({ code: 200, msg: 'success', data: res });
}

async function post_predict_detail() {
    //
    const self = this;
    const lstm = new Lstm(this.body);
    await lstm.init();
    
    const { labels, actualData, predData, profit, percent } = await lstm.predict(parseInt(self.body.index));

    const res = {
        labels,
        actualData,
        predData,
        profit, 
        percent
    };

    self.json({ code: 200, msg: 'success', data: res });
}