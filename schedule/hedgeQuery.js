const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('../definitions/Log');
const Hedge = require('../models/Hedge');
const Order = require('../models/Order');
require('total.js');

const Op = Sequelize.Op;

const handle = async () => {
    Log.Info(__filename, 'Hedge query ...');

    const waitingHedges = await Hedge.findAll({
        where: {
            state: Hedge.WAITING
        },
        include: [{
            model: Order,
            where: { hedge_id: Sequelize.col('Hedge.id') }
        }]
    });

    for (const hedge of waitingHedges) {
        if (!hedge) return;

        if (hedge.state !== Hedge.WAITING) {
            return;
        }

        let state = Hedge.SUCCESS;
        for (const order of hedge.Orders) {
            if (order.state === Order.CANCEL) {
                state = Hedge.FAILED;
                break;
            } else if (order.state === Order.WAITING || order.state === Order.TRADING) {
                state = Hedge.WAITING;
            }
        }

        hedge.update({
            state: state,
            ftime: state === Hedge.WAITING ? hedge.ftime : new Date().getTime()
        });
    }
};

const querySchedule = () => {
    const cacheKey = 'TASK|HEDGE_QUERY';
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