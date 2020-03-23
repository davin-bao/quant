const Sequelize = require('sequelize');
const Rasks = require('../models/Rasks');
const BotLog = require('../models/BotLog');
const Order = require('../models/Order');
const Trade = require('../models/Trade');
const TradeChannel = require('../channels/Trade');

const Op = Sequelize.Op;

class Strategy {
    constructor(options){
        this.options = {
            buy_timeout: 300,
            indexes: [],
            ...options
        };
    }

    async init() {
        this.exchange = await this.options.bot.getExchange();
        this.exchange.init(); 
        
        this.mp = this.exchange.getMarketplaceManager();

        this.rask = await Rasks.findOne({
            where: { exchange_id: this.exchange.id }
        });
        this.rask.setBot(this.options.bot);
        return this;
    }

    async tick(candle) {  
        //
        await this.checkTimeoutTrade();
    }

    stop() {
        //
    }

    getFee(amount) {
        return this.mp.getFee(amount);
    }

    async buy(price, quantity) {
        const { bot, simulate } = this.options;
        const exchange = await bot.getExchange();
        // 买入
        if (await this.rask.canBuy(price, quantity)){
            console.log('买入');
            this.options.bot.log(BotLog.TYPE_TRADE, '买入: ' + quantity + ' ' + price);
            await Trade.buy({
                bot_id: bot.id,
                exchange: exchange.exchange,
                market: exchange.market,
                buy_qty: quantity,
                buy_price: price,
                simulate
            });
        }
    }

    async sell(trade, price) {
        const { simulate } = this.options;
        // 卖出
        if (this.rask.canSell()) {
            console.log('卖出');
            this.options.bot.log(BotLog.TYPE_TRADE, '卖出: ' + trade.id + ' ' + trade.buy_qty + ' ' + price);
            await trade.sell({
                sell_price: price,
                simulate
            });
        }
    }

    async cancel(trade) {
        // 撤单
        if (await this.rask.canCancel()) {
            console.log('撤单');
            this.options.bot.log(BotLog.TYPE_TRADE, '撤单: ' + trade.id);
            await trade.cancel(this.options.simulate);
        }
    }

    async getCurrentTradePrice(){
        const lastTradeChannel = await TradeChannel.getLastRecord(this.options.exchange_id);
        if (!lastTradeChannel) return null;
        const { price } = JSON.parse(lastTradeChannel.data);
        return price;
    }

    async checkTimeoutTrade() {
        // 尽量每20s执行一次查询
        const now = new Date();
        if(now.getSeconds() % 20!= 0) return;

        const ordersTimeout = await Order.findAll({
            attributes: ['trade_id'],
            where: {
                state: Order.STATE_WAITING,
                side: Order.SIDE_BUY,
                created_at: {
                    [Op.lt]: new Date(new Date().getTime() - this.options.buy_timeout * 1000)
                }
            }
        });

        // const ordersTimeout = await Order.findAll({
        //     attributes: ['trade_id'],
        //     where: {
        //         [Op.or]: [
        //             {
        //                 state: Order.STATE_WAITING,
        //                 side: Order.SIDE_BUY,
        //                 created_at: {
        //                     [Op.lt]: new Date(new Date().getTime() - this.options.buy_timeout * 1000)
        //                 }
        //             },
                    // {
                    //     state: Order.STATE_WAITING,
                    //     side: Order.SIDE_SELL,
                    //     created_at: {
                    //         [Op.lt]: new Date(new Date().getTime() - this.options.sell_timeout * 1000)
                    //     }
                    // }
        //         ]
        //     }
        // });

        const tradeIdsTimeout = [];
        for (const orderTimeout of ordersTimeout){
            if (tradeIdsTimeout.indexOf(ordersTimeout.trade_id) < 0){
                tradeIdsTimeout.push(orderTimeout.trade_id);
            }
        }
        if(!tradeIdsTimeout || tradeIdsTimeout.length <= 0) return;

        const cancelTrades = await Trade.findAll({
            where: {
                bot_id: this.options.bot.id,
                id: {
                    [Op.in]: tradeIdsTimeout,
                },
                state: {
                    [Op.ne]: Trade.STATE_FILLED
                }
            }
        });

        for (const trade of cancelTrades) {
            await this.cancel(trade);
        }
    }
}

exports = module.exports = Strategy;