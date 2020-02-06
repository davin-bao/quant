const fs = require('fs');
const market = require('./Marketplace');
const Zb = require('./Zb');
const Okex = require('./Okex');
// const Hbg = require('./Hbg');

class MarketplaceManager {
    //构造函数
    static get(place, market) {
        switch (place) {
            case 'zb':
                return new Zb(market);
            case 'okex':
                return new Okex(market);
            // case 'hbg':
            //     return new Hbg(market);
            default:
                throw new Error('不支持的交易平台:' + place);
        }
    }

    static async getAllSame(marketplaceA, marketplaceB){
        const cachePath = './cache/markets_' + marketplaceA + '_' + marketplaceB + '.cache';
        if (fs.existsSync(cachePath)) {
            return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        }

        const mpA = Manager.get(marketplaceA, 'btc_usdt');
        const mpB = Manager.get(marketplaceB, 'btc_usdt');
        const marketsA = await mpA.getMarkets();
        const marketsB = await mpB.getMarkets();

        const markets = [];

        marketsA.forEach(itemA=>{
            marketsB.forEach(itemB=>{
                if(itemA.id === itemB.id){
                    markets.push(itemA);
                }
            })
        });
        fs.writeFileSync(cachePath, JSON.stringify(markets), { encoding: 'utf-8'});
        return markets;
    }
}

exports = module.exports = MarketplaceManager;
