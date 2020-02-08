const Sequelize = require('sequelize');
const Decimal = require('decimal');
const sequelize = require('../definitions/sequelize');
const MarketplaceManager = require('../marketplace/Manager');
const Model = require('./Model');
const Setting = require('./Setting');
const AccountLog = require('./AccountLog');

class Account extends Model {
    // 冻结
    async lock(amount, options={}) {
        const self = this;
        await self.update({
            available: Decimal(self.available).sub(amount).toNumber(),
            locked: Decimal(self.locked).add(amount).toNumber(),
        }, options);

        await AccountLog.create({
            account_id: self.id,
            available_change: amount * -1,    // 可用额变化
            available: self.available,           // 可用额
            locked_change: amount,       // 冻结额变化
            locked: self.locked,              // 冻结额
            memo: '冻结,关联ID:' + (options.relate_id || 0)
        }, options);
    }
    // 解冻
    async unlock(amount, options={}) {
        const self = this;
        await self.update({
            available: Decimal(self.available).add(amount).toNumber(),
            locked: Decimal(self.locked).sub(amount).toNumber(),
        }, options);

        await AccountLog.create({
            account_id: self.id,
            available_change: amount,    // 可用额变化
            available: self.available,           // 可用额
            locked_change: amount * -1,       // 冻结额变化
            locked: self.locked,              // 冻结额
            memo: '解冻,关联ID:' + (options.relate_id || 0)
        }, options);
    }
    // 消费
    async consume(amount, options={}) {
        const self = this;
        await self.update({
            locked: Decimal(self.locked).sub(amount).toNumber(),
        }, options);

        await AccountLog.create({
            account_id: self.id,
            available_change: 0,    // 可用额变化
            available: self.available,           // 可用额
            locked_change: amount * -1,       // 冻结额变化
            locked: self.locked,              // 冻结额
            memo: '消费,关联ID:' + (options.relate_id || 0)
        }, options);
    }
    // 存入
    async deposit(amount, options={}) {
        const self = this;
        await self.update({
            available: Decimal(self.available).add(amount).toNumber(),
        }, options);

        await AccountLog.create({
            account_id: self.id,
            available_change: amount,    // 可用额变化
            available: self.available,           // 可用额
            locked_change: 0,       // 冻结额变化
            locked: self.locked,              // 冻结额
            memo: '存入,关联ID:' + (options.relate_id || 0)
        }, options);
    }
    //同步
    async syncSave(upstreamAccounts){
        const self = this;
        await sequelize.transaction(async t=> {
            let upstreamAvailable = 0, upstreamLocked = 0;
            upstreamAccounts.forEach(upstreamAccount => {
                if (upstreamAccount.currency.toLowerCase() === self.currency.toLowerCase()) {
                    upstreamAvailable = upstreamAccount.available;
                    upstreamLocked = upstreamAccount.locked;
                }
            });

            const available_change = Decimal(self.available).sub(upstreamAvailable).toNumber();
            const locked_change = Decimal(self.locked).sub(upstreamLocked).toNumber();

            const accountLog = new AccountLog({
                account_id: self.id,
                available_change: available_change,
                available: upstreamAvailable,
                locked_change: locked_change,
                locked: upstreamLocked,
                memo: '对账'
            });
            self.update({
                available: upstreamAvailable,
                locked: upstreamLocked
            }, {transaction: t});

            accountLog.save({transaction: t});
        });
    };
}

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
            marketplace: marketplace.toLowerCase(),
            currency: currency.toLowerCase()
        }
    });
    return account;
};

Account.sync = async function() {
    const setting  = await Setting.instance();
    const accounts = await Account.findAll();

    const marketplaces =[];
    accounts.forEach(account => {
        if(!marketplaces[account.marketplace]){
            marketplaces[account.marketplace] = [];
        }
        marketplaces[account.marketplace].push(account);
    });

    const marketplaceKeys = Object.keys(marketplaces);
    for(let i=0; i<marketplaceKeys.length; i++){
        const mp = MarketplaceManager.get(marketplaceKeys[i], setting.market);
        const upstreamAccounts = await mp.getAccountList();
        marketplaces[marketplaceKeys[i]].forEach(account => {
            account.syncSave(upstreamAccounts);
        });
    }
};

exports = module.exports = Account;