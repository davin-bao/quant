const sequelize = require('../definitions/sequelize');
const Hedge = require('../models/Hedge');
const Order = require('../models/Order');

class CreateOrder {
    constructor(market, marketplaceBuy, marketplaceSell, priceBuy, priceSell, volume){
        this.market = market;
        this.marketplaceBuy = marketplaceBuy;
        this.marketplaceSell = marketplaceSell;
        this.volume = volume;
        this.priceBuy = priceBuy;
        this.priceSell = priceSell;
    }

    async createHedge() {
        let hedge = false;
        let orderBuy = false;
        let orderSell = false;

        await sequelize.transaction(async t=>{
            hedge = new Hedge({
                state: 'wait',
                market: this.market,
                marketplace_buy: this.marketplaceBuy,
                marketplace_sell: this.marketplaceSell,
                price_buy: this.priceBuy,
                price_sell: this.priceSell,
                volume: this.volume,
                profit: (this.priceSell - this.priceBuy) * this.volume
            });
            hedge = await hedge.save({transaction: t});

            orderBuy = new Order({
                hedge_id: hedge.id,
                marketplace: this.marketplaceBuy,
                market: this.market,
                side: 'buy',
                volume: this.volume,
                price: this.priceBuy,
                state: Order.WAITING
            });

            orderSell = new Order({
                hedge_id: hedge.id,
                marketplace: this.marketplaceSell,
                market: this.market,
                side: 'sell',
                volume: this.volume,
                price: this.priceSell,
                state: Order.WAITING
            });

            await orderBuy.save({transaction: t});
            await orderSell.save({transaction: t});
        });
    }
}

exports = module.exports = CreateOrder;
