const Sequelize = require('sequelize');
const Decimal = require('../definitions/decimal');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const MarketplaceManager = require('../marketplace/Manager');
const Error = require('../marketplace/response/Error');
const Order = require('./Order');
const Profits = require('./Profits');
const Event = require('./Event');
const BotLog = require('./BotLog');

const Op = Sequelize.Op;

class Trade extends Model {
    async sell(attributes) {
        const {
            sell_price,
            simulate
        } = attributes;

        if (this.state != Trade.STATE_BUY_FILLED) return;

        let order = null;
        const buyOrder = await Order.findOne({
            where: {
                trade_id: this.id,
                side: Order.SIDE_BUY,
                state: {
                    [Op.in]: [Order.STATE_PARTIAL, Order.STATE_FILLED]
                }
            }
        });
        if (!buyOrder) return;

        await sequelize.transaction(async t => {
            order = await Order.create({
                bot_id: this.bot_id,
                trade_id: this.id,
                market: buyOrder.market,
                price: sell_price,              // 委托价格
                quantity: buyOrder.quantity,
                side: Order.SIDE_SELL,
                margin_trading: buyOrder.margin_trading,
                order_type: buyOrder.order_type,
                type: buyOrder.type,
                created_at: new Date().getTime()
            }, { transaction: t });

            await this.update({
                sell_price: sell_price,
                state: Trade.STATE_SELL_WAITING
            }, { transaction: t });
        });

        if (!simulate) await this.requestTrade(order);
    }

    async requestTrade(order) {
        // 发起交易请求
        const mp = MarketplaceManager.get(this.exchange, this.market);

        let orderResult = await mp.orders(order.side, order.price, parseFloat(order.quantity), order.id, '');
        if (orderResult instanceof Error) {
            if (orderResult.code === Error.ACCOUNT_NOT_ENOUGH) {
                // 账户余额不足，关闭交易
            }

            await sequelize.transaction(async t => {
                await this.update({
                    state: Trade.STATE_FAILED,
                    memo: orderResult.message
                }, { transaction: t });

                await order.update({
                    state: Order.STATE_FAILED
                }, { transaction: t });
            });
        }

        await order.update({
            order_id: orderResult.order_id
        });
    }

    async cancel(simulate) {
        let side = null;
        if (this.state === Trade.STATE_BUY_WAITING) {
            side = Order.SIDE_BUY;
        } else if (this.state === Trade.STATE_SELL_WAITING) {
            side = Order.SIDE_SELL;
        }

        if (side === null) return;

        const order = await Order.findOne({
            where: {
                trade_id: this.id,
                side,
                state: {
                    [Op.in]: [Order.STATE_WAITING]
                }
            }
        });
        if (!order) return;
        if (!simulate) {
            await requestCancel(order);
        } else {
            await sequelize.transaction(async t => {
                await this.update({
                    state: Trade.STATE_CANCEL_SUCCESS,
                    memo: '主动撤销交易'
                }, { transaction: t });

                await order.update({
                    state: Order.STATE_CANCEL_SUCCESS
                }, { transaction: t });
            });
        }
    }

    async requestCancel(order) {

        // 发起交易请求
        const mp = MarketplaceManager.get(this.exchange, this.market);

        let orderResult = await mp.ordersCancel(order.order_id);
        if (orderResult instanceof Error) {
            await this.update({
                memo: orderResult.message
            });
            return;
        }

        await sequelize.transaction(async t => {
            await this.update({
                state: Trade.STATE_CANCELLING,
                memo: '主动撤销交易'
            }, { transaction: t });

            await order.update({
                state: Order.STATE_CANCELLING
            }, { transaction: t });
        });
    }
}

Trade.init({
    bot_id: { type: Sequelize.INTEGER, comment: 'BOT ID', defaultValue: 0 },
    exchange: { type: Sequelize.STRING(30), comment: '交易所' },
    market: { type: Sequelize.STRING(30), comment: '货币对' },
    buy_price: { type: Sequelize.DECIMAL(20, 8), comment: '买入价格', defaultValue: 0 },
    buy_qty: { type: Sequelize.DECIMAL(20, 8), comment: '买入数量', defaultValue: 0 },
    sell_price: { type: Sequelize.DECIMAL(20, 8), comment: '卖出价格', defaultValue: 0 },
    sell_qty: { type: Sequelize.DECIMAL(20, 8), comment: '卖出数量', defaultValue: 0 },
    bought_at: { type: Sequelize.DATE, comment: '买入时间' },
    sold_at: { type: Sequelize.DATE, comment: '卖出时间' },
    profit: { type: Sequelize.DECIMAL(20, 8), comment: '利润', defaultValue: 0 },
    state: { type: Sequelize.STRING(20), comment: '状态', defaultValue: 'buy_waiting' },
    memo: { type: Sequelize.STRING(100), comment: '备注' }
}, {
    hooks: {
        afterCreate: async (trade, options) => {
            const event = Event.getInstance();
            const trades = await Trade.findAll({
                where: { state: { [Op.in]: [Trade.STATE_BUY_WAITING, Trade.STATE_BUY_FILLED, Trade.STATE_SELL_WAITING, Trade.STATE_SELL_FILLED]}},
                order: [['id', 'ASC']],
            });
            event.emit(Event.TRADE_ACTIVE, { id: trade.bot_id, trades });
        },
        afterUpdate: async (trade, options) => {
            const event = Event.getInstance();
            const trades = await Trade.findAll({
                where: { state: { [Op.in]: [Trade.STATE_BUY_WAITING, Trade.STATE_BUY_FILLED, Trade.STATE_SELL_WAITING, Trade.STATE_SELL_FILLED] } },
                order: [['id', 'ASC']],
            });
            event.emit(Event.TRADE_ACTIVE, { id: trade.bot_id, trades });
        }
    },
    sequelize,
    tableName: 'trades',
    timestamps: false,
});

