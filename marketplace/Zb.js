const Marketplace = require('./Marketplace');
const request = require('../definitions/request');
const crypto = require('crypto');
const Decimal = require('../definitions/decimal');

const Error = require('./response/Error');
const Market = require('./response/Market');
const Depth = require('./response/Depth');
const Account = require('./response/Account');
const Order = require('./response/Order');

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

    async orders(side, price, volume, orderId, accountId = 0) {
        const nonce = new Date().getTime();

        if(price < 0){
            const depth = await this.getDepth(1);
            price = (side === 'buy') ? parseFloat(depth.getLastAsks()[0]) : parseFloat(depth.getLastBids()[0]);
            volume = (side === 'buy') ? Decimal(volume).div(price).toNumber() : volume;
        }

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
            }else if(res.message.indexOf('委托繁忙，请稍后委托') > -1){
                return new Order(res.id || -1, true, res.message, Order.NEED_TRADE);
            }else{
                return this.Error(res);
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
                return new Order(res.order_id || orderId, parseInt(res.code) === 1000, res.message || '', Order.CANCEL);
            }else{
                return this.Error(res);
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
                let state = Order.TRADING;
                switch (parseInt(res.state|| res.status)) {
                    case 0:
                    case 3:
                    default:
                        state = Order.TRADING;
                        break;
                    case 1:
                        state = Order.CANCEL;
                        break;
                    case 2:
                        state = Order.FINISHED;
                        break;
                }
                return new Order(
                    res.id,
                    true,
                    'state:' + state,
                    state,
                    Decimal(res.trade_money || 0).div(res.trade_amount || 0).toNumber(),   //均价
                    res.trade_amount || 0,
                    res.price || 0
                );
            }else{
                return this.Error(res);
            }
        }catch(e){
            return new Error(e);
        }
    }

    getFee(amount) {
        return Decimal(amount).mul(0.2).div(100).toNumber();
    }

    Error(e){

        const message = e.message || e || '通信失败';
        let code = Error.ERROR;
        switch (parseInt(e.code) || 1001) {
            case 2001:
            case 2002:
            case 2003:
            case 2004:
            case 2005:
            case 2006:
            case 2007:
            case 2008:
            case 2009:
                code = Error.ACCOUNT_NOT_ENOUGH;    // 交易账户余额不足
                break;
            case 3001:
                code = Error.ORDER_FINISHED_WHEN_CANCEL;    // 订单已完成交易（撤单时完成交易的订单不能撤单）
                break;
            case 1001:
            default:
                if(message.indexOf('Error order id') > -1){
                    code = Error.ERROR_ORDER_ID;    // 订单不存在(重复撤单，订单号不对等)
                }else{
                    code = Error.ERROR;
                }
                break;
        }
        return new Error(message, code);
    }
}

exports = module.exports = Zb;
