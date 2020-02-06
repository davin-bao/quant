const schedule = require('node-schedule');
const Log = require('../definitions/Log');
const Strategy = require('../strategy/Strategy');
const Setting = require('../models/Setting');
require('total.js');

const handle = async () => {
    Log.Info(__filename, 'checking ...');
    const setting  = await  Setting.findOne({
        where: {
            enabled: true
        }
    });
    if(!setting) return;

    const strategy = new Strategy(setting);
    await strategy.safety();
};

const checkSchedule = async () => {
    const setting  = await Setting.instance();

    //每2分钟定时执行一次:
    const cacheKey = 'TASK|CHECK';
    schedule.scheduleJob(setting.check_cron, () => {
        if(!F.cache.get(cacheKey)){
            F.cache.set2(cacheKey, true, '1 hour');
            handle().catch(e => {
                Log.Error(__filename, e);
            }).finally(()=>{
                F.cache.remove(cacheKey);
            });
        }
    });
};

exports = module.exports = checkSchedule;