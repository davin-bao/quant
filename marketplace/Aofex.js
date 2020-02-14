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

class Aofex extends Marketplace {

    static getSignature(payload) {
        return crypto.createHmac('SHA256', process.env.AOFEX_SECRET_KEY).update(payload).digest('base64');
    }

    async getMarkets() {
        // {"symbol":"ETCUSDT","price_precision":4,"volume_precision":2,"taker_fee":0.00200000,"maker_fee":0.00200000}
        const url = 'https://www.fatbtc.us//m/symbols/1/' + datetime.create().getTime();
        const res = JSON.parse(await request(url));

        if (parseInt(res.status) === 1) {
            const markets = [];
            for(const {
                base_currency,
                quote_currency,
                volume_precision,
                price_precision
            } of res.symbols){
                markets.push(
                    new Market(
                        base_currency.toLowerCase() + '_' + quote_currency.toLowerCase(),
                        volume_precision,
                        price_precision
                    )
                );
            }
            return markets;
        } else {
            return this.Error(res);
        }

        return markets;
    }

    async getDepth(size){
        try{
            let params = {
                'symbol': this.market.replace('_', '').toLowerCase()
            };

            const url = 'https://openapi.biki.com/open/api/market_dept?type=step0&' + querystring.stringify(params);
            const res = JSON.parse(await request({ method: 'GET', uri: url }));
            if (parseInt(res.code) === 0) {
                return new Depth(size, res.data.tick.asks, res.data.tick.bids, res.data.tick.time);
            }else{
                return this.Error(res);
            }
        }catch(e){
            return this.Error(e);
        }
    }

    async getAccount(currency) {
        // let nonce = new Date().getTime();
        // nonce = nonce/1000;
        // const params = nonce + 'GET' +  '/api/account/v3/wallet/' + currency;
        // const signature = Aofex.getSignature(params);
        // const url = process.env.AOFEX_ENDPOINT + '/api/account/v3/wallet/' + currency;
        // const res = JSON.parse(await request({
        //     uri: url,
        //     headers: {
        //         'OK-ACCESS-KEY': process.env.AOFEX_ACCESS_KEY,
        //         'OK-ACCESS-PASSPHRASE': process.env.AOFEX_PASS,
        //         'OK-ACCESS-TIMESTAMP': nonce,
        //         'OK-ACCESS-SIGN': signature
        //     }
        // }));
        try{
            const res = await this.authClient.spot().getAccounts(currency);
            Log.request(0, process.env.AOFEX_ENDPOINT + '/api/spot/v3/instruments/accounts', JSON.stringify(res));
            return new Account(res.id || 0, res.currency || '', res.available || 0, res.hold || 0);
        }catch(e){
            return this.Error(e);
        }
    }

    async getAccountList() {
        // let nonce = new Date().getTime();
        // nonce = nonce/1000;
        // const params = nonce + 'GET' +  '/api/account/v3/wallet';
        // const signature = Aofex.getSignature(params);
        // const url = process.env.AOFEX_ENDPOINT + '/api/account/v3/wallet';
        // const res = JSON.parse(await request({
        //     uri: url,
        //     headers: {
        //         'OK-ACCESS-KEY': process.env.AOFEX_ACCESS_KEY,
        //         'OK-ACCESS-PASSPHRASE': process.env.AOFEX_PASS,
        //         'OK-ACCESS-TIMESTAMP': nonce,
        //         'OK-ACCESS-SIGN': signature
        //     }
        // }));

        try{
            const res = await this.authClient.spot().getAccounts();
            Log.request(0, process.env.AOFEX_ENDPOINT + '/api/spot/v3/instruments/accounts', JSON.stringify(res));
            const coins = res || [];
            let accounts = [];
            coins.forEach(item => {
                accounts.push(new Account(0, item.currency, item.available, item.hold, 0));
            });

            return accounts;
        }catch(e){
            return this.Error(e);
        }
    }

    async orders(side, price, volume, orderId, accountId = 0) {
        // order_type:
        // 0：普通委托（order type不填或填0都是普通委托）
        // 1：只做Maker（Post only）
        // 2：全部成交或立即取消（FOK）
        // 3：立即成交并取消剩余（IOC）
        const params = {
            side,
            instrument_id: this.market.toUpperCase(),
            client_oid: 'OKEX' + orderId,
            order_type: '0'
        };
        if(price < 0){
            // 市价单
            params.type = 'market';
            if(side === 'sell') {
                params.size = volume;
            }else{
                params.notional = volume;
            }
        }else{
            // 限价单
            params.size = volume;
            params.type = 'limit';
            params.price = price + '';
        }
        let res = {};
        try{
            res = await this.authClient.spot().postOrder(params);
            Log.request(0, process.env.AOFEX_ENDPOINT + '/api/spot/v3/instruments/orders', JSON.stringify(res));
            if(res.error_code && parseInt(res.error_code) !== 0){
                return this.Error(res);
            }
            return new Order(res.order_id || -1, res.result || false, res.error_message || '');
        }catch(e){
            return this.Error(e);
        }
    }

    async ordersCancel(orderId) {
        const params = {
            instrument_id: this.market.toUpperCase()
        };
        try{
            const res = await this.authClient.spot().postCancelOrder(orderId, params);
            Log.request(0, process.env.AOFEX_ENDPOINT + '/api/spot/v3/instruments/cancel_orders/' + orderId, JSON.stringify(res));
            return new Order(res.order_id || -1, res.result || false, res.error_message || '', res.result ? Order.CANCEL:Order.TRADING);
        }catch(e){
            return this.Error(e);
        }
    }

    async ordersQuery(orderId) {
        const params = {
            instrument_id: this.market.toUpperCase()
        };
        try{
            const res = await this.authClient.spot().getOrder(orderId, params);
            Log.request(0, process.env.AOFEX_ENDPOINT + '/api/spot/v3/instruments/orders/' + orderId, JSON.stringify(res));
            let state = Order.TRADING;

            switch (parseInt(res.state)) {
                case 0:
                case 1:
                case 3:
                case 4:
                default:
                    state = Order.TRADING;
                    break;
                case -2:
                case -1:
                    state = Order.CANCEL;
                    break;
                case 2:
                    state = Order.FINISHED;
                    break;
            }

            return new Order(res.order_id, res.result, res.error_message || res.status, state, res.price_avg, res.filled_size, res.price);
        }catch(e){
            return this.Error(e);
        }
    }

    getFee(amount) {
        return Decimal(amount).mul(0.19).div(100).toNumber();
    }

    Error(e){
        const message = e.errmsg || (e.response && e.response.data && e.response.data.message) || e.error_message || e || '通信失败';

        let code = Error.ERROR;
        switch (parseInt(e.errno || e.response && e.response.data && e.response.data.code) || 1001) {
            case 33014:
                code = Error.ERROR_ORDER_ID;    // 订单不存在(重复撤单，订单号不对等)
                break;
            case 33017:
                code = Error.ACCOUNT_NOT_ENOUGH;    // 交易账户余额不足
                break;
            case 33026:
                code = Error.ORDER_FINISHED_WHEN_CANCEL;    // 订单已完成交易（撤单时完成交易的订单不能撤单）
                break;
            default:
                code = Error.ERROR;
                break;
        }
        return new Error(message, code);
    }
}

exports = module.exports = Aofex;
