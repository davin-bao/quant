var querystring = require('querystring');
const crypto = require('crypto'); 
const datetime = require('node-datetime');
const Marketplace = require('./Marketplace');
const request = require('../definitions/request');
const Decimal = require('../definitions/decimal');

const Log = require('../definitions/Log');
const Error = require('./response/Error');
const Market = require('./response/Market');
const Depth = require('./response/Depth');
const Account = require('./response/Account');
const Order = require('./response/Order');
/**
 * 太多小单
 */
class Poloniex extends Marketplace {

    constructor(market) {
        super(market);
        const currencies = market.toUpperCase().split('_');
        this.market = currencies[1] + '_' + currencies[0];
    }

    static getSignature(payload) {
        let unescapeStr = querystring.unescape(payload);
        return crypto.createHmac('sha512', process.env.POLONIEX_SECRET_KEY).update(unescapeStr).digest('hex').toString();
    }

    async getMarkets() {
        return this.Error({ "error": "接口不支持" });
    }

    async getDepth(size) {
        try {
            const params = {
                command: 'returnOrderBook',
                currencyPair: this.market.toUpperCase(),
                depth: size
            };
            const url = process.env.POLONIEX_ENDPOINT + '/public?' + querystring.stringify(params);
            const res = JSON.parse(await request({ method: 'GET', uri: url }));
            if (res.asks && res.bids) {
                return new Depth(size, res.asks, res.bids, datetime.create().getTime());
            } else {
                return this.Error(res);
            }
        } catch (e) {
            return this.Error(e);
        }
    }

    async getAccount(currency) {
        const accounts = await this.getAccountList();
        if (accounts instanceof Error) return accounts;
        for (const account of accounts) {
            if (account.currency.toLowerCase() === currency.toLowerCase()) {
                return account;
            }
        }
        return this.Error({ 'code': 90002, 'err-msg': 'poloniex/' + currency + '账户不存在' });
    }

    async getAccountList() {
        try {
            const query = {
                command: 'returnCompleteBalances',
                nonce: datetime.create().getTime()
            };
            const header = {
                Key: process.env.POLONIEX_ACCESS_KEY,
                Sign: Poloniex.getSignature(querystring.stringify(query))
            };

            const url = process.env.POLONIEX_ENDPOINT + '/tradingApi';

            const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form: query }));
            // TODO
            if (!res.error) {
                let accounts = [];
                for (const currency of Object.keys(res)) {
                    accounts.push(new Account(0, currency.toLowerCase(), res[currency].available, res.locked && res[currency].onOrders || 0));
                }

                return accounts;
            }

            return this.Error(res);
        } catch (e) {
            return this.Error(e);
        }
    }

    // // 单笔 价格*数量 >= 1.00000000
    async orders(side, price, volume, orderId, accountId = 0) {
        try {
            const query = {
                command: 'buy',
                currencyPair: this.market,
                rate: price,
                amount: volume,
                fillOrKill: 0,
                immediateOrCancel: 0,
                clientOrderId: orderId,
                nonce: datetime.create().getTime()
            };
            const header = {
                Key: process.env.POLONIEX_ACCESS_KEY,
                Sign: Poloniex.getSignature(querystring.stringify(query))
            };

            const url = process.env.POLONIEX_ENDPOINT + '/tradingApi';

            const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form: query }));

            if (res.result === 'true' && res.orderNumber) {
                return new Order(res.orderNumber, true, res['err-msg'] || '');
            } else {
                return this.Error(res);
            }
        } catch (e) {
            return this.Error(e);
        }
    }

    async ordersCancel(orderId) {
        try {
            const query = {
                command: 'cancelOrder',
                orderNumber: orderId,
                nonce: datetime.create().getTime()
            };
            const header = {
                Key: process.env.POLONIEX_ACCESS_KEY,
                Sign: Poloniex.getSignature(querystring.stringify(query))
            };

            const url = process.env.POLONIEX_ENDPOINT + '/tradingApi';

            const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form: query }));

            if (res.success) {
                return new Order(res.data, parseInt(res.success) === 1, res['message'] || '');
            } else {
                return this.Error({ 'code': 3001, 'err-msg': res['message'] });
            }
        } catch (e) {
            return this.Error(e);
        }
    }

    async ordersQuery(orderId) {
        try {
            const query = {
                command: 'returnOrderStatus',
                orderNumber: orderId,
                nonce: datetime.create().getTime()
            };
            const header = {
                Key: process.env.POLONIEX_ACCESS_KEY,
                Sign: Poloniex.getSignature(querystring.stringify(query))
            };

            const url = process.env.POLONIEX_ENDPOINT + '/tradingApi';

            const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form: query }));

            if (parseInt(res.success === 1) && res.result[orderId]) {
                const {
                    status,
                    rate,
                    amount
                } = res.result[orderId];

                let state = Order.TRADING;

                // status: 订单状态 Open已挂单 Partially filled部分成交 filled已完成  其他情况 已取消
                switch (status) {
                    case 'open':
                    case 'Partially filled':
                        state = Order.TRADING;
                        break;
                        break;
                    case 'filled':
                        state = Order.FINISHED;
                        break;
                    case 'cancelled':
                    default:
                        state = Order.CANCEL;
                }

                return new Order(orderId, true, state, status, rate, amount, rate);
            } 
            return this.Error(res.result);
        } catch (e) {
            return this.Error(e);
        }
    }

    getFee(amount) {
        return Decimal(amount).mul(0.09).div(100).toNumber();
    }

    Error(e){
        const message = e.error || (e.response && e.response.data && e.response.data.message) || e.error_message || e || '通信失败';

        let code = Error.ERROR;
        const error = e.error || e.response && e.response.data && e.response.data.code || 1001;
        if (error.indexOf('Order not found.') > -1){
            code = Error.ERROR_ORDER_ID;    // 订单不存在(重复撤单，订单号不对等)
        }else if(error.indexOf('Not enough')> -1){
            code = Error.ACCOUNT_NOT_ENOUGH;    // 交易账户余额不足
        } else if(error.indexOf('either completed or does not exist.') > -1){
            code = Error.ORDER_FINISHED_WHEN_CANCEL;    // 订单已完成交易（撤单时完成交易的订单不能撤单）
        } 
        
        return new Error(message, code);
    }
}

exports = module.exports = Poloniex;
