const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class Setting extends Model {}

Setting.init({
    market: Sequelize.STRING,
    marketplace_a: Sequelize.STRING,
    marketplace_b: Sequelize.STRING,
    depth: Sequelize.INTEGER,
    volume_limit: Sequelize.DECIMAL,    // 挂牌量大于该值，才进行交易判断
    volume: Sequelize.DECIMAL,          // 每次交易请求量
    safe_ratio: Sequelize.DECIMAL,      // 安全系数
    trade_timeout: Sequelize.INTEGER,   // 交易超时阈值(s)
    enabled: Sequelize.BOOLEAN,
}, {
    sequelize,
    tableName: 'setting',
    timestamps: false,
});

Setting.instance = function(){
    return Setting.findOne({
        where: {
            enabled: true
        }
    });
};

exports = module.exports = Setting;