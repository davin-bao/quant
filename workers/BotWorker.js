const schedule = require('node-schedule'); 
const Bots = require('../models/Bots');

const handle = async (instance) => {
    await instance.init();
    await instance.start();

    const worker = schedule.scheduleJob('*/5 * * * * *', async () => {
        const current = await Bots.findOne({
            where: { id: instance.id }
        });
        if (!current.enabled) {
            await instance.stop();
            worker.cancel();
        }
    });
};

const BotWorker = async () => {
    schedule.scheduleJob('* * * * * *', async () => {
        const instances = await Bots.findAll({
            where: {
                state: Bots.STOPED,
                enabled: true
            }
        });

        for (const instance of instances) {
            await handle(instance);
        }
    });
};

exports = module.exports = BotWorker;