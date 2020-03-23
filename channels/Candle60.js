const Sequelize = require('sequelize'); 
const Datetime = require('node-datetime');
const Sqlite = require('../definitions/sqlite');
const sequelize = require('../definitions/sequelize');
const Channel = require('./Channel');
const Event = require('../models/Event');

const Op = Sequelize.Op;

class Candle60 extends Channel {}

Candle60.init({
    exchange_id: { type: Sequelize.INTEGER, comment: '交易所ID', defaultValue: 0 },
    time: { type: Sequelize.DATE, comment: '时间' },
    timestamp: { type: Sequelize.STRING(15), comment: '时间戳' },
    start: { type: Sequelize.DECIMAL(20, 8), comment: '开盘价', defaultValue: 0 },
    max: { type: Sequelize.DECIMAL(20, 8), comment: '最高价', defaultValue: 0 },
    min: { type: Sequelize.DECIMAL(20, 8), comment: '最低价', defaultValue: 0 },
    end: { type: Sequelize.DECIMAL(20, 8), comment: '收盘价', defaultValue: 0 },
    volume: { type: Sequelize.DECIMAL(20, 8), comment: '成交量', defaultValue: 0 },
}, {
    sequelize,
    tableName: 'channel_candle60s',
    timestamps: false,
});

Candle60.addRecord = async (attributes, size = 300) =>{
    const { time, timestamp, exchange_id, start, max, min, end, volumn } = attributes;
    
    const instance = await Candle60.findOne({ where: { timestamp } });
    if (!instance){
        await Candle60.create({
            exchange_id,
            timestamp,
            time,
            start,
            max,
            min,
            end,
            volumn
        });
    }else{
        await instance.update({
            exchange_id,
            time,
            start,
            max,
            min,
            end,
            volumn
        });
    }
    const event = Event.getInstance();
    event.emit(Event.CHANNEL_CANDLE_ADD, attributes);
    await Candle60.clearHistory(exchange_id, size);
};

Candle60.clearHistory = async (exchange_id, size) => {
    const dt = Datetime.create();
    await Candle60.destroy({ exchange_id, where: {timestamp: { [Op.lte]: dt.getTime() - size * 1000 } }});
}

exports = module.exports = Candle60;
