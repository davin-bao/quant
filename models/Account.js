const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const AccountLog = require('./AccountLog');

class Account extends Model {}

Account.init({
    marketplace: Sequelize.STRING,
    currency: Sequelize.STRING,
    available: Sequelize.DECIMAL,   // 可用余额
    locked: Sequelize.DECIMAL,      // 交易中的冻结额
    saving: Sequelize.DECIMAL,      // 预留
    freeze: Sequelize.DECIMAL,      // 预留
}, {
    sequelize,
    tableName: 'account',
    timestamps: false,
});
// Account.hasMany(AccountLog, {as: 'logs'});
AccountLog.belongsTo(Account,  {foreignKey: 'account_id', targetKey: 'id'});

Account.getByMarketplaceAndCurrency = function(marketplace, currency){
    const account = Account.findOne({
        where:{
            marketplace,
            currency
        }
    });
    return account;
};

exports = module.exports = Account;