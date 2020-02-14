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
/**
 * 太多小单
 */
class Fatbtc extends Marketplace {

    static getSignature(payload) {
        return crypto.createHmac('SHA256', process.env.FATBTC_SECRET_KEY).update(payload).digest('base64');
    }

    async getMarkets() {
        // {"symbol":"ETCUSDT","price_precision":4,"volume_precision":2,"taker_fee":0.00200000,"maker_fee":0.00200000}
        const url = process.env.FATBTC_ENDPOINT + '/m/symbols/1/' + datetime.create().getTime();
        const res = JSON.parse(await request(url));

        if (parseInt(res.status) === 1) {
            const markets = [];
            for (const {
                base_currency,
                quote_currency,
                volume_precision,
                price_precision
            } of res.symbols) {
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

    async getDepth(size) {
        try {

            const url = process.env.FATBTC_ENDPOINT + '/m/depth/' + this.market.replace('_', '').toUpperCase();
            const res = JSON.parse(await request({ method: 'GET', uri: url }));
            if (parseInt(res.status) === 1) {
                return new Depth(size, res.asks, res.bids, res.timestamp);
            } else {
                return this.Error(res);
            }
        } catch (e) {
            return this.Error(e);
        }
    }

    getFee(amount) {
        return Decimal(amount).mul(0.2).div(100).toNumber();
    }

    Error(e){
        const message = e.msg || (e.response && e.response.data && e.response.data.message) || e.error_message || e || '通信失败';

        let code = Error.ERROR;
        switch (parseInt(e.status || e.response && e.response.data && e.response.data.code) || 1001) {
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

exports = module.exports = Fatbtc;
