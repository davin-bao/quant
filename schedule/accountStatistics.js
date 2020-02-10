const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('../definitions/Log');
const AccountStatistics = require('../models/AccountStatistics');
require('total.js');

const Op = Sequelize.Op;

const handle = async () => {
    Log.Info(__filename, 'Account statistics ...');

    AccountStatistics.sync();
};

const accountStatisticsSchedule = () => {
    const cacheKey = 'TASK|ACCOUNT_STATISTICS';
    //每1hour定时执行一次:
    schedule.scheduleJob('0 */10 * * * *', () => {
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

exports = module.exports = accountStatisticsSchedule;