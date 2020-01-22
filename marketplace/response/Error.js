
class Error {
    // 1001 Error Market
    // 33014 | 3001 订单不存在
    // 33026 | 3001 撤单时订单已成交
    constructor(e, code = 400){
        const message = (e.response && e.response.data && e.response.data.message) || e.message || e || '通信失败';
        this.message = message;
        this.code = e.response && e.response.data && e.response.data.code || code;

        switch (this.code) {
            default:
                break;
            case 33014:  // OKEX
                this.code = 3001;
            case 33026:  // OKEX
                this.code = 3001;
        }
    }
}

exports = module.exports = Error;
