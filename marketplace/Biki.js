var querystring = require('querystring');
const crypto = require('crypto');
const Marketplace = require('./Marketplace');
const request = require('../definitions/request');
const Decimal = require('../definitions/decimal');

const Log = require('../definitions/Log');
const Error = require('./response/Error');
const Market = require('./response/Market');
const Depth = require('./response/Depth');
const Account = require('./response/Account');
const Order = require('./response/Order');

class Biki extends Marketplace {

    static getSignature(payload) {
        return crypto.createHmac('SHA256', process.env.AOFEX_SECRET_KEY).update(payload).digest('base64');
    }

    //  Market { id: 'etc_usdt', minAmount: '0.0001', minPrice: 4 }
    async getMarkets() {
        const url = process.env.BIKI_ENDPOINT + '/open/api/common/symbols';
        const res = JSON.parse(await request(url));

        if (parseInt(res.code) === 0) {
            const markets = [];
            for(const {
                base_coin,
                count_coin,
                limit_volume_min,
                price_precision
            } of res.data){
                markets.push(
                    new Market(
                        base_coin.toLowerCase() + '_' + count_coin.toLowerCase(),
                        limit_volume_min,
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

            const url = process.env.BIKI_ENDPOINT + '/open/api/market_dept?type=step0&' + querystring.stringify(params);
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

    getFee(amount) {
        return Decimal(amount).mul(0.19).div(100).toNumber();
    }

    Error(e){
        const message = e.msg || (e.response && e.response.data && e.response.data.message) || e.error_message || e || '通信失败';

        let code = Error.ERROR;
        switch (parseInt(e.code || e.response && e.response.data && e.response.data.code) || 1001) {
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

exports = module.exports = Biki;
