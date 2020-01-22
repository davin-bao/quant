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
    result: Sequelize.STRING,
    stime: Sequelize.DATE,
    ftime: Sequelize.DATE,
}, {
    sequelize,
    tableName: 'hedge',
    timestamps: false,
});

exports = module.exports = Hedge;