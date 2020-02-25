const fs = require('fs');
const Decimal = require('../definitions/decimal');
const tf = require('@tensorflow/tfjs');
const MarketplaceManager = require('../marketplace/Manager');
const Log = require('../definitions/Log');
const { Transpose } = require('../definitions/utils');
const Lstm = require('./Lstm');

require('total.js');
require('tfjs-node-save');

const TEST_SIZE = 400;
const STEP_SIZE = 6;

let predLabels = [];
let actualDatas = [];
let predDatas = [];

const accountInit = 100;
const volume = 1;
let orders = [];
let account = 0;

class TradeTest {
    constructor(options = {}) {
        this.market = options.market;
        this.marketplace = options.marketplace;
        this.granularity = parseInt(options.granularity);
        this.stepSize = options.stepSize || STEP_SIZE;
        this.lstm = new Lstm({
            market: this.market,
            marketplace: this.marketplace,
            granularity: this.granularity,
            stepSize: this.stepSize
        });
    }

    async do() {
        const PRED_DIFF = [0.01, 0.08];
        const LOSS_RATIO = [-0.01, -0.05];
        const WIN_RATIO = [1.5, 2, 3, 4, 5];

        const candlesData = await this.getTestCandles(TEST_SIZE);
        const predCache = await this.predict(candlesData);

        for (let i = PRED_DIFF[0]; i < PRED_DIFF[1]; i = Decimal(i).add(0.05).toNumber()) {
            for (let j = LOSS_RATIO[0]; j >= LOSS_RATIO[1]; j = Decimal(j).sub(0.01).toNumber()) {
                for (let k = 0; k < WIN_RATIO.length; k++) {
                    const predDiff = i;
                    const lossRatio = j;
                    const winRatio = Decimal(j).mul(WIN_RATIO[k]).mul(-1).toNumber();
                    
                    orders = [];
                    account = accountInit;

                    let index = 0;
                    while (index < candlesData.labels.length) {
                        const res = predCache[index];

                        if (predLabels.length < 1) {
                            predLabels = res.labels;
                            actualDatas = res.actualData;
                            predDatas = res.predData;
                        } else {
                            predLabels = predLabels.slice(0, predLabels.length - 1).concat(res.labels);
                            actualDatas = actualDatas.slice(0, actualDatas.length - 1).concat(res.actualData);
                            predDatas = predDatas.slice(0, predDatas.length - 1).concat(res.predData);
                        }
                        const candleRaw = candlesData.candleRaws[index];
                        this.trade(index + this.stepSize - 1, candleRaw, predDatas, predDiff, lossRatio, winRatio);
                        
                        index++;
                    }
                    const result = this.getProfit(candlesData.candleRaws[index - 1]);
                    console.log(predDiff, lossRatio, winRatio, result.profit, result.percent + '%');
                    // return;
                }
            }
        }
    }

    async predict(candlesData) {
        let predCache = [];
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_' + this.granularity + '_test_' + TEST_SIZE + '_pred_result.cache';
        if (fs.existsSync(cachePath)) {
            predCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {

            await this.lstm.init();
            let index = 0;
            while (index < candlesData.labels.length) {
                predCache[index] = await this.lstm.predict(index, candlesData);
                index++;
            }
            fs.writeFileSync(cachePath, JSON.stringify(predCache), { encoding: 'utf-8' });
        }
        return predCache;
    }

    getProfit(candleRaw) {
        const currentPrice = candleRaw.close;

        let buyVolumes = 0;
        for (let j = 0; j < orders.length; j++) {
            // 统计未成交单的价值
            if (orders[j].state === 0) {
                buyVolumes += volume;
            }
        }

        const profit = account - accountInit + buyVolumes * currentPrice;
        const percent = profit * 100 / accountInit;

        return { profit, percent };
    }

    trade(index, candleRaw, predData, predDiff, lossRatio, winRatio) {
        const currentTime = candleRaw.time;
        const currentPrice = candleRaw.close;
        const predIndex = index - this.stepSize + 1;

        const judge1 = (predData[predIndex + 1] - currentPrice) / currentPrice > predDiff;
        const judge2 = (predData[predIndex + 2] - currentPrice) / currentPrice > predDiff;
        const judge3 = currentPrice < predData[predIndex + 1] && predData[predIndex + 1] < predData[predIndex + 2];
        // console.log(judge1, judge2, judge3);
        if (judge1 || judge2 || judge3) {
            this.buy(currentTime, currentPrice);
        }

        for (let j = 0; j < orders.length; j++) {
            const profit = (currentPrice - orders[j].buy) / orders[j].buy;
            // 止损/盈利
            if (orders[j].state === 0 && (profit < lossRatio || profit > winRatio)) {
                this.sell(orders[j], currentTime, currentPrice);
            }
        }
    }

    buy(time, price) {
        account = account - volume * price;
        orders.push({ buyTime: time, buy: price, amount: volume * price, state: 0 });
        // console.log('buy', time, price);
    }

    sell(order, time, price) {
        if (order.state === 0) {
            account = account + volume * price;
            order.sellTime = time;
            order.sell = price;
            order.profit = order.sell - order.buy;
            order.state = 1;

            // console.log('sell', time, order.buyTime, price + '-' + order.buy + '=' + order.profit);
        }
    }

    async getTestCandles(count = 200) {
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_' + this.granularity + '_test_' + count + '.cache';
        const candles = await this.getCandles(count, cachePath);

        // 删除 time 列
        const data = [];
        const labels = [];
        candles.forEach(candle => {
            labels.push(candle.time);
            data.push([candle.open, candle.close, candle.high, candle.low, candle.volume]);
        });
        
        return { labels, candles: data, candleRaws: candles };
    }

    async getCandles(count, cachePath) {
        let candles = [];
        let times = parseInt(count / 200);

        if (fs.existsSync(cachePath)) {
            candles = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {
            const mp = await MarketplaceManager.get(this.marketplace, this.market);

            let lastTime = null;
            while (times > 0) {
                const firstCandles = await mp.candles(true, this.granularity, lastTime);
                if (firstCandles.length <= 0) break;
                candles = candles.concat(firstCandles);
                lastTime = firstCandles[firstCandles.length - 1].time;
                times--;
            }

            candles = candles.reverse();
            fs.writeFileSync(cachePath, JSON.stringify(candles), { encoding: 'utf-8' });
        }
        candles = candles.slice(0, count);

        return candles;
    }
}

exports = module.exports = TradeTest;