Trade.STATE_BUY_WAITING = 'buy_waiting';      // 等待买入
Trade.STATE_BUY_FILLED = 'buy_filled';        // 买入完成
Trade.STATE_SELL_WAITING = 'sell_waiting';      // 等待卖出
Trade.STATE_SELL_FILLED = 'sell_filled';        // 卖出完成
Trade.STATE_CANCELLING = 'cancelling';         // 交易取消
Trade.STATE_CANCEL_SUCCESS = 'cancel_success'; // 交易取消成功
Trade.STATE_FAILED = 'failed';        // 交易失败
Trade.STATE_FILLED = 'filled';        // 交易成功

Trade.buy = async (attributes) => {
    const {
        bot_id,
        exchange,
        market,
        buy_qty,
        buy_price,
        simulate
    } = attributes;

    let trade = null, order = null;
    await sequelize.transaction(async t => {
        trade = await Trade.create({
            bot_id,
            exchange,
            market,
            buy_qty,
            buy_price
        }, { transaction: t });

        order = await Order.create({
            bot_id,
            trade_id: trade.id,
            market: trade.market,
            price: trade.buy_price,
            quantity: trade.buy_qty,
            side: Order.SIDE_BUY,
            created_at: new Date().getTime()
        }, { transaction: t });
    });

    if (order != null && !simulate) {
        // 发起交易请求
        await trade.requestTrade(order);
    }

    return trade;
}

Trade.batchUpdate = async (spotOrders) => {
    for (const item of spotOrders) {
        const order = await Order.findOne({
            where: { id: item.id }
        });
        if (!order) return;
        const trade = await Trade.findOne({
            where: { id: order.trade_id }
        });

        const buyOrder = await Order.findOne({
            where: {
                trade_id: order.trade_id,
                side: Order.SIDE_BUY
            }
        });

        switch (order.state) {
            case Order.STATE_WAITING:
            default:
                break;
            case Order.STATE_PARTIAL:
            case Order.STATE_FILLED:
                if (order.side === Order.SIDE_BUY) {
                    await trade.update({
                        state: Trade.STATE_BUY_FILLED,
                        buy_price: Decimal(order.filled_notional).div(order.filled_quantity).toNumber(),
                        buy_qty: order.filled_quantity,
                        bought_at: new Date().getTime()
                    });
                } else {
                    const profit = Decimal(order.filled_notional).sub(Decimal(trade.buy_price).mul(trade.buy_qty).toNumber()).sub(order.filled_fee).sub(buyOrder.filled_fee).toNumber();
                    const ctime = new Date();

                    await sequelize.transaction(async t => {
                        await trade.update({
                            state: Trade.STATE_FILLED,
                            sell_price: Decimal(order.filled_notional).div(order.filled_quantity).toNumber(),
                            sell_qty: order.filled_quantity,
                            profit,
                            sold_at: ctime
                        }, { transaction: t });

                        await BotLog.create({
                            bot_id: trade.bot_id,
                            type: BotLog.TYPE_TRADE,
                            memo: '收益: ' + profit,
                            ctime
                        }, { transaction: t });

                        await Profits.add({
                            bot_id: trade.bot_id,
                            currency: trade.market.split('_')[1],
                            profit,
                            ctime
                        }, { transaction: t });
                    });
                }
                break;
            case Order.STATE_CANCELLING:
                await trade.update({
                    state: Trade.STATE_CANCELLING
                });
                break;
            case Order.STATE_CANCEL_SUCCESS:
                await trade.update({
                    state: Trade.STATE_CANCEL_SUCCESS,
                    memo: 'Cancel ' + order.side + ' trade'
                });
                break;
            case Order.STATE_FAILED:
                await trade.update({
                    state: Trade.STATE_FAILED,
                    memo: 'Exchange return ' + item.state
                });
                break;
        }
    }
}

exports = module.exports = Trade;