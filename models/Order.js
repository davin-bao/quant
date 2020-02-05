const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class Order extends Model {}

Order.init({
    hedge_id: Sequelize.INTEGER,
    marketplace: Sequelize.STRING,
    order_id: Sequelize.STRING,
    market: Sequelize.STRING,
    side: Sequelize.STRING,
    volume: Sequelize.DECIMAL,
    remaining_volume: Sequelize.DECIMAL,
    executed_volume: Sequelize.DECIMAL,
    price: Sequelize.DECIMAL,
    avg_price: Sequelize.DECIMAL,
    state: Sequelize.STRING,
    ttime: Sequelize.DATE,
    ctime: Sequelize.DATE,
    memo: Sequelize.STRING
}, {
    sequelize,
    tableName: 'order',
    timestamps: false,
});

Order.WAITING = 'waiting';      // 等待发起交易
Order.TRADING = 'trading';      // 交易中
Order.CANCEL = 'cancel';        // 交易取消
Order.FINISHED = 'finished';    // 交易完成

exports = module.exports = Order;