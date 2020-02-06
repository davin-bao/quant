const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('../definitions/Log');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
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
    for (const order of orders) {
        if(!order) return;

        await order.trade();
    }
};

const tradeSchedule = () => {
    const cacheKey = 'TASK|TRADE';
    //每1s定时执行一次:
    schedule.scheduleJob('* * * * * *', () => {
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