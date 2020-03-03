const fs = require('fs');
const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');

require('total.js');
require('tfjs-node-save');

class Tuning {
    constructor(options = {}) {
        this.candlesData = options.candlesData;
        this.predCache = options.predCache;
        this.targetIndex = options.targetIndex;
        this.testSize = options.testSize;
        this.stepSize = options.stepSize;
        this.targetSize = options.targetSize;

        this.predLabels = [];
        this.actualDatas = [];
        this.predDatas = [];

        this.accountInit = 100;
        this.volume = 1;
        this.orders = [];
        this.account = 100;
        this.profit = 0;
        this.percent = 0;
        this.successCount = 0;
        this.successPercent = 0;

        if (options.modelSettingId) {
            this.modelSettingId = options.modelSettingId;
            const accountCache = this.getAccountCache();
            this.accountInit = accountCache.accountInit;
            this.volume = accountCache.volume;
            this.orders = accountCache.orders;
            this.account = accountCache.account;
            this.profit = accountCache.profit;
            this.percent = accountCache.percent;
            this.successCount = accountCache.successCount;
            this.successPercent = accountCache.successPercent;
            this.predLabels = accountCache.predLabels;
            this.actualDatas = accountCache.actualDatas;
            this.predDatas = accountCache.predDatas;
        }
    }

    async run() {
        const PRED_DIFF = [0.01, 0.03];
        const LOSS_RATIO = [-0.01, -0.05];
        const WIN_RATIO = [1.5, 2, 3, 4, 5];

        let resultMax = { percent: -0.01 };

        for (let i = PRED_DIFF[0]; i < PRED_DIFF[1]; i = Decimal(i).add(0.01).toNumber()) {
            for (let j = LOSS_RATIO[0]; j >= LOSS_RATIO[1]; j = Decimal(j).sub(0.01).toNumber()) {
                for (let k = 0; k < WIN_RATIO.length; k++) {
                    const predDiff = i;
                    const lossRatio = j;
                    const winRatio = Decimal(j).mul(WIN_RATIO[k]).mul(-1).toNumber();
                    
                    this.orders = [];
                    this.account = this.accountInit;

                    let index = 0;
                    while (index < this.candlesData.labels.length) {
                        this.trace(index, predDiff, lossRatio, winRatio);
                        index++;
                    }
                    const lastPrice = this.candlesData.candles[index - 1][this.targetIndex];
                    const successPercent = Decimal(this.successCount).div(index).toNumber();
                    const result = {
                        predDiff,
                        lossRatio,
                        winRatio,
                        successPercent,
                        ...this.getProfit(lastPrice)
                    };

                    console.log(result.profit, result.successPercent, predDiff, lossRatio, winRatio);
                    if (resultMax.percent < result.percent){
                        resultMax = result;
                    }
                    // return;
                }
            }
        }

        return resultMax;
    }

    /**
     * 分步调试
     */
    trace(index, predDiff, lossRatio, winRatio){
        if (index === 0) {
            this.clearAccountCache();
        }

        if (index + this.stepSize - 1 < this.candlesData.labels.length) {

            const res = this.predCache[index];

            if (this.predLabels.length < 1) {
                this.predLabels = res.labels;
                this.actualDatas = res.actualData;
                this.predDatas = res.predData;
            } else if (res.labels.length === 1) {
                this.predLabels = this.predLabels.concat(res.labels);
                this.actualDatas = this.actualDatas.concat(res.actualData);
                this.predDatas = this.predDatas.concat(res.predData);
            } else {
                this.predLabels = this.predLabels.slice(0, this.predLabels.length - 1).concat(res.labels);
                this.actualDatas = this.actualDatas.slice(0, this.actualDatas.length - 1).concat(res.actualData);
                this.predDatas = this.predDatas.slice(0, this.predDatas.length - 1).concat(res.predData);
            }

            const currentTime = this.candlesData.labels[index + this.stepSize - 1];
            const currentPrice = this.candlesData.candles[index + this.stepSize - 1][this.targetIndex];
            const ask = this.candlesData.candles[index + this.stepSize - 1][5];
            const bid = this.candlesData.candles[index + this.stepSize - 1][6];

            switch (parseInt(this.targetSize)) {
                case 1:
                    this.tradeBid(currentTime, currentPrice, ask, bid, lossRatio, winRatio);
                    // this.trade1(index, currentTime, currentPrice, this.predDatas, predDiff, lossRatio, winRatio);
                    break;
                case 2:
                default:
                    this.trade2(index, currentTime, currentPrice, this.predDatas, predDiff, lossRatio, winRatio);
                    break;
            }

            const { profit, percent } = this.getProfit(currentPrice);
            const successPercent = Decimal(this.successCount).div(index).toNumber();
            this.profit = profit;
            this.percent = percent;
            this.successPercent = successPercent; 

            if (this.modelSettingId) {
                this.saveAccountCache();
            }
        }
        
        return {
            predDiff,
            lossRatio,
            winRatio,
            labels: this.predLabels,
            actualData: this.actualDatas,
            predData: this.predDatas,
            profit: this.profit,
            percent: this.percent,
            successPercent: this.successPercent,
            orders: this.orders
        };
    }

