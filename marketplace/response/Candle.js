
class Candle {
    constructor(time, open, close, high, low, volume){
        this.time = time;
        this.open = parseFloat(open);       // 开盘价格
        this.close = parseFloat(close);     // 收盘价格
        this.high = parseFloat(high);       // 最高价格
        this.low = parseFloat(low);         // 最低价格
        this.volume = parseFloat(volume);   // 交易量
    }
}

exports = module.exports = Candle;
