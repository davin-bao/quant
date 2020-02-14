const fs = require('fs');
const market = require('./Marketplace');
const Zb = require('./Zb');
const Okex = require('./Okex');
const Hbg = require('./Hbg');
const Binance = require('./Binance');
const Gate = require('./Gate');
const Aofex = require('./Aofex');
const Biki = require('./Biki');
const Fatbtc = require('./Fatbtc');
const Poloniex = require('./Poloniex');

class Manager {
    //构造函数
    static get(place, market) {
        switch (place) {
            case 'zb':
                return new Zb(market);
            case 'okex':
                return new Okex(market);
            case 'hbg':
                return new Hbg(market);
            case 'binance':
                return new Binance(market);
            case 'gate':
                return new Gate(market);
            case 'aofex':
                return new Aofex(market);
            case 'biki':
                return new Biki(market);
            case 'fatbtc':
                return new Fatbtc(market);
            case 'poloniex':
                return new Poloniex(market);
            default:
                throw new Error('不支持的交易平台:' + place);
        }
    }

    static async getAllSame(marketplaceA, marketplaceB){
        const cachePath = './logs/markets_' + marketplaceA + '_' + marketplaceB + '.cache';
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

exports = module.exports = Manager;
