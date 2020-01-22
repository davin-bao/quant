const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const schedule = require('node-schedule');
const Decimal = require('decimal');
const { loop } = require('../definitions/utils');
const Log = require('../definitions/Log');
const MarketplaceManager = require('../marketplace/Manager');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const Account = require('../models/Account');
const Error = require('../marketplace/response/Error');
require('total.js');

const Op = Sequelize.Op;

const handle = async () => {
    const setting  = await Setting.instance();
    Log.Info(__filename, 'trading ...');

    const tradeTimeout = parseInt(setting.trade_timeout || 30);
    //获取所有等待交易的订单
    const timeLimit = (new Date().getTime()) - tradeTimeout * 1000;
    const orders = await Order.findAll({
        where: {
            state: Order.WAITING,
            ctime: {
                [Op.gte]: timeLimit
            }
        }
    });
    loop(orders, (async order => {
        if(!order) return;
        const marketplace = order.marketplace;
        const currencies = order.market.split('_').trim();
        const currency = order.side === 'buy' ? currencies[1] : currencies[0];
        const account = await Account.getByMarketplaceAndCurrency(marketplace, currency);

        if(!account) {
            const memo = '账户 ' + marketplace +  '/' + currency + ' 不存在, 终止交易';
            Log.Info(__filename, '发起交易 no：' + order.id + ' ' + memo);
            order.update({
                state: Order.CANCEL,
                memo
            });
            return;
        }
        if(Decimal(account.available).sub(order.volume).toNumber() < 0){
            const memo = '账户 ' + marketplace +  '/' + currency + ' 余额不足, 终止交易';
            Log.Info(__filename, '发起交易 no：' + order.id + ' ' + memo);
            order.update({
                state: Order.CANCEL,
                memo
            });
            return;
        }
        // 发起交易请求
        const mp = MarketplaceManager.get(marketplace, order.market);
        let orderResult = await mp.orders(order.side, order.price, order.volume, order.id);

        if(orderResult instanceof Error){
            orderResult = {order_id: -1, result: false, error_message: orderResult.message};
        }
        const memo = orderResult.error_message;
        Log.Info(__filename, '发起交易 no：' + order.id + ',结果: ' + orderResult.result + ',' + memo);
        await sequelize.transaction(async t=> {
            order.update({
                order_id: orderResult.order_id,
                state: orderResult.result ? Order.TRADING : Order.CANCEL,
                ttime: new Date().getTime(),
                memo
            });

            if (orderResult.state === Order.TRADING) {
                // 锁定
                await account.lock(order.volume, {transaction: t, relate_id: order.id});
            }
        });
    }));
};

const tradeSchedule = () => {
    const cacheKey = 'TASK|TRADE';
    //每10s定时执行一次:
    schedule.scheduleJob('*/10 * * * * *', () => {
        if (!F.cache.get(cacheKey)) {
            F.cache.set2(cacheKey, true, '1 hour');

            handle().catch(e => {
                Log.Error(__filename, e);
            }).finally(() => {
                F.cache.remove(cacheKey);
            });
        }
    });
};

exports = module.exports = tradeSchedule;