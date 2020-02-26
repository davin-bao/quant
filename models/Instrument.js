const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class Instrument extends Model {}

Instrument.init({
    label: { type: Sequelize.STRING, comment: '时间' },
    open: { type: Sequelize.DECIMAL(20,8), comment: '开盘价' },
    close: { type: Sequelize.DECIMAL(20,8), comment: '收盘价' },
    high: { type: Sequelize.DECIMAL(20,8), comment: '最高价' },
    low: { type: Sequelize.DECIMAL(20,8), comment: '最低价' },
    volume: { type: Sequelize.DECIMAL(20,8), comment: '交易量' },
    ask: { type: Sequelize.DECIMAL(20,8), comment: '买单深度' },
    bid: { type: Sequelize.DECIMAL(20,8), comment: '卖单深度' },
    high_diff: { type: Sequelize.DECIMAL(20,8), comment: '最高价 - 前一交易日的收盘价' },
    low_diff: { type: Sequelize.DECIMAL(20,8), comment: '最低价 - 前一交易日的收盘价' },
    close10: { type: Sequelize.DECIMAL(20,8), comment: '收盘价 - 过去10个交易周期中收盘的最低价 < 0，卖出信号' },
    close20: { type: Sequelize.DECIMAL(20,8), comment: '收盘价 - 过去20个交易周期中收盘的最高价 > 0，买入信号' },
    close_low10: { type: Sequelize.DECIMAL(20,8), comment: '收盘价 - 过去10个交易周期中的最低价 < 0，卖出信号' },
    close_high20: { type: Sequelize.DECIMAL(20,8), comment: '收盘价 - 过去20个交易周期中的最高价 > 0，买入信号' },
}, {
    sequelize,
    tableName: 'instrument',
    timestamps: true,
});

exports = module.exports = Instrument;