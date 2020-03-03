const fs = require('fs');
const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');
const { Transpose } = require('../definitions/utils');
const Lstm = require('../strategy/Lstm');
const Instrument = require('./Instrument');

require('total.js');
require('tfjs-node-save');


const TARGET_INDEX = 0;
const TEST_SIZE = 50;
const STEP_SIZE = 6;

let predLabels = [];
let actualDatas = [];
let predDatas = [];

const accountInit = 100;
const volume = 1;
let orders = [];
let account = 0;

class TrainModel {
    constructor(options = {}) {
        this.market = options.market;
        this.marketplace = options.marketplace;
        this.granularity = parseInt(options.granularity);
        this.stepSize = options.stepSize || STEP_SIZE;
        this.targetIndex = options.targetIndex || TARGET_INDEX;
        this.lstm = new Lstm({
            market: this.market,
            marketplace: this.marketplace,
            granularity: this.granularity,
            stepSize: this.stepSize,
            targetIndex: this.targetIndex
        });
    }

    async train() {
        const { labels, candles } = await this.getInstruments(TEST_SIZE);
        return await this.lstm.train(labels, candles);
    }

    async test(modelName) {
        const PRED_DIFF = [0.01, 0.03];
        const LOSS_RATIO = [-0.01, -0.05];
        const WIN_RATIO = [1.5, 2, 3, 4, 5];

        const candlesData = await this.getInstruments(TEST_SIZE);
        const predCache = await this.predict(modelName, candlesData);
        let resultMax = { percent: 0 };

        for (let i = PRED_DIFF[0]; i < PRED_DIFF[1]; i = Decimal(i).add(0.01).toNumber()) {
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

                        const currentTime = candlesData.labels[index];
                        const currentPrice = candlesData.candles[index][this.targetIndex];
                        this.trade(index + this.stepSize - 1, currentTime, currentPrice, predDatas, predDiff, lossRatio, winRatio);
                        
                        index++;
                    }
                    const lastPrice = candlesData.candles[index-1][this.targetIndex];
                    const result = this.getProfit(lastPrice);
                    console.log(result.profit, predDiff, lossRatio, winRatio);
                    if (resultMax.percent < result.percent){
                        resultMax = result;
                    }
                }
            }
        }

        return resultMax;
    }

    async predict(modelName, candlesData) {
        let predCache = [];
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_' + this.granularity + '_test_' + TEST_SIZE + '_pred_result.cache';
        if (fs.existsSync(cachePath)) {
            predCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {
            let index = 0;
            while (index < candlesData.labels.length) {
                predCache[index] = await this.lstm.predict(modelName, index, candlesData);
                index++;
            }
            fs.writeFileSync(cachePath, JSON.stringify(predCache), { encoding: 'utf-8' });
        }
        return predCache;
    }

    getProfit(currentPrice) {
        let buyVolumes = 0;
        for (let j = 0; j < orders.length; j++) {
            // 统计未成交单的价值
            if (orders[j].state === 0) {
                buyVolumes += volume;
            }
        }

        const profit = Decimal(buyVolumes).mul(currentPrice).add(account).sub(accountInit).toNumber();
        const percent = Decimal(profit).mul(100).div(accountInit).toNumber();

        return { profit, percent };
    }

    trade(index, currentTime, currentPrice, predData, predDiff, lossRatio, winRatio) {
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

    async getInstruments(limit = 200, offset = 0) {
        const result = await Instrument.findAll({
            offset,
            limit,
            order: [
                ['label', 'DESC'],
            ]
        });

        const data = [];
        const labels = [];
        for (const item of result){
            labels.push(item.time);
            data.push([
                item.open, 
                item.close, 
                item.open - item.close,
                item.high - item.low, 
                item.volume,
                item.ask,
                item.bid,
                item.high_diff,
                item.low_diff,
                item.close10,
                item.close20,
                item.close_low10,
                item.close_high20,
            ]);
        }
        
        return { labels, candles: data };
    }
}

exports = module.exports = TrainModel;
