const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('../definitions/Log');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
require('total.js');

const Op = Sequelize.Op;

const handle = async () => {
    const settings  = await Setting.findAll({
        where: { enabled: true }
    });
    for(const setting of settings) {
        Log.Info(__filename, 'Canceling ' + setting.market.toUpperCase() + ' ...');

        const tradeTimeout = parseInt(setting.trade_timeout || 30);
        //获取所有等待交易的订单
        const timeLimit = (new Date().getTime()) - (tradeTimeout + 5) * 1000;

        const waitingOrders = await Order.findAll({
            where: {
                market: setting.market,
                state: Order.WAITING,
                ctime: {
                    [Op.lt]: timeLimit
                }
            }
        });
        for (const order of waitingOrders) {
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
        }

        const tradingOrders = await Order.findAll({
            where: {
                market: setting.market,
                state: Order.TRADING,
                ttime: {
                    [Op.lt]: timeLimit
                }
            }
        });

        for (const order of tradingOrders) {
            if (!order || order.order_id === '-1') return;
            await order.cancel();
        }
    }
};

const querySchedule = () => {
    const cacheKey = 'TASK|CANCEL';
    //每30s定时执行一次:
    schedule.scheduleJob('*/30 * * * * *', () => {
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