const fs = require('fs');
const tf = require('@tensorflow/tfjs');
const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const MarketplaceManager = require('../marketplace/Manager');
const Log = require('../definitions/Log');
const { Transpose } = require('../definitions/utils');
const { window, normaliseX, normaliseY } = require('../definitions/tensorUtils');
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const Lstm = require('../strategy/Lstm');
require('total.js');
require('tfjs-node-save');


const Op = Sequelize.Op;

const handle = async () => {

    const lstm = new Lstm({
        market: 'etc_usdt',
        marketplace: 'okex',
        granularity: 3600
    });
    await lstm.predict();
};

const aiSchedule = () => {
    // const cacheKey = 'TASK|TRADE';
    //每1s定时执行一次:
    // schedule.scheduleJob('*/10 * * * * *', () => {
    //     if (!F.cache.get(cacheKey)) {
    //         F.cache.set(cacheKey, true, '1 hour');

            handle().catch(e => {
                Log.Error(__filename, e);
            }).finally(() => {
                // F.cache.remove(cacheKey);
            });
        // }
    // });
};

exports = module.exports = aiSchedule;