
class Error {
    constructor(e, code = 400){
        const message = (e.response && e.response.data && e.response.data.message) || e.message || e || '通信失败';
        this.message = message;
        this.code = e.response && e.response.data && e.response.data.code || code;
    }
}

Error.ERROR = 1001;                         // 通用异常
Error.ACCOUNT_NOT_ENOUGH = 2000;            // 币币交易账户余额不足
Error.ORDER_FINISHED_WHEN_CANCEL = 3001;    // 撤单时订单已成交
Error.ERROR_ORDER_ID = 90001;               // Error order id | 订单不存在(重复撤单，订单号不对等)
Error.ACCOUNT_NOT_EXIST = 90002;            // account for type and user id does not exist



exports = module.exports = Error;
