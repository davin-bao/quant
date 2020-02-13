const datetime = require('node-datetime');
var querystring = require('querystring');
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

class Gate extends Marketplace {

    static getSignature(payload) {
        let unescapeStr = querystring.unescape(payload);
        return crypto.createHmac('sha512', process.env.GATE_SECRET_KEY).update(unescapeStr).digest('hex').toString();
    }

    async getMarkets() {
        const url = process.env.GATE_QUERY_ENDPOINT + '/api2/1/marketinfo';
        const { result, pairs } = JSON.parse(await request(url));
        const markets = [];
        if(result === 'true' && pairs){
            for(const pair of pairs){
                const market = Object.keys(pair)[0];
                const {
                    min_amount,
                    min_amount_b: min_price
                } = pair[market];

                markets.push(
                    new Market(
                        market,
                        min_amount,
                        min_price
                    )
                );
            }
        }

        return markets;
    }

    async getDepth(size){
        const url = process.env.GATE_QUERY_ENDPOINT + '/api2/1/orderBook/' + this.market;
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
        return this.Error({ 'code': 90002, 'err-msg': 'gate/'+currency+'账户不存在'});
    }

    async getAccountList() {
        const url = process.env.GATE_QUERY_ENDPOINT + '/api2/1/private/balances';
        let body = {};
        let header = {};
        header.KEY = process.env.GATE_ACCESS_KEY;
        header.SIGN = Gate.getSignature(querystring.stringify(body));

        const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form: body }));
        // TODO
        if(res.result === 'true'){
            let accounts = [];
            for (const currency of Object.keys(res.available)){
                accounts.push(new Account(0, currency.toLowerCase(), res.available[currency], res.locked && res.locked[currency] || 0));
            }

            return accounts;
        }

        return this.Error(res);
    }

    // // 单笔 价格*数量 >= 1.00000000
    async orders(side, price, volume, orderId, accountId = 0){
        try{
            let form = {
                'currencyPair': this.market,
                'rate': price,
                'amount': volume,
                'text': 't-' + orderId
            };
            let header = {};
            header.KEY = process.env.GATE_ACCESS_KEY;
            header.SIGN = Gate.getSignature(querystring.stringify(form));

            const url = process.env.GATE_QUERY_ENDPOINT + '/api2/1/private/' + side.toLowerCase();
            const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form }));

            if (res.result === 'true' && res.orderNumber){
                return new Order(res.orderNumber, true, res['err-msg'] || '');
            }else{
                return this.Error(res);
            }
        }catch(e){
            return this.Error(e);
        }
    }

    async ordersCancel(orderId) {
        try{
            let form = { 'currencyPair': this.market, 'orderNumber': orderId };
            let header = { 'Content-Type': 'application/x-www-form-urlencoded' };
            header.KEY = process.env.GATE_ACCESS_KEY;
            header.SIGN = Gate.getSignature(querystring.stringify(form));

            const url = process.env.GATE_QUERY_ENDPOINT + '/api2/1/private/cancelOrder';
            const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form }));

            if(res.result === 'true'){
                return new Order(res.data, true, res['err-msg'] || '');
            }else {
                return this.Error({ 'code': 3001, 'err-msg': res['message']});
            }
        }catch(e){
            return this.Error(e);
        }
    }

    async ordersQuery(orderId) {
        try{
            let form = { 'currencyPair': this.market, 'orderNumber': orderId };
            let header = { 'Content-Type': 'application/x-www-form-urlencoded' };
            header.KEY = process.env.GATE_ACCESS_KEY;
            header.SIGN = Gate.getSignature(querystring.stringify(form));

            const url = process.env.GATE_QUERY_ENDPOINT + '/api2/1/private/getOrder';
            const res = JSON.parse(await request({ method: 'POST', uri: url, headers: header, form }));

            if (res.result === 'true' && res.order && res.order.status) {

                let state = Order.TRADING;

                // status: 订单状态 open已挂单 cancelled已取消 closed已完成
                switch (res.order.status.toLowerCase()) {
                    case 'open':
                    default:
                        state = Order.TRADING;
                        break;
                    case 'cancelled':
                        state = Order.CANCEL;
                        break;
                    case 'closed':
                        state = Order.FINISHED;
                        break;
                }

                return new Order(res.data.id, true, state, res.order.status, res.data.rate, res.order.amount, res.data.rate);
            }
            return this.Error(res);
        }catch(e){
            return this.Error(e);
        }
    }

    getFee(amount) {
        return Decimal(amount).mul(0.2).div(100).toNumber();
    }

    Error(e){
        // //{"status":"error","err-code":"api-signature-not-valid","err-msg":"Signature not valid: Invalid submission time or incorrect time format [无效的提交时间，或时间格式错误]","data":null}
        const message = e['err-msg'] || e.message || e.error_message || '通信失败';

        let code = Error.ERROR;
        switch (parseInt(e['code']) || e.response && e.response.data && e.response.data.code || 1001) {
            case 17:
                code = Error.ERROR_ORDER_ID;    // Error: The order cancelled or not found 订单不存在(重复撤单，订单号不对等)
                break;
            case 90002:
                code = Error.ACCOUNT_NOT_EXIST;    //  account for type and user id does not exist
                break;
            case 21:
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

    async getUri(path, method='GET', params = []){
        params = [
            'AccessKeyId='+process.env.GATE_ACCESS_KEY,
            'SignatureMethod=HmacSHA256',
            'SignatureVersion=2',
            'Timestamp=' + (await this.getTimestamp()),
            ...params
        ].sort().join('&');
        const signature = Gate.getSignature(method+'\napi.huobi.pro\n'+path+'\n'+params);
        return process.env.GATE_ENDPOINT + path + '?' + params + '&Signature='+signature;
    }

    async getTimestamp(){
        const cacheKey = 'MARKETPLACE|TIME_OFFSET|GATE';
        let  timeOffset = F.cache.get(cacheKey);

        if (timeOffset === undefined) {
            timeOffset = 0;//await this.getServerTimestamp();
            if(timeOffset instanceof Error){
                throw timeOffset;
            }
            F.cache.set2(cacheKey, timeOffset, '1 hour');
        }

        const timestamp = datetime.create();
        const timestamp1 = datetime.create(timestamp.getTime() + timeOffset);

        timestamp1.offsetInHours(-8);
        return encodeURIComponent(timestamp1.format('Y-m-dTH:M:S'));
    }

    async getServerTimestamp(){
        const url = process.env.GATE_ENDPOINT + '/v1/common/timestamp';
        const res = JSON.parse(await request(url));
        if(res.status === 'ok'){
            const dt = datetime.create();
            const offset = parseInt(res.data) - parseInt(dt.getTime());
            Log.Info(__filename, 'GATE 系统对时,本地时间:' + dt.format('H:M:S.N') + '远程时间:' + DateFormat(new Date(res.data), 'h:m:s.S') + ' 偏差(ms):' + offset);
            return offset;
        }

        return this.Error(res);
    }

}

exports = module.exports = Gate;
