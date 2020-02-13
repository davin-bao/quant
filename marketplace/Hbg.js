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

class Hbg extends Marketplace {

    static getSignature(payload) {
        return encodeURIComponent(crypto.createHmac('SHA256', process.env.HBG_SECRET_KEY).update(payload).digest('base64'));
    }

    async getMarkets() {
        const url = process.env.HBG_ENDPOINT + '/v1/common/symbols';
        const { status, data } = JSON.parse(await request(url));
        const markets = [];
        data.forEach((
            {
                'base-currency': baseCurrency,
                'quote-currency': quoteCurrency,
                'min-order-amt': min_amount,
                'min-order-value': min_price
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
        const url = process.env.HBG_ENDPOINT + '/market/depth?type=step0&symbol=' + this.market.replace('_', '');
        const { tick: res } = JSON.parse(await request(url));

        const depth = new Depth(size, res.asks, res.bids, res.ts);
        return depth;
    }

    async getAccountId() {
        const url = await this.getUri('/v1/account/accounts');
        const res = JSON.parse(await request(url));
        if(res.status === 'ok'){
            for(const account of res.data){
                if(account.type === 'spot'){
                    return account.id;
                }
            }
        }

        return this.Error(res);
    }

    async getAccount(currency) {
        const accounts = await this.getAccountList();
        if(accounts instanceof Error) return accounts;
        for(const account of accounts){
            if(account.currency.toLowerCase() === currency.toLowerCase()){
                return account;
            }
        }
        return this.Error({'err-code': 'account-not-exist', 'err-msg': 'hbg/'+currency+'账户不存在'});
    }

    async getAccountList() {
        const cacheKey = 'MARKETPLACE|ACCOUNT_ID|HBG';
        let accountId = F.cache.get(cacheKey);
        if (!accountId) {
            accountId = await this.getAccountId();
            F.cache.set2(cacheKey, accountId, '1 hour');
        }

        const url = await this.getUri('/v1/account/accounts/'+accountId+'/balance');
        const res = JSON.parse(await request(url));
        if(res.status === 'ok' && res.data && res.data.list){
            let accounts = [];
            for(const item of res.data.list){
                let account = {};

                let hasId = -1;
                for(let i=0;i<accounts.length;i++){
                    if(accounts[i].currency === item.currency){
                        hasId = i;
                        account = accounts[i];
                    }
                }
                account.currency = item.currency;
                if(item.type === 'trade') {
                    account.available = item.balance;
                }
                if(item.type === 'frozen') {
                    account.locked = item.balance;
                }

                if(hasId !== -1) accounts[hasId] = account;
                else accounts.push(new Account(0, account.currency, account.available, account.locked));
            }

            return accounts;
        }

        return this.Error(res);
    }

    // // 单笔 价格*数量 >= 1.00000000
    async orders(side, price, volume, orderId, accountId = 0){
        orderId = guid();
        try{
            const body = {
                'account-id': accountId,
                'symbol': this.market.replace('_', ''),
                'type': side + '-market',
                'amount': volume,
                'source': 'spot-api',
                'client-order-id': orderId
            };

            if(price > 0){
                // 限价交易
                body.type = side + '-limit';
                body.price = price;
            }

            const url = await this.getUri('/v1/order/orders/place', 'POST');
            const res = JSON.parse(await request({
                method: 'POST',
                uri: url,
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify(body)
            }));

            if(res.status === 'ok' && res.data){
                return new Order(res.data, true, res['err-msg'] || '');
            }else{
                return this.Error(res);
            }
        }catch(e){
            return this.Error(e);
        }
    }

    async ordersCancel(orderId) {
        try{
            const url = await this.getUri('/v1/order/orders/'+orderId+'/submitcancel', 'POST');
            const res = JSON.parse(await request({
                method: 'POST',
                uri: url,
                headers: {
                    'content-type': 'application/json'
                },
                body: ''
            }));
            // -1	order was already closed in the long past (order state = canceled, partial-canceled, filled, partial-filled)
            // 5	partial-canceled
            // 6	filled
            // 7	canceled
            // 10	cancelling
            if(res.status === 'ok'){
                switch (parseInt(res['order-state'])) {
                    case 5:
                    case 7:
                    case 10:
                        return new Order(res.data, true, res['err-msg'] || '');
                    case -1:
                    case 6:
                    default:
                        return this.Error({'err-code': 'order-finished-when-cancel', 'err-msg': res['err-msg']});
                }
            }
        }catch(e){
            return this.Error(e);
        }
    }

    async ordersQuery(orderId) {
        try{
            const url = await this.getUri('/v1/order/orders/'+orderId);
            const res = JSON.parse(await request(url));
            if(res.status === 'ok' && res.data && res.data.state) {

                let state = Order.TRADING;

                // submitted 已提交, partial-filled 部分成交, partial-canceled 部分成交撤销, filled 完全成交, canceled 已撤销， created
                switch (res.data.state.toLowerCase()) {
                    case 'submitted':
                    case 'created':
                    default:
                        state = Order.TRADING;
                        break;
                    case 'canceled':
                        state = Order.CANCEL;
                        break;
                    case 'partial-canceled':
                    case 'partial-filled':
                    case 'filled':
                        state = Order.FINISHED;
                        break;
                }

                return new Order(res.data.id, true, state, state, res.data.price, res.data.amount, res.data.price);
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
        switch (e['err-code'] || e.response && e.response.data && e.response.data.code || 1001) {
            case 'base-record-invalid':
            case 'order-orderstate-error':
                code = Error.ERROR_ORDER_ID;    // 订单不存在(重复撤单，订单号不对等)
                break;
            case 'account-get-accounts-inexistent-error':
                code = Error.ACCOUNT_NOT_EXIST;    //  account for type and user id does not exist
                break;
            case 'account-frozen-balance-insufficient-error':
                code = Error.ACCOUNT_NOT_ENOUGH;    // 交易账户余额不足
                break;
            case 'order-finished-when-cancel':
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
            'AccessKeyId='+process.env.HBG_ACCESS_KEY,
            'SignatureMethod=HmacSHA256',
            'SignatureVersion=2',
            'Timestamp=' + (await this.getTimestamp()),
            ...params
        ].sort().join('&');
        const signature = Hbg.getSignature(method+'\napi.huobi.pro\n'+path+'\n'+params);
        return process.env.HBG_ENDPOINT + path + '?' + params + '&Signature='+signature;
    }

    async getTimestamp(){
        const cacheKey = 'MARKETPLACE|TIME_OFFSET|HBG';
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
        const url = process.env.HBG_ENDPOINT + '/v1/common/timestamp';
        const res = JSON.parse(await request(url));
        if(res.status === 'ok'){
            const dt = datetime.create();
            const offset = parseInt(res.data) - parseInt(dt.getTime());
            Log.Info(__filename, 'HBG 系统对时,本地时间:' + dt.format('H:M:S.N') + '远程时间:' + DateFormat(new Date(res.data), 'h:m:s.S') + ' 偏差(ms):' + offset);
            return offset;
        }

        return this.Error(res);
    }

}

exports = module.exports = Hbg;
