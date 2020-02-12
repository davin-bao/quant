const schedule = require('node-schedule');
const Log = require('../definitions/Log');
const Strategy = require('../strategy/Strategy');
const Setting = require('../models/Setting');
require('total.js');

// 连续失败 5 次， 冻结 5 分钟
const maxFailedTimes = 5;

const handle = async () => {
    const settings  = await Setting.findAll({
        where: {
            enabled: true
        }
    });
    if(settings.length <= 0) return;

    for(const setting of settings){
        Log.Info(__filename, 'Checking ' + setting.market.toUpperCase() + ' ...');
        const failedTimesKeyA = 'TRADE|FAILED_TIME|' + setting.marketplace_a + '|' + setting.market;
        const failedTimesKeyB = 'TRADE|FAILED_TIME|' + setting.marketplace_b + '|' + setting.market;

        if(
            parseInt(F.cache.get(failedTimesKeyA)) >= maxFailedTimes ||
            parseInt(F.cache.get(failedTimesKeyB)) >= maxFailedTimes
        ){
            Log.Info(__filename, '累计连续失败交易次数 >' + maxFailedTimes + '终止查询 5 minutes');
            return;
        }

        const strategy = new Strategy(setting);
        await strategy.safety();
    }
};

const checkSchedule = async () => {
    const setting  = await Setting.findOne();

    //每2分钟定时执行一次:
    const cacheKey = 'TASK|CHECK|'+setting.market.toUpperCase();
    schedule.scheduleJob(setting.check_cron, () => {
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

exports = module.exports = checkSchedule;