const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class AccountLog extends Model {}

AccountLog.init({
    account_id: Sequelize.INTEGER,
    available_change: Sequelize.DECIMAL(20,8),    // 可用额变化
    available: Sequelize.DECIMAL(20,8),           // 可用额
    locked_change: Sequelize.DECIMAL(20,8),       // 冻结额变化
    locked: Sequelize.DECIMAL(20,8),              // 冻结额
    memo: Sequelize.STRING,                 // 备注
    ctime: Sequelize.TIME,                  // 操作时间
}, {
    sequelize,
    tableName: 'account_log',
    timestamps: false,
});

exports = module.exports = AccountLog;