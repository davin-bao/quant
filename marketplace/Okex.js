const Marketplace = require('./Marketplace');
const request = require('../definitions/request');
const { PublicClient, AuthenticatedClient } = require('@okfe/okex-node');
const crypto = require('crypto');
const Decimal = require('../definitions/decimal');

const Log = require('../definitions/Log');
const Error = require('./response/Error');
const Market = require('./response/Market');
const Depth = require('./response/Depth');
const Account = require('./response/Account');
const Order = require('./response/Order');

const tunnel = require('tunnel');

class Okex extends Marketplace {

    constructor(market) {
        super(market);

        const timeout = 30000;
        const tunnelProxy = tunnel.httpsOverHttp({
            proxy: {
                host: '127.0.0.1',
                port: '1080'
            },
        });
        const axiosConfig = {
            proxy: false,
            httpsAgent: tunnelProxy
        };

        this.pClient = new PublicClient(process.env.OKEX_ENDPOINT, timeout, axiosConfig);

        this.authClient = new AuthenticatedClient(
            process.env.OKEX_ACCESS_KEY,
            process.env.OKEX_SECRET_KEY,
            process.env.OKEX_PASS,
            process.env.OKEX_ENDPOINT,
            timeout,
            axiosConfig
        );
    }

    static getSignature(payload) {
        return crypto.createHmac('SHA256', process.env.OKEX_SECRET_KEY).update(payload).digest('base64');
    }

    async getMarkets() {
        const url = process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments';
        const res = JSON.parse(await request(url));

        Log.request(0, process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/markets', JSON.stringify(res));
        const markets = [];
        res.forEach((
            {
                'base_currency': baseCurrency,
                'quote_currency': quoteCurrency,
                'min_size': min_amount,
                'tick_size': min_price
            }) => {
            markets.push(
                new Market(
                    baseCurrency.toLowerCase()+'_'+quoteCurrency.toLowerCase(),
                    min_amount,
                    min_price
                )
            );
        });

        return markets;
    }

    async getDepth(size){
        let res = {};
        try{
            const res = await this.pClient.spot().getSpotBook(this.market, {
                size,
                depth: 0.00000001
            });
            Log.request(0, process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/book', JSON.stringify(res));
            return new Depth(size, res.asks || [], res.bids || [], res.timestamp || '');
        }catch(e){
            return this.Error(e);
        }

        // const url = process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/'+this.market.replace('_', '-').toUpperCase()+'/book?depth=0.00000001&size=' + size;
        // const res = JSON.parse(await request(url));
        // return new Depth(size, res.asks, res.bids, res.timestamp);
    }

    async getAccount(currency) {
        // let nonce = new Date().getTime();
        // nonce = nonce/1000;
        // const params = nonce + 'GET' +  '/api/account/v3/wallet/' + currency;
        // const signature = Okex.getSignature(params);
        // const url = process.env.OKEX_ENDPOINT + '/api/account/v3/wallet/' + currency;
        // const res = JSON.parse(await request({
        //     uri: url,
        //     headers: {
        //         'OK-ACCESS-KEY': process.env.OKEX_ACCESS_KEY,
        //         'OK-ACCESS-PASSPHRASE': process.env.OKEX_PASS,
        //         'OK-ACCESS-TIMESTAMP': nonce,
        //         'OK-ACCESS-SIGN': signature
        //     }
        // }));
        try{
            const res = await this.authClient.spot().getAccounts(currency);
            Log.request(0, process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/accounts', JSON.stringify(res));
            return new Account(res.id || 0, res.currency || '', res.available || 0, res.hold || 0);
        }catch(e){
            return this.Error(e);
        }
    }

    async getAccountList() {
        // let nonce = new Date().getTime();
        // nonce = nonce/1000;
        // const params = nonce + 'GET' +  '/api/account/v3/wallet';
        // const signature = Okex.getSignature(params);
        // const url = process.env.OKEX_ENDPOINT + '/api/account/v3/wallet';
        // const res = JSON.parse(await request({
        //     uri: url,
        //     headers: {
        //         'OK-ACCESS-KEY': process.env.OKEX_ACCESS_KEY,
        //         'OK-ACCESS-PASSPHRASE': process.env.OKEX_PASS,
        //         'OK-ACCESS-TIMESTAMP': nonce,
        //         'OK-ACCESS-SIGN': signature
        //     }
        // }));

        try{
            const res = await this.authClient.spot().getAccounts();
            Log.request(0, process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/accounts', JSON.stringify(res));
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

    async orders(side, price, volume, orderId) {
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
            Log.request(0, process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/orders', JSON.stringify(res));
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
            Log.request(0, process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/cancel_orders/' + orderId, JSON.stringify(res));
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
            Log.request(0, process.env.OKEX_ENDPOINT + '/api/spot/v3/instruments/orders/' + orderId, JSON.stringify(res));
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
        return Decimal(amount).mul(0.15).div(100).toNumber();
    }

    Error(e){
        const message = (e.response && e.response.data && e.response.data.message) || e.message || e.error_message || e || '通信失败';

        let code = Error.ERROR;
        switch (parseInt(e.error_code || e.response && e.response.data && e.response.data.code) || 1001) {
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

exports = module.exports = Okex;
