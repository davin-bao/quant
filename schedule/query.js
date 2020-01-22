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
    Log.Info(__filename, 'query ...');

    const tradeTimeout = parseInt(setting.trade_timeout || 30);
    //获取所有等待交易的订单
    const timeLimit = (new Date().getTime()) - tradeTimeout * 1000;
    const orders = await Order.findAll({
        where: {
            state: Order.TRADING,
            ttime: {
                [Op.gte]: timeLimit
            }
        }
    });
    loop(orders, (async order => {
        if(!order || order.order_id === -1) return;
        const marketplace = order.marketplace;

        // 发起交易查询
        const mp = MarketplaceManager.get(marketplace, order.market);
        let orderResult = await mp.ordersQuery(order.order_id);

        if(orderResult instanceof Error){
            orderResult = {order_id: -1, state: Order.TRADING, error_message: orderResult.message};
        }
        const memo = orderResult.error_message;
        Log.Info(__filename, '查询交易 no：' + order.id + ',' + memo);
        await sequelize.transaction(async t=> {
            order.update({
                order_id: orderResult.order_id,
                state: orderResult.state,
                avg_price: orderResult.avg_price || 0,
                executed_volume: orderResult.executed_volume || 0,
                price: orderResult.price || 0,
                memo
            }, {transaction: t});

            if(orderResult.state === Order.FINISHED){
                const currencies = order.market.split('_').trim();
                const currencyAdd = order.side === 'buy' ? currencies[0] : currencies[1];
                const currencySub = order.side === 'buy' ? currencies[1] : currencies[0];

                const accountAdd = Account.getByMarketplaceAndCurrency(order.marketplace, currencyAdd);
                const accountSub = Account.getByMarketplaceAndCurrency(order.marketplace, currencySub);
                // 存入
                await accountAdd.deposit(orderResult.executed_volume, {transaction: t, relate_id: order.id});
                // 消费
                await accountSub.consume(orderResult.executed_volume, {transaction: t, relate_id: order.id});
            }
        });

    }));
};

const querySchedule = () => {
    const cacheKey = 'TASK|QUERY';
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

exports = module.exports = querySchedule;