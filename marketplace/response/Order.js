
class Order {
    constructor(order_id, result, error_message, state = 'trading', avg_price = 0, executed_volume = 0, price = 0, code = 200){
        this.code = code;
        this.order_id = order_id;
        this.result = result;
        this.error_message = error_message;
        this.state = state;
        this.avg_price = avg_price;
        this.executed_volume = executed_volume;   //已成交量
        this.price = price;                       //成交价
    }
}

Order.WAITING = 'waiting';      // 等待发起交易
Order.TRADING = 'trading';      // 交易中
Order.CANCEL = 'cancel';        // 交易取消
Order.FINISHED = 'finished';    // 交易完成

exports = module.exports = Order;
