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
        Log.Info(__filename, 'Instrument querying  ' + setting.market.toUpperCase() + ' ...');

        // A 所
        const mp = MarketplaceManager.get(setting.marketplace_a, setting.market);
        // 获取市场深度
        const depthA = await mp.getDepth(this.depthSize);

        const tradeTimeout = parseInt(setting.trade_timeout || 30);
        //获取所有等待交易的订单
        const timeLimit = (new Date().getTime()) - tradeTimeout * 1000;
        const orders = await Order.findAll({
            where: {
                market: setting.market,
                [Op.or]: [
                    {
                        hedge_id: {[Op.ne]: -1},
                        state: Order.TRADING,
                        ttime: {
                            [Op.gte]: timeLimit
                        }
                    }, {
                        hedge_id: -1,
                        state: Order.TRADING,
                    }
                ]
            }
        });
        for (const order of orders) {
            if (!order || (order.order_id === '-1' && order.hedge_id !== -1)) return;
            await order.query();
        }

        const balanceOrders = await Order.findAll({
            where: {
                market: setting.market,
                hedge_id: -1,
                state: {
                    [Op.or]: [Order.WAITING, Order.TRADING]
                }
            }
        });
        for (const order of balanceOrders) {
            if (order.state === Order.WAITING) {
                await order.tradeBalance();
            }
        }
        if (orders.length <= 0) {
            // 开启交易
            // setting.update({
            //     enabled: true
            // });
        }

        const balanceCancelOrders = await Order.findAll({
            where: {
                market: setting.market,
                hedge_id: -1,
                state: Order.CANCEL
            }
        });
        for (const order of balanceCancelOrders) {
            Log.Info(__filename, '等待发起交易超时:' + (order.memo === '等待发起交易超时') + ', no:' + order.id);
            if (order.memo === '等待发起交易超时') {
                await order.tradeBalance();
            } else {
                await order.update({
                    state: Order.TRADING
                });
            }
        }
    }
};

const instrumentSchedule = () => {
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

exports = module.exports = instrumentSchedule;