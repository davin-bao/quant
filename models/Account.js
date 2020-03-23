const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class Account extends Model { }

Account.init({
    account_id: { type: Sequelize.STRING(100), comment: '上游账户ID' },
    exchange: { type: Sequelize.STRING(30), comment: '交易所' },
    currency: { type: Sequelize.STRING(30), comment: '货币' },
    available: { type: Sequelize.DECIMAL(20, 8), comment: '可用额', defaultValue: 0 },
    locked: { type: Sequelize.DECIMAL(20, 8), comment: '冻结', defaultValue: 0 },
    balance: { type: Sequelize.DECIMAL(20, 8), comment: '余额', defaultValue: 0 },
}, {
    sequelize,
    tableName: 'account',
    timestamps: false,
});

Account.getCurrenciesByExchange = async (exchange) => {
    const accounts = await Account.findAll({
        attributes: ['currency'],
        where: {
            exchange,
        }
    });
    const currencies = [];
    for(const account of accounts){
        currencies.push(account.currency);
    }

    return currencies;
}

Account.batchUpdate = async (spotAccounts) => {
    for(const item of spotAccounts){
        await Account.update({ 
            balance: item.balance,
            available: item.available,
            locked: item.hold
         }, {
            where: {
                currency: item.currency
            }
        });
    }
}

Account.initExample = () => {
    Account.create({
        exchange: 'okex',
        currency: 'usdt',
        available: 0, 
        locked: 0,
        balance: 0 
    });
};

exports = module.exports = Account;