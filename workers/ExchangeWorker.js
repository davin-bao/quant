const schedule = require('node-schedule'); 
const Exchange = require('../models/Exchange');

const handle = async (instance) => {
    await instance.init();
    await instance.start();

    const worker = schedule.scheduleJob('*/5 * * * * *', async () => {
        const current = await Exchange.findOne({
            where: { id: instance.id }
        });
        if (!current.enabled) {
            await instance.stop();
            worker.cancel();
        }
    });
};

const ExchangeWorker = async () => {
    schedule.scheduleJob('*/10 * * * * *', async () => {
        const instances = await Exchange.findAll({
            where: {
                state: Exchange.STOPED,
                enabled: true
            }
        });

        for (const instance of instances) {
            await handle(instance);
        }
    });
};

exports = module.exports = ExchangeWorker;