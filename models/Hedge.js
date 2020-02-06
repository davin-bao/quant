const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class Hedge extends Model {}

Hedge.init({
    state: Sequelize.STRING,
    market: Sequelize.STRING,
    marketplace_buy: Sequelize.STRING,
    marketplace_sell: Sequelize.STRING,
    price_buy: Sequelize.DECIMAL,
    price_sell: Sequelize.DECIMAL,
    volume: Sequelize.DECIMAL,
    profit: Sequelize.DECIMAL,
    fee: Sequelize.DECIMAL,
    stime: Sequelize.DATE,
    ftime: Sequelize.DATE,
}, {
    sequelize,
    tableName: 'hedge',
    timestamps: false,
});

Hedge.WAITING = 'waiting';      // 等待发起交易
Hedge.FAILED = 'failed';        // 交易失败
Hedge.SUCCESS = 'success';    // 交易完成

exports = module.exports = Hedge;