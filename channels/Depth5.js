const Sequelize = require('sequelize');
const Datetime = require('node-datetime');
const Sqlite = require('../definitions/sqlite');
const Channel = require('./Channel');
const Event = require('../models/Event');
const sequelize = require('../definitions/sequelize');

const Op = Sequelize.Op;

class Depth5 extends Channel { }

Depth5.init({
    exchange_id: { type: Sequelize.INTEGER, comment: '交易所ID', defaultValue: 0 },
    time: { type: Sequelize.DATE, comment: '时间' },
    timestamp: { type: Sequelize.STRING(15), comment: '时间戳' },
    data: { type: Sequelize.TEXT, comment: '数据体' }
}, {
    // sequelize: Sqlite,
    sequelize,
    tableName: 'channel_depth5',
    timestamps: false,
});

Depth5.addRecord = async (attributes, size = 300) => {
    const { time, timestamp, exchange_id, asks, bids } = attributes;

    await Depth5.create({
        exchange_id,
        timestamp,
        time,
        data: JSON.stringify({
            asks,
            bids
        })
    });

    const event = Event.getInstance();
    event.emit(Event.CHANNEL_DEPTH5_ADD, attributes);
    await Depth5.clearHistory(exchange_id, size);
};

Depth5.clearHistory = async (exchange_id, size) => {
    const dt = Datetime.create();
    await Depth5.destroy({ where: { exchange_id, timestamp: { [Op.lte]: dt.getTime() - size * 1000 } } });
};

Depth5.getLastSecondsRecord = async (exchange_id, seconds = 1) => {
    const dt = Datetime.create();
    await Depth5.findAll({ where: { exchange_id, timestamp: { [Op.gte]: dt.getTime() - seconds * 1000 } }, order: [['timestamp', 'DESC']] });
};

exports = module.exports = Depth5;