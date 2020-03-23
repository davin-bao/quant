const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const Account = require('./Account');

class AccountStatistics extends Model {}

AccountStatistics.init({
    account_id: { type: Sequelize.STRING(100), comment: '账户ID' },
    exchange: { type: Sequelize.STRING(30), comment: '交易所' },
    currency: { type: Sequelize.STRING(30), comment: '货币' },
    balance: { type: Sequelize.DECIMAL(20, 8), comment: '余额', defaultValue: 0 },
    ctime: Sequelize.DATE,
}, {
    sequelize,
    tableName: 'account_statistics',
    timestamps: false,
});

AccountStatistics.synchronize = async function() {
    const accounts  = await Account.findAll();

    for(const account of accounts){
        AccountStatistics.create({
            account_id: account.id,
            exchange: account.exchange,
            currency: account.currency,
            balance: account.balance,
            ctime: new Date().getTime()
        });
    }
};

exports = module.exports = AccountStatistics;