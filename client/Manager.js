const Okex = require('./Okex');

class Manager {
    //构造函数
    static get(place, market, options) {
        switch (place) {
            case 'okex':
                return new Okex(market, options);
            default:
                throw new Error('不支持的交易平台:' + place);
        }
    }
}

exports = module.exports = Manager;