    getProfit(currentPrice) {
        let buyVolumes = 0;
        for (let j = 0; j < this.orders.length; j++) {
            // 统计未成交单的价值
            if (this.orders[j].state === 0) {
                buyVolumes += this.volume;
            }
        }

        const profit = Decimal(buyVolumes).mul(currentPrice).add(this.account).sub(this.accountInit).toNumber();
        const percent = Decimal(profit).mul(100).div(this.accountInit).toNumber();

        return { profit, percent };
    }

    tradeBid(currentTime, currentPrice, ask, bid, lossRatio, winRatio) {

        const judge1 = ask > bid;
        // console.log(judge1, judge2, judge3);
        // if (judge1) {
        //     this.successCount++;
        // }
        if (judge1) {
            this.buy(currentTime, currentPrice);
        }

        for (let j = 0; j < this.orders.length; j++) {
            const profit = (currentPrice - this.orders[j].buy) / this.orders[j].buy;
            // 止损/盈利
            if (this.orders[j].state === 0 && (profit < lossRatio || profit > winRatio)) {
                this.sell(this.orders[j], currentTime, currentPrice);
            }
        }
    }

    trade1(predIndex, currentTime, currentPrice, predData, predDiff, lossRatio, winRatio) {

        const judge1 = currentPrice < predData[predIndex];
        const judge2 = predData[predIndex - 1] < predData[predIndex];
        const judge3 = predData[predIndex] - predData[predIndex - 1] > predDiff;
        // console.log(judge1, judge2, judge3);
        if (judge1 && judge2) {
            this.successCount++;
        }
        if (judge3) {
            this.buy(currentTime, currentPrice);
        }

        for (let j = 0; j < this.orders.length; j++) {
            const profit = (currentPrice - this.orders[j].buy) / this.orders[j].buy;
            // 止损/盈利
            if (this.orders[j].state === 0 && (profit < lossRatio || profit > winRatio)) {
                this.sell(this.orders[j], currentTime, currentPrice);
            }
        }
    }

    trade2(predIndex, currentTime, currentPrice, predData, predDiff, lossRatio, winRatio) {

        const judge1 = (predData[predIndex] - currentPrice) / currentPrice > predDiff;
        const judge2 = (predData[predIndex + 1] - currentPrice) / currentPrice > predDiff;
        const judge3 = currentPrice < predData[predIndex - 1];
        const judge4 = predData[predIndex - 1] < predData[predIndex] && predData[predIndex] < predData[predIndex + 1];
        // console.log(judge1, judge2, judge3);
        if (judge1 || judge2 || (judge3 && judge4)) {
            this.buy(currentTime, currentPrice);
        }

        for (let j = 0; j < this.orders.length; j++) {
            const profit = (currentPrice - this.orders[j].buy) / this.orders[j].buy;
            // 止损/盈利
            if (this.orders[j].state === 0 && (profit < lossRatio || profit > winRatio)) {
                this.sell(this.orders[j], currentTime, currentPrice);
            }
        }
    }

    buy(time, price) {
        this.account = this.account - this.volume * price;
        this.orders.push({ 
            buyTime: time, 
            buy: price, 
            amount: this.volume * price, 
            state: 0,
            sellTime: '--',
            sell: '--',
            profit: '--'
         });
        // console.log('buy', time, price);
    }

    sell(order, time, price) {
        if (order.state === 0) {
            this.account = this.account + this.volume * price;
            order.sellTime = time;
            order.sell = price;
            order.profit = order.sell - order.buy;
            order.state = 1;
            // console.log('sell', time, order.buyTime, price + '-' + order.buy + '=' + order.profit);
        }
    }

    getAccountCache(){
        let accountCache = [];
        const cachePath = './tmp/model_trace_' + this.modelSettingId + '.cache';
        if (fs.existsSync(cachePath)) {
            accountCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {
            accountCache = this.saveAccountCache();
        }
        return accountCache;
    }

    clearAccountCache() {
        this.accountInit = 100;
        this.volume = 1;
        this.orders = [];
        this.account = 100;
        this.profit = 0;
        this.percent = 0;
        this.successCount = 0;
        this.successPercent = 0;
        this.predLabels = [];
        this.actualDatas = [];
        this.predDatas = [];
        this.saveAccountCache();
    }

    saveAccountCache() {
        const cachePath = './tmp/model_trace_' + this.modelSettingId + '.cache';
        const accountCache = {
            accountInit: this.accountInit,
            volume: this.volume,
            orders: this.orders,
            account: this.account,
            profit: this.profit,
            percent: this.percent,
            successCount: this.successCount,
            successPercent: this.successPercent,
            predLabels: this.predLabels,
            actualDatas: this.actualDatas,
            predDatas: this.predDatas
        }

        fs.writeFileSync(cachePath, JSON.stringify(accountCache), { encoding: 'utf-8' });
        return accountCache;
    }
}

exports = module.exports = Tuning;
