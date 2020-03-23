const Sequelize = require('sequelize');
const Decimal = require('../definitions/decimal');
const { DateFormat } = require('../definitions/utils');
const sequelize = require('../definitions/sequelize');
const Bots = require('../models/Bots');
const BotLog = require('../models/BotLog');
const Exchange = require('../models/Exchange');
const Profits = require('../models/Profits');

const Op = Sequelize.Op;

exports.install = function() {
    ROUTE('GET /',        get_index);
    // Login/Logout
    ROUTE('GET /login',  get_login);
    ROUTE('POST /login',  post_login);
    ROUTE('GET /logout', get_logout,   ['authorize']);

    ROUTE('GET /', get_main_page, ['authorize', '@admin']);
    ROUTE('GET /index/exchange', get_exchange_index, ['authorize', '@admin']);
    ROUTE('GET /dashboard_bot/{id}', get_dashboard_bot_index, ['authorize', '@admin']);
    ROUTE('GET /dashboard_exchange/{id}', get_dashboard_exchange_index, ['authorize', '@admin']);
    ROUTE('GET /dashboard_exchange_profits/{id}', get_profit_chart, ['authorize', '@admin']);
    ROUTE('GET /dashboard_bot_logs/{id}', get_bot_logs_index, ['authorize', '@admin']);
    ROUTE('POST /bot_enable/{id}', post_bot_enable, ['authorize', '@admin']);
    ROUTE('POST /bot_reset/{id}', post_bot_reset, ['authorize', '@admin']);

    ROUTE('GET /auotation_candle/{id}', get_auotation_candle, ['authorize', '@admin']);

};

function get_index() {
    const self = this;

    if (!self.cookie('__user')) {
        self.redirect('/login');
    }else {
        self.redirect('/');
    }
}

function get_main_page() {
    const self = this;
    self.view('index');
}

async function get_exchange_index() {
    const self = this;

    const { total } = await Exchange.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']]
    });

    const sort = getSort(self.query);

    const exchanges = await Exchange.findAll({
        limit: parseInt(self.query.length),
        offset: parseInt(self.query.start),
        order: sort
    });
    const result = [];
    for (const item of exchanges){
        const bot = await Bots.findOne({where: { exchange_id: item.id}});
        result.push({
            id: item.id,
            exchange: item.exchange,
            market: item.market,
            parameters: item.parameters,
            state: item.state,
            enabled: item.enabled,
            simulate: item.simulate,
            bot_state: bot.state
        })
    }

    self.json({ code: 200, msg: 'success', total, data: result });
}

async function get_dashboard_bot_index(id) {
    const self = this;
    const exchange = await Exchange.findOne({
        where: {
            id: (id || -1)
        }
    });
    const bot = await Bots.findOne({
        where: {
            exchange_id: (id || -1)
        }
    });
    exchange.state_css = exchange.state === 'stoped' ? 'bg-danger' : 'bg-success';
    bot.state_css = bot.state === 'stoped' ? 'bg-danger' : 'bg-success';

    self.view('dashboard_bot', { bot, exchange });
}

async function get_dashboard_exchange_index(id) {
    const self = this;
    const exchange = await Exchange.findOne({
        where: {
            id: (id || -1)
        }
    });
    
    exchange.state_css = exchange.state === 'stoped' ? 'bg-danger' : 'bg-success';

    self.view('dashboard_exchange', { exchange });
}

async function post_bot_enable(id) {
    const self = this;

    const exchange = await Exchange.findOne({
        where: {
            id: (id || -1)
        }
    });

    const bot = await Bots.findOne({
        where: {
            exchange_id: (id || -1)
        }
    });

    exchange && exchange.update({ enabled: !exchange.enabled });
    bot && bot.update({ enabled: !bot.enabled });

    self.json({ code: 200, msg: 'success', data: { enabled: exchange.enabled } });
}

async function post_bot_reset(id) {
    const self = this;

    const bot = await Bots.findOne({
        where: {
            exchange_id: (id || -1)
        }
    });

    bot && await bot.reset();

    self.json({ code: 200, msg: 'success', data: {} });
}

async function get_profit_chart(id) {
    const profits = await Profits.findAll({ where: { bot_id: id }, order: [['ctime', 'ASC']]});
    const xAxis = [];
    let legend = null;
    const datas = [];

    for (const profit of profits) {
        if (!legend) legend = profit.currency;
        xAxis.push(profit.ctime);
        datas.push(profit.balance);
    }

    this.json({ code: 200, msg: 'success', data: { legend: [legend], xAxis, data: [{ legend, value: datas}] } });
}

async function get_bot_logs_index(id) {
    const self = this;

    const { total } = await BotLog.findOne({
        raw: true,
        attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'total']],
        where: { bot_id: id }
    });

    const sort = getSort(self.query);

    const result = await BotLog.findAll({
        where: { bot_id: id },
        limit: parseInt(self.query.length),
        offset: parseInt(self.query.start),
        order: sort
    });

    self.json({ code: 200, msg: 'success', total, data: result });
}

async function get_auotation_candle(id) {
    const self = this;

    const exchange = await Exchange.findOne({
        where: {
            id,
        }
    });
    
    let candles = [];
    if(exchange){
        exchange.init();
        candles = await exchange.getCandle(600);
    }

    self.json({ code: 200, msg: 'success', data: candles });
}

function get_login() {
    const self = this;

    if (!self.cookie('__user')) {
        self.layout('');
        self.view('authentication-login');
    }else {
        self.redirect('/index');
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

function getSort(body) {
    const sort = [];
    for (let i = 0; i < 6; i++) {
        if (body['order[' + i + '][column]']) {
            sort.push([body['order[' + i + '][column]'], body['order[' + i + '][dir]']]);
        }
    }
    return sort;
}