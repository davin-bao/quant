const Decimal = require('./decimal');

const digit = 8;
class Indicator {
}

class Ma {
    constructor(period) {
        this.period = period;
        this.candles = [];
    }

    calculate(candles) {
        var mas = [], data = [];
        data = candles;
        const len = this.period + candles.length;
        while (data.length < len) {
            data.unshift(candles[0]);
        }

        this.candles = data.slice(0, this.period - 1);
        for (var i = this.period; i < data.length; i++) {
            const ma = this.next(data[i]);
            mas.push(ma);
        }
        return mas;
    }

    next(candle) {
        this.candles.push(candle);

        const data = this.candles.slice(this.candles.length - this.period);
        let maSum = 0;
        for (var i = 0; i < data.length; i++) {
            maSum += data[i].end;
        }

        return Decimal(maSum).div(this.period).toNumber(digit);
    }
}

class Ema {
    constructor(period) {
        this.period = period;
        this.emas = [];
    }

    calculate(candles) {
        for (var i = 0; i < candles.length; i++) {
            this.next(candles[i]);
        }
        return this.emas;
    }

    next(candle) {
        const lastEma = this.emas.length <= 0 ? candle.end : this.emas[this.emas.length - 1];
        const ema = Decimal(2 * candle.end + (this.period - 1) * lastEma).div(this.period + 1).toNumber(digit);
        this.emas.push(ema);

        return ema;
    }
}

class Macd {
    constructor(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        this.fastPeriod = fastPeriod;
        this.slowPeriod = slowPeriod;
        this.signalPeriod = signalPeriod;

        this.emaFast = new Ema(this.fastPeriod);
        this.emaSlow = new Ema(this.slowPeriod);

        this.deas = [];
        this.macds = [];
    }

    calculate(candles) {
        for (var i = 0; i < candles.length; i++) {
            this.next(candles[i]);
        }
        return this.macds;
    }

    dea(dif) {
        const lastDea = this.deas.length <= 0 ? dif : this.deas[this.deas.length - 1];
        // 前一日DEA×8 / 10 + 今日DIF×2 / 10。
        return Decimal(lastDea * 8 + dif * 2).div(10).toNumber();
    }

    next(candle) {
        const fastEma = this.emaFast.next(candle);
        const slowEma = this.emaSlow.next(candle);
        const dif = Decimal(fastEma).sub(slowEma).toNumber();
        const dea = this.dea(dif);
        // （DIF-DEA）×2即为MACD柱状图
        const bar = Decimal(dif - dea).div(2).toNumber(digit);
        const macd = { dif, dea, bar };
        this.macds.push(macd);

        return macd;
    }
}


Indicator.MA = Ma;
Indicator.EMA = Ema;
Indicator.MACD = Macd;



exports = module.exports = Indicator;