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
        Log.Info(__filename, 'Trading ' + setting.market.toUpperCase() + ' ...');

        const tradeTimeout = parseInt(setting.trade_timeout || 30);
        //获取所有等待交易的订单
        const timeLimit = (new Date().getTime()) - tradeTimeout * 1000;
        // check.js 中已经进行了交易请求, 这里只需要进行重试
        const orders = await Order.findAll({
            where: {
                market: setting.market,
                state: Order.NEED_TRADE,
                ctime: {
                    [Op.gte]: timeLimit
                }
            }
        });
        for (const order of orders) {
            if(!order) return;

            await order.trade();
        }
    }
};

const tradeSchedule = () => {
    const cacheKey = 'TASK|TRADE';
    //每1s定时执行一次:
    schedule.scheduleJob('*/10 * * * * *', () => {
        if (!F.cache.get(cacheKey)) {
            F.cache.set(cacheKey, true, '1 hour');

            handle().catch(e => {
                Log.Error(__filename, e);
            }).finally(() => {
                F.cache.remove(cacheKey);
            });
        }
    });
};

exports = module.exports = tradeSchedule;