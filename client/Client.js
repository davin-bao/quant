const events = require("events");

// 定义类
class Client extends events.EventEmitter {
    //构造函数
    constructor(market, options) {
        super();
        this.market = market;
        this.options = {
            depthSize: 10,
            ...options
        };
    }
}

Client.ORDER_STATE_WAITING = 'waiting';      // 等待发起交易
Client.ORDER_STATE_PARTIAL = 'partial';      // 部分成交
Client.ORDER_STATE_FILLED = 'filled';        // 完全交易
Client.ORDER_STATE_CANCELLING = 'cancelling';        // 交易取消
Client.ORDER_STATE_CANCEL_SUCCESS = 'cancel_success'; //交易取消成功
Client.ORDER_STATE_FAILED = 'failed';        // 完全交易


// Client.ORDER_STATE_TRADING = 'trading';      // 交易中
// Client.ORDER_STATE_NEED_TRADE = 'need_trade'; //委托失败，可重试

exports = module.exports = Client;
