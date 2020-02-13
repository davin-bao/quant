const datetime = require('node-datetime');
const Marketplace = require('./Marketplace');
const request = require('../definitions/request');
const crypto = require('crypto');
const Decimal = require('../definitions/decimal');
const { DateFormat, guid } = require('../definitions/utils');

const Log = require('../definitions/Log');
const Market = require('./response/Market');
const Depth = require('./response/Depth');
const Account = require('./response/Account');
const Error = require('./response/Error');
const Order = require('./response/Order');

class Binance extends Marketplace {

    static getSignature(payload) {
        return crypto.createHmac('SHA256', process.env.BINANCE_SECRET_KEY).update(payload).digest('hex');
    }

    async getMarkets() {
        const url = process.env.BINANCE_ENDPOINT + '/api/v3/exchangeInfo';
        const { symbols } = JSON.parse(await request(url));
        const markets = [];

        if (symbols){
            for (const { symbol, baseAsset, quoteAsset, baseAssetPrecision, quotePrecision} of symbols){
                markets.push(
                    new Market(
                        baseAsset.toLowerCase() + '_' + quoteAsset.toLowerCase(),
                        Decimal(1).div(Math.pow(10, parseInt(baseAssetPrecision))).toNumber(),
                        Decimal(1).div(Math.pow(10, parseInt(quotePrecision))).toNumber()
                    )
                );
            }
        }

        return markets;
    }

    async getDepth(size){
        const url = process.env.BINANCE_ENDPOINT + '/api/v3/depth?limit=10&symbol=' + this.market.toUpperCase().replace('_', '');
        const res = JSON.parse(await request(url));

        const depth = new Depth(size, res.asks, res.bids, datetime.create().getTime());
        return depth;
    }

    async getAccount(currency) {
        const accounts = await this.getAccountList();
        if(accounts instanceof Error) return accounts;
        for(const account of accounts){
            if(account.currency.toLowerCase() === currency.toLowerCase()){
                return account;
            }
        }
        return this.Error({ 'code': 90002, 'msg': 'binance/'+currency+'账户不存在'});
    }

    async getAccountList() {
        const query = {
            'recvWindow': 59999
        };

        const params = await this.getParams({}, ['recvWindow', 'timestamp']);

        const url = process.env.BINANCE_ENDPOINT + '/api/v3/account?' + params;

        try {
            const res = JSON.parse(await request({
                method: 'GET',
                uri: url,
                headers: {
                    'X-MBX-APIKEY': process.env.BINANCE_ACCESS_KEY,
                    'content-type': 'application/json'
                }
            }));

            if (res.balances){
                const accounts = [];
                for (const item of res.balances) {
                    accounts.push(new Account(0, item.asset.toLowerCase(), item.free, item.locked));
                }

                return accounts;
            }

            return this.Error(res);
        } catch (e) {
            return this.Error(JSON.parse(e.error || '{}'));
        }
    }

    // 单笔 价格*数量 >= 10.00000000
    async orders(side, price, volume, orderId, accountId = 0){
        try{
            const body = {
                'symbol': this.market.replace('_', '').toUpperCase(),
                'side': side.toUpperCase(),
                'type': 'MARKET',
                'quantity': volume,
                'newOrderRespType': 'ACK'
            };

            if(price > 0){
                // 限价交易
                body.type = 'LIMIT';
                body.timeInForce = 'IOC';  //有效方式 (timeInForce):GTC 成交为止 IOC 无法立即成交的部分就撤销 FOK 无法全部立即成交就撤销
                body.price = price;
            }
            
            const params = await this.getParams(body, ['symbol','side','type','timeInForce','quantity','price','recvWindow','timestamp']);
            
            const url = process.env.BINANCE_ENDPOINT + '/api/v3/order';
            const res = JSON.parse(await request({
                method: 'POST',
                uri: url,
                headers: {
                    'X-MBX-APIKEY': process.env.BINANCE_ACCESS_KEY,
                    'content-type': 'application/json'
                },
                body: params
            }));

            if (res.clientOrderId){
                return new Order(res.clientOrderId, true, '');
            }else{
                return this.Error(res);
            }
        } catch (e) {
            return this.Error(JSON.parse(e.error|| '{}'));
        }
    }

    async ordersCancel(orderId) {
        try {
            const body = {
                'symbol': this.market.replace('_', '').toUpperCase(),
                'orderId': orderId
            };

            const params = await this.getParams(body, ['symbol', 'orderId', 'recvWindow', 'timestamp']);

            const url = process.env.BINANCE_ENDPOINT + '/api/v3/order';
            const res = JSON.parse(await request({
                method: 'DELETE',
                uri: url + '?' + params,
                headers: {
                    'X-MBX-APIKEY': process.env.BINANCE_ACCESS_KEY,
                    'content-type': 'application/json'
                }
            }));

            if (res.status) {
                let state = Order.TRADING;

                // NEW 新建订单
                // PARTIALLY_FILLED 部分成交
                // FILLED 全部成交
                // CANCELED 已撤销
                // PENDING_CANCEL 撤销中（目前并未使用）
                // REJECTED 订单被拒绝
                // EXPIRED 订单过期（根据timeInForce参数规则）
                switch (res.status.toUpperCase()) {
                    case 'NEW':
                    case 'CANCELED':
                    case 'PENDING_CANCEL':
                    case 'REJECTED':
                    case 'EXPIRED':
                        state = Order.CANCEL;
                        break;
                    case 'PARTIALLY_FILLED':
                    case 'FILLED':
                        return this.Error({ code: 3001, msg: res.status});
                }

                return new Order(res.orderId, true, res.status, state, res.price, res.executedQty, res.price);
            } else {
                return this.Error(res);
            }
        } catch (e) {
            return this.Error(JSON.parse(e.error || '{}'));
        }
    }

