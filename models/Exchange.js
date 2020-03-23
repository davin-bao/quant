const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Decimal = require('../definitions/decimal');
const MarketplaceManager = require('../marketplace/Manager');
const ClientManager = require('../client/Manager');
const Client = require('../client/Client');

const Model = require('./Model');
const Event = require('./Event');
const Account = require('./Account');
const Order = require('./Order');
const TradeModel = require('./Trade');

const Depth5Channel = require('../channels/Depth5');
const TradeChannel = require('../channels/Trade');
const Candle60Channel = require('../channels/Candle60');

const Op = Sequelize.Op;

class Exchange extends Model {
    init() {
        this.options = {
            tradeSize: 19600,
            depthSize: 19600,
            candleSize: 19600,
            channels: [],
            simulate: this.simulate,
            ...JSON.parse(this.parameters)
        };
        this.event = Event.getInstance();;

        return this;
    }

    getMarketplaceManager() {
        return MarketplaceManager.get(this.exchange, this.market);
    }

    getClient(options={}) {
        return ClientManager.get(this.exchange, this.market, options);
    }

    async stop() {
        await this.update({ state: Exchange.STOPED });
        this.event.emit(Event.EXCHANGE_CHANGE, { id: this.id, state: Exchange.STOPED });
        this.client && this.client.close();
    }

    async start() {
        await this.update({ state: Exchange.RUNNING });
        this.event.emit(Event.EXCHANGE_CHANGE, { id: this.id, state: Exchange.RUNNING });
        const { tradeSize, depthSize, candleSize, channels, simulate } = this.options;
        const currencies = await Account.getCurrenciesByExchange(this.exchange);
        this.client = this.getClient(this.options);

        this.client.connect();
        this.client.on('open', () => {
            for (const channel of channels) {
                this.client.subscribeAuotations(channel);
            }
            if (simulate) {
                // 模拟交易时，使用该订阅通知订单状态
                this.client.subscribeAuotations('spot/trade');
            }
            this.client.login();
        });

        this.client.on('login', () => {
            for (const currency of currencies) {
                this.client.subscribeSpotAccount(currency);
            }

            this.client.subscribeSpotOrder();
        });

        this.client.on('spot_account', async (spotAccounts) => {
            await Account.batchUpdate(spotAccounts);
        });

        this.client.on('spot_order', async (spotOrders) => {
            await Order.batchUpdate(spotOrders);
            await TradeModel.batchUpdate(spotOrders);
        });

        this.client.on('spot_trade', async (trades) => {
            for (const trade of trades) {
                await TradeChannel.addRecord({
                    exchange_id: this.id,
                    ...trade
                }, tradeSize);
            }

            if (this.simulate) {
                await this.simulateTradeEvent(trades);
            }
        });

        this.client.on('depth5', async (depth) => {
            await Depth5Channel.addRecord({
                exchange_id: this.id,
                ...depth
            }, depthSize);
        });

        this.client.on('candle60s', async (candles) => {
            for (const candle of candles) {
                await Candle60Channel.addRecord({
                    exchange_id: this.id,
                    ...candle
                }, candleSize);
            }
        });
    }

