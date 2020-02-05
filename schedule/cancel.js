const Sequelize = require('sequelize');
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
    Log.Info(__filename, 'canceling ...');

    const tradeTimeout = parseInt(setting.trade_timeout || 30);
    //获取所有等待交易的订单
    const timeLimit = (new Date().getTime()) - (tradeTimeout + 5) * 1000;

    const waitingOrders = await Order.findAll({
        where: {
            state: Order.WAITING,
            ctime: {
                [Op.lt]: timeLimit
            }
        }
    });
    loop(waitingOrders, (async order => {
        if (!order) return;

        if (order.state === Order.WAITING) {
            order.update({
                order_id: -1,
                state: Order.CANCEL,
                remaining_volume: order.volume,
                avg_price: 0,
                executed_volume: 0,
                price: 0,
                memo: '等待发起交易超时'
            });
        }
    }));

    const tradingOrders = await Order.findAll({
        where: {
            state: Order.TRADING,
            ttime: {
                [Op.lt]: timeLimit
            }
        }
    });
    loop(tradingOrders, (async order => {
        if(!order || order.order_id === -1) return;

        const marketplace = order.marketplace;

        // 发起交易查询
        const mp = MarketplaceManager.get(marketplace, order.market);
        let orderResult = await mp.ordersCancel(order.order_id);

        if(orderResult instanceof Error){
            orderResult = {order_id: -1, state: Order.TRADING, error_message: orderResult.message};
        }
        const memo = orderResult.error_message;
        Log.Info(__filename, '查询交易 no：' + order.id + ',' + memo);

        order.update({
            state: orderResult.state,
            avg_price: orderResult.avg_price || 0,
            executed_volume: orderResult.executed_volume || 0,
            price: orderResult.price || 0,
            ttime: new Date().getTime(),
            memo
        });

        if(orderResult.state === Order.CANCEL){
            const currencies = order.market.split('_').trim();
            const currency = order.side === 'buy' ? currencies[1] : currencies[0];
            const account = await Account.getByMarketplaceAndCurrency(marketplace, currency);
            await account.unlock(order.volume, {transaction: t, relate_id: order.id});
        }
    }));
};

const querySchedule = () => {
    const cacheKey = 'TASK|CANCEL';
    //每60s定时执行一次:
    schedule.scheduleJob('0 * * * * *', () => {
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

exports = module.exports = querySchedule;