    async ordersQuery(orderId) {
        try {
            const body = {
                'symbol': this.market.replace('_', '').toUpperCase(),
                'orderId': orderId
            };

            const params = await this.getParams(body, ['symbol', 'orderId', 'recvWindow', 'timestamp']);

            const url = process.env.BINANCE_ENDPOINT + '/api/v3/order';
            const res = JSON.parse(await request({
                method: 'GET',
                uri: url + '?' + params,
                headers: {
                    'X-MBX-APIKEY': process.env.BINANCE_ACCESS_KEY,
                    'content-type': 'application/json'
                }
            }));

            if (res.status) {
                let state = Order.TRADING;

                // NEW 新建订单
                // PARTIALLY_FILLED 部分成交
                // FILLED 全部成交
                // CANCELED 已撤销
                // PENDING_CANCEL 撤销中（目前并未使用）
                // REJECTED 订单被拒绝
                // EXPIRED 订单过期（根据timeInForce参数规则）
                switch (res.status.toUpperCase()) {
                    case 'NEW':
                    case 'PARTIALLY_FILLED':
                    default:
                        state = Order.TRADING;
                        break;
                    case 'CANCELED':
                    case 'PENDING_CANCEL':
                    case 'REJECTED':
                    case 'EXPIRED':
                        state = Order.CANCEL;
                        break;
                    case 'FILLED':
                        state = Order.FINISHED;
                        break;
                }

                return new Order(res.orderId, true, res.status, state, res.price, res.origQty, res.price);
            } else {
                return this.Error(res);
            }
        } catch (e) {
            return this.Error(JSON.parse(e.error || '{}'));
        }
    }

    getFee(amount) {
        return Decimal(amount).mul(0.1).div(100).toNumber();
    }

    Error(e){
        // //{"status":"error","err-code":"api-signature-not-valid","err-msg":"Signature not valid: Invalid submission time or incorrect time format [无效的提交时间，或时间格式错误]","data":null}
        const message = e['msg'] || e.message || e.error_message || '通信失败';

        let code = Error.ERROR;
        switch (parseInt(e['code']) || e.response && e.response.data && e.response.data.code || 1001) {
            case -2013:
            case -2011:  // 撤销订单时返回 Unknown order sent.
                code = Error.ERROR_ORDER_ID;    // 订单不存在(重复撤单，订单号不对等)
                break;
            case 90002:
                code = Error.ACCOUNT_NOT_EXIST;    //  account for type and user id does not exist
                break;
            case -2010:
                code = Error.ACCOUNT_NOT_ENOUGH;    // 交易账户余额不足
                break;
            case 3001:
                code = Error.ORDER_FINISHED_WHEN_CANCEL;    // 订单已完成交易（撤单时完成交易的订单不能撤单）
                break;
            default:
                code = Error.ERROR;
                break;
        }
        return new Error(message, code);
    }

    async getParams(body={}, sort=[]){        
        const params = [];
        body.recvWindow = 59999;
        body.timestamp = (await this.getTimestamp());
        for (const key of sort) {
            params.push(key + '=' + body[key]);
        }
        const signature = Binance.getSignature(params.join('&'));

        return [
            ...params,
            'signature=' + signature
        ].join('&');
    }

    async getTimestamp(){
        const cacheKey = 'MARKETPLACE|TIME_OFFSET|BINANCE';
        let  timeOffset = F.cache.get(cacheKey);

        if (timeOffset === undefined) {
            timeOffset = 0 //await this.getServerTimestamp();
            if(timeOffset instanceof Error){
                throw timeOffset;
            }
            F.cache.set2(cacheKey, timeOffset, '1 hour');
        }

        const timestamp = datetime.create();
        const timestamp1 = datetime.create(timestamp.getTime() + timeOffset);

        // timestamp1.offsetInHours(-8);
        return timestamp1.getTime();
    }

    async getServerTimestamp(){
        const url = process.env.BINANCE_ENDPOINT + '/api/v3/time';
        const res = JSON.parse(await request(url));
        if (res.serverTime){
            const dt = datetime.create();
            const offset = parseInt(res.serverTime) - parseInt(dt.getTime());
            Log.Info(__filename, 'HBG 系统对时,本地时间:' + dt.format('H:M:S.N') + '远程时间:' + DateFormat(new Date(res.serverTime), 'h:m:s.S') + ' 偏差(ms):' + offset);
            return offset;
        }

        return this.Error(res);
    }

}

exports = module.exports = Binance;
