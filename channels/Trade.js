const Sequelize = require('sequelize');
const Datetime = require('node-datetime');
const Sqlite = require('../definitions/sqlite');
const sequelize = require('../definitions/sequelize');
const Channel = require('./Channel');
const Event = require('../models/Event');

const Op = Sequelize.Op;

class Trade extends Channel { }

Trade.init({
    exchange_id: { type: Sequelize.INTEGER, comment: '交易所ID', defaultValue: 0 },
    time: { type: Sequelize.DATE, comment: '时间' },
    timestamp: { type: Sequelize.STRING(15), comment: '时间戳' },
    data: { type: Sequelize.TEXT, comment: '数据体' }
}, {
    sequelize,
    tableName: 'channel_trades',
    timestamps: false,
});

Trade.addRecord = async (attributes, cacheSize = 300) => {
    const { time, timestamp, exchange_id, trade_id, price, size, side } = attributes;

    await Trade.create({
        exchange_id,
        timestamp,
        time,
        data: JSON.stringify({
            trade_id,
            price,
            size,
            side
        })
    });

    const event = Event.getInstance();
    event.emit(Event.CHANNEL_TRADE_ADD, attributes);
    await Trade.clearHistory(exchange_id, cacheSize);
};

Trade.clearHistory = async (exchange_id, size) => {
    const dt = Datetime.create();
    await Trade.destroy({ where: { exchange_id, timestamp: { [Op.lte]: dt.getTime() - size * 1000 } } });
};

Trade.getLastRecord = async (exchange_id) => {
    return await Trade.findOne({ where: { exchange_id }, order: [['timestamp', 'DESC' ]] });
}

exports = module.exports = Trade;