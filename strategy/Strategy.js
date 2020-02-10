const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');
const MarketplaceManager = require('../marketplace/Manager');
const CreateOrder = require('./CreateOrder');
const Setting = require('../models/Setting');

class Strategy {
    constructor(setting){
        this.market = setting.market;
        this.marketplaceA = setting.marketplace_a;
        this.marketplaceB = setting.marketplace_b;
        this.depthSize = setting.depth;
        this.setting = setting;
    }

    async safety() {
        const { volume } = this.setting;

        // A 所
        const mpA = MarketplaceManager.get(this.marketplaceA, this.market);
        // B 所
        const mpB = MarketplaceManager.get(this.marketplaceB, this.market);
        // 获取市场深度
        const depthA = await mpA.getDepth(this.depthSize);
        const depthB = await mpB.getDepth(this.depthSize);

        this.aBuyPrice = parseFloat(depthA.getLastBids()[0]);
        this.aSellPrice = parseFloat(depthA.getLastAsks()[0]);
        this.aBuyVolume = parseFloat(depthA.getLastBids()[1]);
        this.aSellVolume = parseFloat(depthA.getLastAsks()[1]);

         this.bBuyPrice = parseFloat(depthB.getLastBids()[0]);
         this.bSellPrice = parseFloat(depthB.getLastAsks()[0]);
         this.bBuyVolume = parseFloat(depthB.getLastBids()[1]);
         this.bSellVolume = parseFloat(depthB.getLastAsks()[1]);

         this.aBuyFee = mpA.getFee(volume);
         this.bBuyFee = mpB.getFee(volume);
         this.aSellFee = mpA.getFee(volume);
         this.bSellFee = mpB.getFee(volume);

         this.judge();
    }

    async danger() {
        const { volume } = this.setting;

        // A 所
        const mpA = MarketplaceManager.get(this.marketplaceA, this.market);
        // B 所
        const mpB = MarketplaceManager.get(this.marketplaceB, this.market);
        // 获取市场深度
        const depthA = await mpA.getDepth(this.depthSize);
        const depthB = await mpB.getDepth(this.depthSize);

        this.aBuyPrice = parseFloat(depthA.getSecondBids()[0]);
        this.aSellPrice = parseFloat(depthA.getLastAsks()[0]);
        this.aBuyVolume = parseFloat(depthA.getSecondBids()[1]);
        this.aSellVolume = parseFloat(depthA.getLastAsks()[1]);

        this.bBuyPrice = parseFloat(depthB.getSecondBids()[0]);
        this.bSellPrice = parseFloat(depthB.getLastAsks()[0]);
        this.bBuyVolume = parseFloat(depthB.getSecondBids()[1]);
        this.bSellVolume = parseFloat(depthB.getLastAsks()[1]);

        this.aBuyFee = mpA.getFee(volume);
        this.bBuyFee = mpB.getFee(volume);
        this.aSellFee = mpA.getFee(volume);
        this.bSellFee = mpB.getFee(volume);

         this.judge();
    }
    
