const Sequelize = require('sequelize');
const Decimal = require('decimal');
const sequelize = require('../definitions/sequelize');
const MarketplaceManager = require('../marketplace/Manager');
const Model = require('./Model');
const Setting = require('./Setting');

class AccountStatistics extends Model {

}

AccountStatistics.init({
    market: Sequelize.STRING,
    marketplace_a: Sequelize.STRING,
    marketplace_b: Sequelize.STRING,
    amount: Sequelize.DECIMAL,   // 估值
    currency_a_a: Sequelize.DECIMAL,
    currency_a_b: Sequelize.DECIMAL,
    currency_b_a: Sequelize.DECIMAL,
    currency_b_b: Sequelize.DECIMAL,
    ctime: Sequelize.DATE,
}, {
    sequelize,
    tableName: 'account_statistics',
    timestamps: false,
});

AccountStatistics.sync = async function() {
    const settings  = await Setting.findAll();
    for(const setting of settings){
        const marketplaces =[setting.marketplace_a, setting.marketplace_b];
        const currencies = setting.market.split('_').trim();
        let totalAmount = 0;
        const currencyAmount = [];
        for(const marketplace of marketplaces) {
            const amounts = [];

            const mp = MarketplaceManager.get(marketplace, setting.market);
            const upstreamAccounts = await mp.getAccountList();
            upstreamAccounts.forEach(upstreamAccount => {
                if (upstreamAccount.currency.toLowerCase() === currencies[0].toLowerCase()) {
                    amounts[0] = Decimal(upstreamAccount.available).add(upstreamAccount.locked).toNumber();
                    currencyAmount.push(amounts[0]);
                }
                if (upstreamAccount.currency.toLowerCase() === currencies[1].toLowerCase()) {
                    amounts[1] = Decimal(upstreamAccount.available).add(upstreamAccount.locked).toNumber();
                    currencyAmount.push(amounts[1]);
                }
            });
            const depth = await mp.getDepth(1);
            const sellPrice = parseFloat(depth.getLastAsks()[0]);

            totalAmount = Decimal(totalAmount).add(Decimal(amounts[0]).mul(sellPrice).add(amounts[1]).toNumber()).toNumber().toFixed(6);
        }
        AccountStatistics.create({
            market: setting.market,
            marketplace_a: setting.marketplace_a,
            marketplace_b: setting.marketplace_b,
            amount: totalAmount,
            currency_a_a: currencyAmount[0],
            currency_a_b: currencyAmount[1],
            currency_b_a: currencyAmount[2],
            currency_b_b: currencyAmount[3],
            ctime: new Date().getTime()
        });
    }
};

exports = module.exports = AccountStatistics;