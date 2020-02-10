const schedule = require('node-schedule');
const Log = require('../definitions/Log');
const Strategy = require('../strategy/Strategy');
const Setting = require('../models/Setting');
require('total.js');

const handle = async () => {
    const settings  = await Setting.findAll({
        where: {
            enabled: true
        }
    });
    if(settings.length <= 0) return;

    for(const setting of settings){
        Log.Info(__filename, 'Checking ' + setting.market.toUpperCase() + ' ...');
        const strategy = new Strategy(setting);
        await strategy.danger();
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