    async judge() {

        const {
            volume_limit, // 交易量阈值
            volume, // 交易量
            safe_ratio,    //安全系数
            side_a,
            side_b
        } = this.setting;

        //  A 卖价为 as，B 买价为 bb
        // 公式为：B所BTC余额＞交易阈值 && A所USDT余额/as＞交易阈值 &&（bb - as - at - bt）/ (（ab+bb）/2) ＞安全系数
        // A挂买单，B挂卖单
        // const aSlaveAccount = await mpA.getAccount(this.slaveCurrency);
        // const bMasterAccount = await mpB.getAccount(this.masterCurrency);
        // const aSlaveBalance = parseFloat(aSlaveAccount.balance);
        // const bMasterBalance = parseFloat(bMasterAccount.balance);

        // 判断当前的买卖量是否大于阈值
        // Log.Info(__filename, 'a1:' + this.aSellVolume+'>'+volume_limit+'&&'+this.bBuyVolume+'>'+volume_limit);
        if (this.aSellVolume > volume_limit && this.bBuyVolume > volume_limit) {
            // A所USDT余额/as＞交易阈值 && B所BTC余额＞交易阈值
            // Log.Info(__filename, 'a2:' + aSlaveBalance + '/' + this.aSellPrice + '>' + volume + '&&' + bMasterBalance + '>' + volume);
            // if (aSlaveBalance / this.aSellPrice > volume && bMasterBalance > volume) {
            //（bb - as - at - bt）/ (（as+bb）/2) ＞安全系数
            const profit = Decimal(volume).mul(Decimal(this.bBuyPrice).sub(this.aSellPrice).toNumber()).sub(Decimal(2).mul(Decimal(this.aBuyFee).add(this.bSellFee).toNumber()).toNumber()).toNumber();

            Log.Info(__filename, 'market:'+this.market+' | ' + this.marketplaceB + ' Sell:'+this.bBuyPrice+' ' + this.marketplaceA + ' Buy:'+this.aSellPrice+' fee:'+ Decimal(this.aBuyFee).add(this.bSellFee).toNumber() +' | profit:' + profit);
            if (profit > safe_ratio) {
                if(side_a === Setting.SIDE_BUY_FORBIDDEN || side_b === Setting.SIDE_SELL_FORBIDDEN){
                    Log.Info(__filename, '交易被限制: ' + this.marketplaceB + ':'+ side_b+' ' + this.marketplaceA + ':'+side_a);
                }else{
                    // 发起交易, A挂买单，B挂卖单
                    Log.Info(__filename, 'market:'+this.market, '发起交易, A挂买单，'+this.aSellPrice+'，B挂卖单:'+this.bBuyPrice, profit, safe_ratio);
                    const createOrder = new CreateOrder({
                        market: this.market,
                        marketplaceBuy: this.marketplaceA,
                        marketplaceSell: this.marketplaceB,
                        priceBuy: this.aSellPrice,
                        priceSell: this.bBuyPrice,
                        volume: volume,
                        priceBuyFee: this.aSellFee,
                        priceSellFee: this.bBuyFee
                    });
                    await createOrder.createHedge();
                }
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
        // Log.Info(__filename, 'b1:' + this.aBuyVolume+'>'+volume_limit+'&&'+this.bSellVolume+'>'+volume_limit);
        if (this.aBuyVolume > volume_limit && this.bSellVolume > volume_limit) {
            // A所BTC余额＞交易阈值 && B所USDT余额/bs＞交易阈值
            // Log.Info(__filename, 'b2:' + aMasterBalance + '>' + volume + '&&' + bSlaveBalance + '/' + this.bSellPrice + '>' + volume);
            // if (aMasterBalance > volume && bSlaveBalance / this.bSellPrice > volume) {
            //（ab - bs - at - bt）/ (（ab+bs）/2) ＞安全系数
            const profit = Decimal(volume).mul(Decimal(this.aBuyPrice).sub(this.bSellPrice).toNumber()).sub(Decimal(2).mul(Decimal(this.aBuyFee).add(this.bSellFee).toNumber()).toNumber()).toNumber();

            Log.Info(__filename, 'market:'+this.market+' | ' + this.marketplaceA + ' Sell:'+this.aBuyPrice+' ' + this.marketplaceB + ' Buy:'+this.bSellPrice+' fee:'+ Decimal(this.aBuyFee).add(this.bSellFee).toNumber() +' | profit:' + profit);
            if (profit > safe_ratio) {
                if(side_a === Setting.SIDE_SELL_FORBIDDEN || side_b === Setting.SIDE_BUY_FORBIDDEN){
                    Log.Info(__filename, '交易被限制: ' + this.marketplaceB + ':'+ side_b+' ' + this.marketplaceA + ':'+side_a);
                } else {
                    // 发起交易, A挂卖单，B挂买单
                    Log.Info(__filename, 'market:'+this.market, '发起交易, A挂卖单:'+this.aBuyPrice+'，B挂买单:'+this.bSellPrice, profit, safe_ratio);
                    const createOrder = new CreateOrder({
                        market: this.market,
                        marketplaceBuy: this.marketplaceB,
                        marketplaceSell: this.marketplaceA,
                        priceBuy: this.bSellPrice,
                        priceSell: this.aBuyPrice,
                        volume: volume,
                        priceBuyFee: this.bSellFee,
                        priceSellFee: this.aBuyFee
                    });
                    await createOrder.createHedge();
                }
            }
            // }
        }
    }

}

exports = module.exports = Strategy;