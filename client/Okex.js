const { V3WebsocketClient } = require('@okfe/okex-node');
var HttpsProxyAgent = require('https-proxy-agent');
const datetime = require('node-datetime');
const Client = require('./Client');
const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');

class Okex extends Client {
    constructor(market, options) {
        market = market.toUpperCase().replace('_', '-');
        super(market, options);
    }
    connect() {
        const self = this;
        const options = {};
        if (process.env.NODE_ENV !== 'production') {
            var agent = new HttpsProxyAgent(process.env.http_proxy || 'http://127.0.0.1:1081');
            options.agent = agent;
        }

        self.wss = new V3WebsocketClient(process.env.OKEX_SOCK_ENDPOINT || 'wss://real.okex.com:8443/ws/v3');

        self.wss.connect(options);

        self.wss.on('open', data => {
            this.emit('open');
        });

        self.wss.on('message', data => this.wsMessage(data));
    }

    close() {
        this.wss && this.wss.close();
    }

    /**
     * 行情订阅， 无需传递货币对
     * @param {*} channels
     */
    subscribeAuotations(channel) {
        this.subscribe(channel + ':' + this.market);
    }
    /**
     * 币币账户订阅
     * @param {*} currency
     */
    subscribeSpotAccount(currency) {
        this.subscribe('spot/account:' + currency.toUpperCase());
    }
    /**
     * 委托单订阅
     */
    subscribeSpotOrder() {
        this.subscribe('spot/order:' + this.market);
    }

    subscribe(channel) {
        this.wss.subscribe(channel);
    }

    login() {
        this.wss.login(process.env.OKEX_ACCESS_KEY, process.env.OKEX_SECRET_KEY, process.env.OKEX_PASS);
    }

    //websocket 返回消息
    wsMessage(data) {
        const self = this;
        var obj = JSON.parse(data);
        var eventType = obj.event;
        if (eventType == 'login') {
            //登录消息
            if (obj.success == true) {
                this.emit('login');
                // self.wss.subscribe('spot/account:BTC');
            }
        } else if (eventType == undefined) {
            //行情消息相关
            self.tableMsg(obj);
        } else {
            console.log(`!!! websocket message =${data}`);
        }
    }

    tableMsg(marketData) {
        var tableType = marketData.table;
        switch (tableType) {
            case 'spot/account':
                this.parseSpotAccount(marketData);
                break;
            case 'spot/order':
                this.parseSpotOrder(marketData);
                break;
            case 'spot/trade':
                this.parseSpotTrade(marketData);
                break;
            case 'spot/depth5':
                this.parseDepth5(marketData);
                break;
            case 'spot/candle60s':
                this.parseCandle60s(marketData);
                break;
            default:
                console.log(`!!! websocket table message =${JSON.stringify(marketData)}`);
                break;
        }
    }

    getFee(amount) {
        return Decimal(amount).mul(0.15).div(100).toNumber();
    }

    parseSpotOrder(marketData) {
        const orders = [];
        for (const item of marketData.data) {
              //1：币币交易订单 2：杠杆交易订单
            const margin_trading = parseInt(item.margin_trading) === 1 ? 'spot' : 'margin';

            // 0：普通委托 1：只做Maker（Post only） 2：全部成交或立即取消（FOK） 3：立即成交并取消剩余（IOC）
            let order_type = 'general';
            switch (parseInt(item.order_type)) {
                case 0:
                default:
                    order_type = 'general';
                    break;
                case 1:
                    order_type = 'maker';
                    break;
                case 2:
                    order_type = 'fok';
                    break;
                case 3:
                    order_type = 'ioc';
                    break;
            }
             // -2:失败 -1: 撤单成功 0: 等待成交 1: 部分成交 2: 完全成交 3: 下单中 4: 撤单中
            let state = Client.ORDER_STATE_WAITING;
            switch (parseInt(item.state)) {
                case -2:
                    state = Client.ORDER_STATE_FAILED;
                    break;
                case -1:
                    state = Client.ORDER_STATE_CANCEL_SUCCESS;
                    break;
                case 0:
                default:
                    state = Client.ORDER_STATE_WAITING;
                    break;
                case 1:
                    state = Client.ORDER_STATE_PARTIAL;
                    break;
                case 2:
                    state = Client.ORDER_STATE_FILLED;
                    break;
                case 3:
                    state = Client.ORDER_STATE_WAITING;
                    break;
                case 4:
                    state = Client.ORDER_STATE_CANCELLING;
                    break;
            }

            orders.push({
                id: parseInt(item.client_oid.replace('OKEX', '')),  // 由用户设置的订单ID, client_oid: 'OKEX' + orderId,
                market: item.instrument_id.toLowerCase().replace('-', '_'),  // 币对名称
                order_id: item.order_id,        // 订单ID
                price: item.price,              // 委托价格
                quantity: item.size,                // 委托数量（交易货币数量）
                notional: item.notional,        // 买入金额，市价买入时返回
                side: item.side,                // buy 或 sell
                filled_notional: item.filled_notional,  // 已成交金额
                filled_quantity: item.filled_size,  // 已成交数量
                last_fill_px: item.last_fill_px,        // 最新成交价格（如果没有，推0）
                last_fill_qty: item.last_fill_qty,      // 最新成交数量（如果没有，推0）
                last_fill_time: item.last_fill_time,    // 最新成交时间（如果没有，推1970-01-01T00:00:00.000Z）
                margin_trading,
                order_type,
                state,             
                timestamp: item.timestamp,      // 订单状态更新时间
                type: item.type,                // limit或market（默认是limit）
                created_at: item.created_at,    // 订单创建时间
                filled_fee: this.getFee(item.filled_notional)
            });
        }
        this.emit('spot_order', orders);
    }

    parseSpotAccount(marketData) {
        //{"table":"spot/account","data":[{"available":"3.997542620275","currency":"USDT","id":"","balance":"3.997542620275","hold":"0"}]}
        //{"table":"spot/account","data":[{"available":"4.197542620275","currency":"USDT","id":"","balance":"4.197542620275","hold":"0"}]}
        const accounts = [];
        for(const item of marketData.data){
            accounts.push({
                account_id: item.id,
                currency: item.currency,
                balance: item.balance,
                available: item.available,
                locked: item.hold
            });
        }
        this.emit('spot_account', accounts);
    }

    parseSpotTrade(marketData) {
        const trades = [];
        for (const item of marketData.data) {
            const dt = datetime.create(item.timestamp);
            trades.push({
                trade_id: item.trade_id,
                price: parseFloat(item.price),
                size: parseFloat(item.size),
                side: item.side,        // buy 或 sell
                time: item.timestamp,
                timestamp: dt.getTime()
            });
        }
        this.emit('spot_trade', trades);
    }

    parseDepth5(marketData) {
        const dt = datetime.create(marketData.data[0].timestamp);
        this.emit('depth5', {
            asks: marketData.data[0].asks,
            bids: marketData.data[0].bids,
            time: marketData.data[0].timestamp,
            timestamp: dt.getTime()
        });
    }

    parseCandle60s(marketData) {
        const candles = [];
        for (const item of marketData.data) {
            const { candle } = item;

            const dt = datetime.create(candle[0]);
            candles.push({
                time: candle[0],
                timestamp: dt.getTime(),
                start: parseFloat(candle[1]),
                max: parseFloat(candle[2]),
                min: parseFloat(candle[3]),
                end: parseFloat(candle[4]),
                volumn: parseFloat(candle[5])
            });
        }
        
        this.emit('candle60s', candles);
    }


}

exports = module.exports = Okex;
