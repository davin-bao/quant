const Marketplace = require('./Marketplace');
const request = require('../definitions/request');
const { PublicClient, AuthenticatedClient } = require('@okfe/okex-node');
const crypto = require('crypto');

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

            return new Depth(size, res.asks || [], res.bids || [], res.timestamp || '');
        }catch(e){
            return new Error(e);
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
            return new Account(res.id || 0, res.currency || '', res.available || 0, res.hold || 0);
        }catch(e){
            return new Error(e);
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
            const coins = res || [];
            let accounts = [];
            coins.forEach(item => {
                accounts.push(new Account(0, item.currency, item.available, item.hold, 0));
            });

            return accounts;
        }catch(e){
            return new Error(e);
        }
    }

    async orders(side, price, volume, orderId) {
        const params = {
            side,
            instrument_id: this.market.toUpperCase(),
            size: volume,
            price: price + '',
            order_type: '2',
            client_oid: 'OKEX' + orderId
        };
        let res = {};
        try{
            res = await this.authClient.spot().postOrder(params);
            return new Order(res.order_id || -1, res.result || false, res.error_message || '');
        }catch(e){
            return new Error(e);
        }
    }

    async ordersCancel(orderId) {
        const params = {
            instrument_id: this.market.toUpperCase()
        };
        try{
            const res = await this.authClient.spot().postCancelOrder(orderId, params);
            return new Order(res.order_id || -1, res.result || false, res.error_message || '', res.result ? Order.CANCEL:Order.TRADING);
        }catch(e){
            return new Error(e);
        }
    }

    async ordersQuery(orderId) {
        const params = {
            instrument_id: this.market.toUpperCase()
        };
        try{
            const res = await this.authClient.spot().getOrder(orderId, params);
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

            return new Order(res.order_id, res.result, res.error_message, res.state, res.price_avg, res.filled_size, res.filled_notional);
        }catch(e){
            return new Error(e);
        }
    }

    getFee(amount) {
        return parseFloat(amount) * 0.1 / 100;
    }
}


exports = module.exports = Okex;
