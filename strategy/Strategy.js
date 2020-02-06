const Log = require('../definitions/Log');
const MarketplaceManager = require('../marketplace/Manager');
const CreateOrder = require('./CreateOrder');

class Strategy {
    constructor(data){
        const [masterCurrency, slaveCurrency] = data.market.split('_');
        this.market = data.market;
        this.masterCurrency = masterCurrency;
        this.slaveCurrency = slaveCurrency;
        this.marketplaceA = data.marketplace_a;
        this.marketplaceB = data.marketplace_b;
        this.depthSize = data.depth;
        this.params = data;
    }

    async safety() {
        // 参数
        const {
            volume_limit, // 交易量阈值
            volume, // 交易量
            safe_ratio,    //安全系数
        } = this.params;

        // A 所
        const mpA = MarketplaceManager.get(this.marketplaceA, this.market);
        // B 所
        const mpB = MarketplaceManager.get(this.marketplaceB, this.market);
        // 获取市场深度
        const depthA = await mpA.getDepth(this.depthSize);
        const depthB = await mpB.getDepth(this.depthSize);

        const aBuyPrice = parseFloat(depthA.getLastBids()[0]);
        const aSellPrice = parseFloat(depthA.getLastAsks()[0]);
        const aBuyVolume = parseFloat(depthA.getLastBids()[1]);
        const aSellVolume = parseFloat(depthA.getLastAsks()[1]);

        const bBuyPrice = parseFloat(depthB.getLastBids()[0]);
        const bSellPrice = parseFloat(depthB.getLastAsks()[0]);
        const bBuyVolume = parseFloat(depthB.getLastBids()[1]);
        const bSellVolume = parseFloat(depthB.getLastAsks()[1]);

        const aBuyFee = mpA.getFee(aBuyPrice * volume);
        const bBuyFee = mpB.getFee(bBuyPrice * volume);
        const aSellFee = mpA.getFee(aSellPrice * volume);
        const bSellFee = mpB.getFee(bSellPrice * volume);

        //  A 卖价为 as，B 买价为 bb
        // 公式为：B所BTC余额＞交易阈值 && A所USDT余额/as＞交易阈值 &&（bb - as - at - bt）/ (（ab+bb）/2) ＞安全系数
        // A挂买单，B挂卖单
        // const aSlaveAccount = await mpA.getAccount(this.slaveCurrency);
        // const bMasterAccount = await mpB.getAccount(this.masterCurrency);
        // const aSlaveBalance = parseFloat(aSlaveAccount.balance);
        // const bMasterBalance = parseFloat(bMasterAccount.balance);

        // 判断当前的买卖量是否大于阈值
        // Log.Info(__filename, 'a1:' + aSellVolume+'>'+volume_limit+'&&'+bBuyVolume+'>'+volume_limit);
        if (aSellVolume > volume_limit && bBuyVolume > volume_limit) {
            // A所USDT余额/as＞交易阈值 && B所BTC余额＞交易阈值
            // Log.Info(__filename, 'a2:' + aSlaveBalance + '/' + aSellPrice + '>' + volume + '&&' + bMasterBalance + '>' + volume);
            // if (aSlaveBalance / aSellPrice > volume && bMasterBalance > volume) {
                //（bb - as - at - bt）/ (（as+bb）/2) ＞安全系数
                Log.Info(__filename, 'market:'+this.market+' | ' + this.marketplaceB + ' Buy:'+bBuyPrice+' ' + this.marketplaceA + ' Sell:'+aSellPrice+' | profit:' + ((bBuyPrice - aSellPrice - aSellFee - bBuyFee) / ((aSellPrice + bBuyPrice) / 2)));
                if ((bBuyPrice - aSellPrice - aSellFee - bBuyFee) / ((aSellPrice + bBuyPrice) / 2) > safe_ratio) {
                    // 发起交易, A挂买单，B挂卖单
                    // Log.Info(__filename, 'market:'+this.market, '发起交易, A挂买单，'+aSellPrice+'，B挂卖单:'+bBuyPrice, (bBuyPrice - aSellPrice - aSellFee - bBuyFee));
                    const createOrder = new CreateOrder({
                        market: this.market,
                        marketplaceBuy: this.marketplaceA,
                        marketplaceSell: this.marketplaceB,
                        priceBuy: aSellPrice,
                        priceSell: bBuyPrice,
                        volume: volume,
                        priceBuyFee: aSellFee,
                        priceSellFee: bBuyFee
                    });
                    await createOrder.createHedge();
                }
            // }
        }

        // A 买价为 ab，B 卖价为 bs
        // 公式为：A所BTC余额＞交易阈值 && B所USDT余额/bs＞交易阈值 &&（ab - bs - at - bt）/ (（ab+bs）/2) ＞安全系数
        // 则A挂卖单，B挂买单;
        // const aMasterAccount = await mpA.getAccount(this.masterCurrency);
        // const bSlaveAccount = await mpB.getAccount(this.slaveCurrency);
        // const aMasterBalance = parseFloat(aMasterAccount.balance);
        // const bSlaveBalance = parseFloat(bSlaveAccount.balance);

        // 判断当前的买卖量是否大于阈值
        // Log.Info(__filename, 'b1:' + aBuyVolume+'>'+volume_limit+'&&'+bSellVolume+'>'+volume_limit);
        if (aBuyVolume > volume_limit && bSellVolume > volume_limit) {
            // A所BTC余额＞交易阈值 && B所USDT余额/bs＞交易阈值
            // Log.Info(__filename, 'b2:' + aMasterBalance + '>' + volume + '&&' + bSlaveBalance + '/' + bSellPrice + '>' + volume);
            // if (aMasterBalance > volume && bSlaveBalance / bSellPrice > volume) {
                //（ab - bs - at - bt）/ (（ab+bs）/2) ＞安全系数
                Log.Info(__filename, 'market:'+this.market+' | ' + this.marketplaceA + ' Buy:'+aBuyPrice+' ' + this.marketplaceB + ' Sell:'+bSellPrice+' | profit:' + ((aBuyPrice - bSellPrice - aBuyFee - bSellFee) / ((aBuyPrice + bSellPrice) / 2)));
                if ((aBuyPrice - bSellPrice - aBuyFee - bSellFee) / ((aBuyPrice + bSellPrice) / 2) > safe_ratio) {
                    // 发起交易, A挂卖单，B挂买单
                    // Log.Info(__filename, 'market:'+this.market, '发起交易, A挂卖单:'+aBuyPrice+'，B挂买单:'+bSellPrice, (aBuyPrice - bSellPrice - aBuyFee - bSellFee));
                    const createOrder = new CreateOrder({
                        market: this.market,
                        marketplaceBuy: this.marketplaceB,
                        marketplaceSell: this.marketplaceA,
                        priceBuy: bSellPrice,
                        priceSell: aBuyPrice,
                        volume: volume,
                        priceBuyFee: bSellFee,
                        priceSellFee: aBuyFee
                    });
                    await createOrder.createHedge();
                }
            // }
        }
    }

}

exports = module.exports = Strategy;