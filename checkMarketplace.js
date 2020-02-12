const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const dateTime = require('node-datetime');
const Decimal = require('./definitions/decimal');
const { loop } = require('./definitions/utils');
const MarketplaceManager = require('./marketplace/Manager');
const Setting = require('./models/Setting');

dotenv.config('./env');

const check = async function() {
    const setting = await Setting.findOne();
    const markets = await MarketplaceManager.getAllSame(setting.marketplace_a, setting.marketplace_b);
    // const volume = setting.volume;
    // const safe_ratio = setting.safe_ratio;

    loop(markets, async market=>{
        const volume = Decimal(market.minAmount).mul(2).toNumber();
        if(market.id.toLowerCase().indexOf('_usdt') < 0) return;
        // A 所
        const mpA = MarketplaceManager.get(setting.marketplace_a, market.id);
        // B 所
        const mpB = MarketplaceManager.get(setting.marketplace_b, market.id);
        // 获取市场深度
        const depthA = await mpA.getDepth(setting.depth);
        const depthB = await mpB.getDepth(setting.depth);

        const aBuyPrice = parseFloat(depthA.getLastBids()[0]);
        const aSellPrice = parseFloat(depthA.getLastAsks()[0]);
        const aBuyVolume = parseFloat(depthA.getLastBids()[1]);
        const aSellVolume = parseFloat(depthA.getLastAsks()[1]);

        const bBuyPrice = parseFloat(depthB.getLastBids()[0]);
        const bSellPrice = parseFloat(depthB.getLastAsks()[0]);
        const bBuyVolume = parseFloat(depthB.getLastBids()[1]);
        const bSellVolume = parseFloat(depthB.getLastAsks()[1]);

        const aBuyFee = mpA.getFee(volume);
        const bBuyFee = mpB.getFee(volume);
        const aSellFee = mpA.getFee(volume);
        const bSellFee = mpB.getFee(volume);

        const profit_a = Decimal(volume).mul(Decimal(bBuyPrice).sub(aSellPrice).toNumber()).sub(Decimal(2).mul(Decimal(aBuyFee).add(bSellFee).toNumber()).toNumber()).toNumber();
        // Log(__filename, 'market:' + market.id + ' | ' + setting.marketplace_b + ' Sell:' + bBuyPrice + ' ' + setting.marketplace_a + ' Buy:' + aSellPrice + ' fee:' + Decimal(aBuyFee).add(bSellFee).toNumber() + ' | profit:' + profit_a);
        if (profit_a > 0) {
            // 发起交易, A挂买单，B挂卖单
            Log(__filename, 'market:' + market.id + ' 发起交易, A挂买单，' + aSellPrice + '，B挂卖单:' + bBuyPrice + ' profit:' + profit_a);
        }
        const profit_b = Decimal(volume).mul(Decimal(aBuyPrice).sub(bSellPrice).toNumber()).sub(Decimal(2).mul(Decimal(aBuyFee).add(bSellFee).toNumber()).toNumber()).toNumber();

        // Log(__filename, 'market:' + market.id + ' | ' + setting.marketplace_a + ' Sell:' + aBuyPrice + ' ' + setting.marketplace_b + ' Buy:' + bSellPrice + ' fee:' + Decimal(aBuyFee).add(bSellFee).toNumber() + ' | profit:' + profit_b);
        if (profit_b > 0) {
            // 发起交易, A挂卖单，B挂买单
            Log(__filename, 'market:' + market.id + ' 发起交易, A挂卖单:' + aBuyPrice + '，B挂买单:' + bSellPrice + ' profit:' + profit_b);
        }
        }, 1000);
};

const Log = function(filename, msg) {
        const dt = dateTime.create();
        const pwd = process.cwd();
        console.log(msg);
        fs.appendFileSync(pwd+'/logs/check-' + dt.format('y-m-d') + '.log', msg+"\n");
};

check().then(e=>{});
