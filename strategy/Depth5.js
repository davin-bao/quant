const Sequelize = require('sequelize');
const dateTime = require('node-datetime');
const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');
const Strategy = require('./Strategy');
const Indicator = require('../definitions/Indicator');
const Trade = require('../models/Trade');
const Order = require('../models/Order');
const BotLog = require('../models/BotLog');
const Candle60Channel = require('../channels/Candle60');

const Op = Sequelize.Op;

class Depth5 extends Strategy {
    constructor(options) {
        options = {
            buy_times: 1.5,
            win_ratio: 1.1,
            loss_ratio: 0.95,
            buy_timeout: 120,
            sell_timeout: 120,
            ...options
        };
        super(options);

        this.Ma7 = new Indicator.MA(7);
        this.Ma30 = new Indicator.MA(30);

        this.ma7s = [];
        this.ma30s = [];
    }

    async tick(candle) { 
        super.tick(candle);

        this.ma7s.push(this.Ma7.next(candle));
        this.ma30s.push(this.Ma30.next(candle));

        if (this.ma7s.length < 2) return;

        const lastMa71 = this.ma7s[this.ma7s.length - 1];
        const lastMa72 = this.ma7s[this.ma7s.length - 2];

        const lastMa301 = this.ma30s[this.ma30s.length - 1];
        const lastMa302 = this.ma30s[this.ma30s.length - 2];
        const currentTradePrice = await this.getCurrentTradePrice();
        if (!currentTradePrice) return;

        if(lastMa71 > lastMa301 && lastMa72 <= lastMa302){
            // buy
            this.buy(currentTradePrice, 0.01);
        } else if (lastMa71 < lastMa301 && lastMa72 >= lastMa302){
            // sell
            const trades = await Trade.findAll({
                where: {
                    bot_id: this.options.bot.id,
                    state: Trade.STATE_BUY_FILLED
                }
            });
            for (const trade of trades) {
                this.sell(trade, currentTradePrice);
            }
        }

        const lossLine = (currentTradePrice - 2 * this.getFee(currentTradePrice)) / this.options.loss_ratio;
        const trades = await Trade.findAll({
            where: {
                bot_id: this.options.bot.id,
                state: Trade.STATE_BUY_FILLED,
                buy_price: { [Op.gte]: lossLine }
            }
        });

        for (const trade of trades) {
            this.sell(trade, currentTradePrice);
        }
        

        // const trades = await Trade.findAll({
        //     where: {
        //         bot_id: this.options.bot.id,
        //         state: Trade.STATE_BUY_FILLED
        //     }
        // });
        // const currentTradePrice = await this.getCurrentTradePrice();
        // if (!currentTradePrice) return;
        
        // if (lastBids > lastAsks * this.options.buy_times){
        //     this.buy(currentTradePrice, 0.01);
        // }
        
        // for(const trade of trades) {
        //     console.log('$$$',
        //         currentTradePrice > (trade.buy_price * this.options.win_ratio + 2 * this.getFee(trade.buy_price)),
        //         currentTradePrice < trade.buy_price * this.options.loss_ratio + 2 * this.getFee(trade.buy_price),
        //         currentTradePrice, trade.buy_price, this.getFee(trade.buy_price),
        //         (trade.buy_price * this.options.win_ratio + 2 * this.getFee(trade.buy_price)) + '<' + currentTradePrice + '<' +
        //         trade.buy_price * this.options.loss_ratio + 2 * this.getFee(trade.buy_price)
        //     );
        //     if (
        //         currentTradePrice > (trade.buy_price * this.options.win_ratio + 2 * this.getFee(trade.buy_price)) ||
        //         currentTradePrice < trade.buy_price * this.options.loss_ratio + 2 * this.getFee(trade.buy_price)
        //     ){
        //         this.sell(trade, currentTradePrice);
        //     }
        // }

        // const ordersTimeout = await Order.findAll({
        //     attributes: ['trade_id'],
        //     where: {
        //         state: Order.STATE_WAITING,
        //         side: Order.SIDE_BUY,
        //         created_at: {
        //             [Op.lt]: new Date(new Date().getTime() - this.options.buy_timeout * 1000)
        //         }
        //     }
        // });

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
        //             {
        //                 state: Order.STATE_WAITING,
        //                 side: Order.SIDE_SELL,
        //                 created_at: {
        //                     [Op.lt]: new Date(new Date().getTime() - this.options.sell_timeout * 1000)
        //                 }
        //             }
        //         ]
        //     }
        // });
        
        // const tradeIdsTimeout = [];
        // for (const orderTimeout of ordersTimeout){
        //     if (tradeIdsTimeout.indexOf(ordersTimeout.trade_id) < 0){
        //         tradeIdsTimeout.push(orderTimeout.trade_id);
        //     }
        // }
        // if(!tradeIdsTimeout || tradeIdsTimeout.length <= 0) return;

        // const cancelTrades = await Trade.findAll({
        //     where: {
        //         bot_id: this.options.bot.id,
        //         id: {
        //             [Op.in]: tradeIdsTimeout,
        //         },
        //         state: {
        //             [Op.ne]: Trade.STATE_FILLED
        //         }
        //     }
        // });
        // console.log('cancelTrades: ', cancelTrades.length);

        // for (const trade of cancelTrades) {
        //     await this.cancel(trade);
        // }
    }
}

Depth5.options = {};

exports = module.exports = Depth5;