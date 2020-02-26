const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class Setting extends Model {}

Setting.init({
    market: { type: Sequelize.STRING, comment: '市场' },
    marketplace: { type: Sequelize.STRING, comment: '交易所' },
    granularity: { type: Sequelize.INTEGER, comment: '交易频率(s)' },
    depth: { type: Sequelize.INTEGER, comment: '深度', defaultValue: 5 },
    volume_limit: { type: Sequelize.DECIMAL(20,8), comment: '挂牌量大于该值，才进行交易判断', defaultValue: 0.1 },
    volume: { type: Sequelize.DECIMAL(20,8), comment: '每次交易请求量', defaultValue: 0.01 },
    trade_timeout: { type: Sequelize.INTEGER, comment: '交易超时阈值(s)', defaultValue: 240 },
    check_cron: { type: Sequelize.STRING, comment: '交易检测定时', defaultValue: '*/10 * * * * *' },
    enabled: { type: Sequelize.BOOLEAN, comment: '启用', defaultValue: true },
    side: { type: Sequelize.STRING, comment: '交易方向限制', defaultValue: 'un_forbidden' }
}, {
    sequelize,
    tableName: 'setting',
    timestamps: false,
});

Setting.SIDE_BUY_FORBIDDEN = 'buy_forbidden';
Setting.SIDE_SELL_FORBIDDEN = 'sell_forbidden';
Setting.SIDE_UN_FORBIDDEN = 'un_forbidden';

exports = module.exports = Setting;