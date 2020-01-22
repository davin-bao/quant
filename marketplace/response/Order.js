
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

exports = module.exports = Order;
