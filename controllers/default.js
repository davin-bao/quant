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
    ROUTE('GET /',        redirect_index);
    // Login/Logout
    ROUTE('GET /login',  view_login);
    ROUTE('POST /login',  redirect_login);
    ROUTE('GET /logout', redirect_logout,   ['authorize']);

    ROUTE('GET /dashboard',        view_dashboard, ['authorize', '@admin']);
    ROUTE('GET /',        view_hedge_index, ['authorize', '@admin']);
    ROUTE('GET /hedge',   view_hedge_index, ['authorize', '@admin']);
    ROUTE('POST /hedge',  json_hedge_index, ['authorize', '@admin']);
    ROUTE('POST /orders',  json_order_index, ['authorize', '@admin']);
    ROUTE('POST /account/{marketplace}/{market}/',  json_account_detail, ['authorize', '@admin']);
    ROUTE('GET /account',   view_account_index, ['authorize', '@admin']);
    ROUTE('POST /account',  json_account_index, ['authorize', '@admin']);
    ROUTE('GET /account_log/{accountId}',   view_account_log_index, ['authorize', '@admin']);
    ROUTE('POST /account_log',  json_account_log_index, ['authorize', '@admin']);
    ROUTE('POST /account_sync', json_account_sync, ['authorize', '@admin']);
};

function redirect_index() {
    const self = this;

    if (!self.cookie('__user')) {
        self.redirect('/login');
    }else {
        self.redirect('/dashboard');
    }
}

function view_dashboard() {
    const self = this;

    self.view('dashboard');
}

function view_login() {
    const self = this;

    if (!self.cookie('__user')) {
        self.layout('');
        self.view('authentication-login');
    }else {
        self.redirect('/hedge');
    }
}

function redirect_login(){
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

function redirect_logout() {
    const self = this;
    F.cache.remove('authorization|' + self.cookie('__user'));
    self.cookie('__user', '', '-1 day');

    self.redirect('/');
}

function view_hedge_index() {
    const self = this;
    self.view('hedge_index');
}

async function json_hedge_index() {
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

async function json_order_index() {
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

async function json_account_detail(marketplace, market) {
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

function view_account_index() {
    const self = this;
    self.view('account_index');
}

async function json_account_index() {
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

function view_account_log_index(accountId){
    const self = this;
    self.view('account_log_index', { accountId });
}


async function json_account_log_index() {
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

async function json_account_sync() {
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