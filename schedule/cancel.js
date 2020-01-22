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

const Op = Sequelize.Op;

const handle = async () => {
    const setting  = await Setting.instance();
    Log.Info(__filename, 'query ...');

    const tradeTimeout = parseInt(setting.trade_timeout || 30);
    //获取所有等待交易的订单
    const timeLimit = (new Date().getTime()) - tradeTimeout * 1000 * 100000;

    const waitingOrders = await Order.findAll({
        where: {
            state: Order.WAITING,
            ctime: {
                [Op.gte]: timeLimit
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
                [Op.gte]: timeLimit
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
            order_id: orderResult.order_id,
            state: orderResult.state,
            avg_price: orderResult.avg_price || 0,
            executed_volume: orderResult.executed_volume || 0,
            price: orderResult.price || 0,
            memo
        });
    }));
};

const querySchedule = () => {
    handle().catch(e => {
        console.log(e.message);
        Log.Error(e.message);
    });
};

exports = module.exports = querySchedule;