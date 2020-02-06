const Decimal = require('decimal');
const sequelize = require('../definitions/sequelize');
const Hedge = require('../models/Hedge');
const Order = require('../models/Order');

class CreateOrder {
    constructor(options = {}){
        this.market = options.market;
        this.marketplaceBuy = options.marketplaceBuy;
        this.marketplaceSell = options.marketplaceSell;
        this.volume = options.volume;
        this.priceBuy = options.priceBuy;
        this.priceSell = options.priceSell;
        this.priceBuyFee = options.priceBuyFee;
        this.priceSellFee = options.priceSellFee;
    }

    async createHedge() {
        let hedge = false;
        let orderBuy = false;
        let orderSell = false;

        await sequelize.transaction(async t=>{
            hedge = new Hedge({
                state: Hedge.WAITING,
                market: this.market,
                marketplace_buy: this.marketplaceBuy,
                marketplace_sell: this.marketplaceSell,
                price_buy: this.priceBuy,
                price_sell: this.priceSell,
                volume: this.volume,
                profit: Decimal(this.priceSell).sub(this.priceBuy).sub(this.priceSellFee).sub(this.priceBuyFee).mul(this.volume).toNumber(),
                fee: Decimal(this.priceSellFee).add(this.priceBuyFee).toNumber(),
                stime: new Date().getTime()
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

        await orderBuy.trade();
        await orderSell.trade();
    }
}

exports = module.exports = CreateOrder;
