const Marketplace = require('./Marketplace');
const request = require('../definitions/request');
const crypto = require('crypto');
const Decimal = require('decimal');

const Error = require('./response/Error');
const Market = require('./response/Market');
const Depth = require('./response/Depth');
const Account = require('./response/Account');
const Order = require('./response/Order');
const OrderModel = require('../models/Order');

class Zb extends Marketplace {

    static getSignature(payload) {
        const secret = crypto.createHash('sha1').update(process.env.ZB_SECRET_KEY).digest('hex');
        return Buffer.from(
            crypto.createHmac('MD5', secret).update(payload).digest('hex')
        ).toString();
    }

    async getMarkets() {
        const url = process.env.ZB_ENDPOINT + '/data/v1/markets';
        const res = JSON.parse(await request(url));
        const markets = [];
        Object.keys(res).forEach(key => {
            const {amountScale, priceScale} = res[key];
            markets.push(
                new Market(
                    key.toLowerCase(),
                    Math.pow(10, parseInt(amountScale)*-1).toFixed(parseInt(amountScale)),
                    Math.pow(10, parseInt(priceScale)*-1).toFixed(parseInt(priceScale))
                )
            );
        });

        return markets;
    }

    async getDepth(size){
        const url = process.env.ZB_ENDPOINT + '/data/v1/depth?market=' + this.market + '&size=' +  + size;
        const res = JSON.parse(await request(url));
        const depth = new Depth(size, res.asks, res.bids, res.timestamp);
        return depth;
    }

    async getAccount(currency) {
        const nonce = new Date().getTime();
        const params = 'accesskey='+process.env.ZB_ACCESS_KEY+'&method=getAccountInfo';
        const signature = Zb.getSignature(params);
        const url = process.env.ZB_TRADE_ENDPOINT + '/api/getAccountInfo?' + params + '&sign='+signature+'&reqTime='+nonce;
        const res = JSON.parse(await request(url));

        const coins = res && res.result && res.result.coins || [];
        let account = null;
        coins.forEach(item => {
            if(item.key.toLowerCase() === currency.toLowerCase()){
                account = new Account(0, currency, item.available, item.freez);
            }
        });

        return account;
    }

    async getAccountList() {
        const nonce = new Date().getTime();
        const params = 'accesskey='+process.env.ZB_ACCESS_KEY+'&method=getAccountInfo';
        const signature = Zb.getSignature(params);
        const url = process.env.ZB_TRADE_ENDPOINT + '/api/getAccountInfo?' + params + '&sign='+signature+'&reqTime='+nonce;
        const res = JSON.parse(await request(url));

        const coins = res && res.result && res.result.coins || [];
        let accounts = [];
        coins.forEach(item => {
            accounts.push(new Account(0, item.key, item.available, item.freez));
        });

        return accounts;
    }

    async orders(side, price, volume, orderId) {
        const nonce = new Date().getTime();

        const params = [
            'accesskey='+process.env.ZB_ACCESS_KEY,
            'method=order',
            'acctType=0',           //现货交易
            'currency=' + this.market,
            'tradeType=' + (side === 'buy' ? 1 : 0),
            'amount='+volume,
            'price='+price,
            'customerOrderId='+orderId
        ].sort().join('&');

        const signature = Zb.getSignature(params);
        const url = process.env.ZB_TRADE_ENDPOINT + '/api/order?' + params + '&sign='+signature+'&reqTime='+nonce;

        try{
            const res = JSON.parse(await request(url));
            if(res.code && parseInt(res.code) === 1000){
                return new Order(res.id || -1, true, res.message);
            }else{
                return new Error(res.message, parseInt(res.code) || 1001);
            }
        }catch(e){
            return new Error(e);
        }
    }

    async ordersCancel(orderId) {
        const nonce = new Date().getTime();

        const params = [
            'accesskey='+process.env.ZB_ACCESS_KEY,
            'method=cancelOrder',
            'currency=' + this.market,
            'id='+orderId
        ].sort().join('&');

        const signature = Zb.getSignature(params);
        const url = process.env.ZB_TRADE_ENDPOINT + '/api/cancelOrder?' + params + '&sign='+signature+'&reqTime='+nonce;

        try{
            const res = JSON.parse(await request(url));
            if(res.code && parseInt(res.code) === 1000) {
                return new Order(res.order_id || orderId, parseInt(res.code) === 1000, res.message || '', OrderModel.CANCEL);
            }else{
                return new Error(res.message, parseInt(res.code) || 1001);
            }
        }catch(e){
            return new Error(e);
        }
    }

    async ordersQuery(orderId) {
        const nonce = new Date().getTime();

        const params = [
            'accesskey='+process.env.ZB_ACCESS_KEY,
            'method=getOrder',
            'id='+orderId,
            'currency=' + this.market
        ].sort().join('&');

        const signature = Zb.getSignature(params);
        const url = process.env.ZB_TRADE_ENDPOINT + '/api/getOrder?' + params + '&sign='+signature+'&reqTime='+nonce;

        try{
            const res = JSON.parse(await request(url));

            if(res.id){
                let state = OrderModel.TRADING;
                switch (parseInt(res.state|| res.status)) {
                    case 0:
                    case 3:
                    default:
                        state = OrderModel.TRADING;
                        break;
                    case 1:
                        state = OrderModel.CANCEL;
                        break;
                    case 2:
                        state = OrderModel.FINISHED;
                        break;
                }
                return new Order(
                    res.id,
                    true,
                    'success',
                    state,
                    Decimal(res.trade_money || 0).div(res.trade_amount || 0).toNumber(),   //均价
                    res.trade_amount || 0,
                    res.price || 0
                );
            }else{
                return new Error(res.message, parseInt(res.code) || 1001);
            }
        }catch(e){
            return new Error(e);
        }
    }

    getFee(amount) {
        return parseFloat(amount) * 0.2 / 100;
    }

    static getDebugDepth(){
        return JSON.parse('{"asks":[[3.9142,0.03],[3.914,30.19]],"bids":[[3.9131,132.08],[3.9125,92.67]],"timestamp":1579245474}');
    }
}

exports = module.exports = Zb;
