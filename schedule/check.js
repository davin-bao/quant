const { loop } = require('../definitions/utils');
const Log = require('../definitions/Log');
const schedule = require('node-schedule');
const Strategy = require('../strategy/Strategy');
const Setting = require('../models/Setting');

const handle = async () => {
    const setting  = await Setting.instance();
    Log.Info(__filename, 'querying ...');

    const strategy = new Strategy(setting);
    await strategy.safety();
};

const checkSchedule = () => {
    handle().catch(e => {
        console.log(e.message);
        Log.Error(e.message);
    });

    // test();
    return;
    //每小时定时执行一次:
    schedule.scheduleJob('0 0 * * * *', () => {
        Log.Info(__filename, 'Tick: ' + new Date());
        handle().catch(e => {
            Log.Error(e);
        });
    });
};

exports = module.exports = checkSchedule;