    async simulateTradeEvent(trades) {
        const spotOrders = [], spotAccounts = [];
        const currencies = this.market.split('_');

        const accountItem = await Account.findOne({
            where: {
                exchange: this.exchange,
                currency: currencies[0]
            }
        });
        const accountMoney = await Account.findOne({
            where: {
                exchange: this.exchange,
                currency: currencies[1]
            }
        });

        let itemAvailable = accountItem.available;
        let moneyAvailable = accountMoney.available;

        for (const trade of trades) {
            const res = await Order.findAll({
                where: {
                    price: {
                        [Op.between]: [trade.price - 0.001, trade.price + 0.001]
                    },
                    side: trade.side,
                    state: Order.STATE_WAITING
                },
                order: [
                    ['id', 'ASC']
                ]
            });
            if (!res) return;
            for (const item of res) {
                spotOrders.push({
                    id: item.id,
                    market: item.market,  // 币对名称
                    order_id: item.order_id,        // 订单ID
                    price: item.price,              // 委托价格
                    quantity: item.quantity,                // 委托数量（交易货币数量）
                    notional: item.notional,        // 买入金额，市价买入时返回
                    side: item.side,                // buy 或 sell
                    filled_notional: Decimal(item.price).mul(item.quantity).toNumber(),  // 已成交金额
                    filled_quantity: item.quantity,  // 已成交数量
                    last_fill_px: item.price,        // 最新成交价格（如果没有，推0）
                    last_fill_qty: item.quantity,      // 最新成交数量（如果没有，推0）
                    last_fill_time: new Date().getTime(),    // 最新成交时间（如果没有，推1970-01-01T00:00:00.000Z）
                    margin_trading: item.margin_trading,
                    order_type: item.order_type,
                    state: Client.ORDER_STATE_FILLED,
                    timestamp: new Date().getTime(),      // 订单状态更新时间
                    type: item.type,                // limit或market（默认是limit）
                    created_at: new Date().getTime(),    // 订单创建时间
                    filled_fee: this.client.getFee(Decimal(item.price).mul(item.quantity).toNumber())
                });

                if (item.side === Order.SIDE_BUY) {
                    itemAvailable = Decimal(itemAvailable).add(item.quantity).toNumber();
                    moneyAvailable = Decimal(moneyAvailable).sub(Decimal(item.price).mul(item.quantity).toNumber()).toNumber();
                } else {
                    itemAvailable = Decimal(itemAvailable).sub(item.quantity).toNumber();
                    moneyAvailable = Decimal(moneyAvailable).add(Decimal(item.price).mul(item.quantity).toNumber()).toNumber();
                }
                spotAccounts.push({
                    account_id: item.id,
                    currency: currencies[0],
                    balance: itemAvailable,
                    available: itemAvailable,
                    locked: item.hold
                });
                spotAccounts.push({
                    account_id: item.id,
                    currency: currencies[1],
                    balance: moneyAvailable,
                    available: moneyAvailable,
                    locked: item.hold
                });
            }
        }

        await Order.batchUpdate(spotOrders);
        await TradeModel.batchUpdate(spotOrders);
        await Account.batchUpdate(spotAccounts);
    }

    async getDepth(count = 1) {
        const instance = await Depth5Channel.findAll({
            where: { exchange_id: this.id },
            order: [['timestamp', 'DESC']],
            limit: count
        });
        if (count === 1 && instance.length >= 1) return instance[0];
        return instance;
    }

    async getCandle(count = 1) {
        const instance = await Candle60Channel.findAll({
            where: { exchange_id: this.id }, 
            order: [['timestamp', 'DESC']], 
            limit: count 
        });
        if (count === 1 && instance.length >= 1) return instance[0];
        return instance;
    }
}

Exchange.init({
    exchange: { type: Sequelize.STRING(30), comment: '交易所' },
    market: { type: Sequelize.STRING(30), comment: '货币对' },
    parameters: { type: Sequelize.TEXT, comment: '参数', defaultValue: '{}' },
    state: { type: Sequelize.STRING(30), comment: '状态', defaultValue: 'stoped' },
    enabled: { type: Sequelize.BOOLEAN, comment: '启用', defaultValue: false },
    simulate: { type: Sequelize.BOOLEAN, comment: '模拟', defaultValue: false },
}, {
    sequelize,
    tableName: 'exchanges',
    timestamps: false,
});

Exchange.RUNNING = 'running';
Exchange.STOPED = 'stoped';

Exchange.initExample = () => {
    Exchange.create({
        exchange: 'okex',
        market: 'etc_usdt',
        parameters: JSON.stringify({
            depthSize: 19600,
            tradeSize: 19600,
            candleSize: 19600,
            channels: ['spot/depth5', 'spot/candle60s']
        })    
    });
};

exports = module.exports = Exchange;