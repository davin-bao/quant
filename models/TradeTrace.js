const fs = require('fs');
const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');

require('total.js');
require('tfjs-node-save');

const PARAMETERS = {
    interval: 60,        // 窗口尺寸
    testSize: 50,       // 测试数据量
    percent: 0.0,        // 测试利率阈值
    targetSize: 1,      // 这个是我要预测的时间长度，12表示预测12个月的数据
    epochs: 20,         // 训练次数
    batchSize: 32,      // 训练批量
    lstmUnits: 30,      // 输入层隐藏神经元个数
    splitRatio: 0.2,    // 测试样本 / 训练样本
};

class TradeTrace {
    constructor(options = {}) {
        this.candlesData = options.candlesData;
        this.predCache = options.predCache;
        this.targetIndex = options.targetIndex;
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

        if (options.modelSettingId){
            this.modelSettingId = options.modelSettingId;
            const accountCache = this.getAccountCache();
            this.accountInit = accountCache.accountInit;
            this.volume = accountCache.volume;
            this.orders = accountCache.orders;
            this.account = accountCache.account;
            this.profit = accountCache.profit;
            this.percent = accountCache.percent;
        }

        console.log(this.candlesData.candles[0]);
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
                    const lastPrice = this.candlesData.candles[index-1][this.targetIndex];
                    const result = {
                        predDiff,
                        lossRatio,
                        winRatio,
                        ...this.getProfit(lastPrice)
                    };

                    console.log(result.profit, predDiff, lossRatio, winRatio);
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

            console.log(11, this.predLabels.length, res.labels.length);

            if (this.predLabels.length < 1) {
                this.predLabels = res.labels;
                this.actualDatas = res.actualData;
                this.predDatas = res.predData;
            } else if (res.labels.length === 1) {
                this.predLabels = this.predLabels.concat(res.labels);
                this.actualDatas = this.actualDatas.concat(res.actualData);
                this.predDatas = this.predDatas.concat(res.predData);
                console.log(11,this.predLabels.length);
            } else {
                this.predLabels = this.predLabels.slice(0, this.predLabels.length - 1).concat(res.labels);
                this.actualDatas = this.actualDatas.slice(0, this.actualDatas.length - 1).concat(res.actualData);
                this.predDatas = this.predDatas.slice(0, this.predDatas.length - 1).concat(res.predData);
            }
            console.log(222, this.predLabels.length);

            const currentTime = this.candlesData.labels[index + this.stepSize - 1];
            const currentPrice = this.candlesData.candles[index + this.stepSize - 1][this.targetIndex];

            switch (parseInt(this.targetSize)) {
                case 1:
                    this.trade1(index, currentTime, currentPrice, this.predDatas, predDiff, lossRatio, winRatio);
                    break;
                case 2:
                default:
                    this.trade2(index, currentTime, currentPrice, this.predDatas, predDiff, lossRatio, winRatio);
                    break;
            }

            const { profit, percent } = this.getProfit(currentPrice);
            this.profit = profit;
            this.percent = percent;

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

    trade1(predIndex, currentTime, currentPrice, predData, predDiff, lossRatio, winRatio) {

        const judge1 = (predData[predIndex] - currentPrice) / currentPrice > predDiff;
        const judge2 = (predData[predIndex + 1] - currentPrice) / currentPrice > predDiff;
        const judge3 = currentPrice < predData[predIndex - 1];
        const judge4 = predData[predIndex - 1] < predData[predIndex];
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
            percent: this.percent
        }

        fs.writeFileSync(cachePath, JSON.stringify(accountCache), { encoding: 'utf-8' });
        return accountCache;
    }
}

exports = module.exports = TradeTrace;
