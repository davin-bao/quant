const fs = require('fs');
const tf = require('@tensorflow/tfjs');
const MarketplaceManager = require('../marketplace/Manager');
const Log = require('../definitions/Log');
const { Transpose } = require('../definitions/utils');
const { normaliseX, normaliseY, unormaliseY } = require('../definitions/tensorUtils');
require('total.js');
require('tfjs-node-save');

// 测试样本 / 训练样本
const SPLIT_RATIO = 0.2;
// 目标样本列索引
const TARGET_INDEX = 0;
// 窗口尺寸, 预测步数所需的时间长度，必须大于等于 TARGET_SIZE
const STEP_SIZE = 6;
// 这个是我要预测的时间长度，12表示预测12个月的数据
const TARGET_SIZE = 2;
// 样本数 200 的倍数
const TRAIN_COUNT = 200;
// 训练次数
const EPOCHS = 20;
// 均方差阈值
const MSE_LIMIT = 0.0015;

const orders = [];
const volume = 1;
let accountInit = account = 100;
let profitRatio = 0.0000015;

let predLabels = [];
let actualDatas = [];
let predDatas = [];


class Lstm {
    constructor(options = {}) {
        this.market = options.market;
        this.marketplace = options.marketplace;
        this.granularity = parseInt(options.granularity);
        this.modelName = 'lstm_' + this.market + '_' + this.marketplace + '_' + this.granularity;
        this.stepSize = options.stepSize || STEP_SIZE;
    }

    async init() {
        const modelPath = 'model/' + this.modelName + '/model.json';

        if (!fs.existsSync(this.modelPath)) {
            this.model = await tf.loadLayersModel('file://' + modelPath);
        }
    }

    async predict(index = 0, options) {
        let model = this.model;
        const { labels, candles, candleRaws } = options;

        // const { labels, candles, candleRaws } = await this.getTrainCandles(TRAIN_COUNT);
        
        const res = await this.predictCell(model, candles, labels, candleRaws, index);
        
        if (predLabels.length < 1){
            predLabels = res.labels;
            actualDatas = res.actualData;
            predDatas = res.predData;
        } else {
            predLabels = predLabels.slice(0, predLabels.length - 1).concat(res.labels);
            actualDatas = actualDatas.slice(0, actualDatas.length - 1).concat(res.actualData);
            predDatas = predDatas.slice(0, predDatas.length - 1).concat(res.predData);
        }

        // this.trade(index + this.stepSize - 1, candleRaws, predDatas);

        // const { profit, percent } = this.getProfit(index + this.stepSize - 1, candleRaws);

        return {
            labels: predLabels,
            actualData: actualDatas,
            predData: predDatas,
            // profit,
            // percent
        };
    }

    async trainModel(){
        // 数据准备
        const { labels, candles, candleRaws } = await this.getTrainCandles(TRAIN_COUNT);

        // 测试 训练数据分割
        const splitRow = candles.length - parseInt(SPLIT_RATIO * candles.length);
        const testLabels = labels.slice(splitRow, labels.length);
        const trainCandles = candles.slice(0, splitRow);
        const testCandles = candles.slice(splitRow, candles.length);

        const trainData = await this.buildData(trainCandles, TARGET_INDEX, this.stepSize, TARGET_SIZE);
        const trainXTensor = tf.tensor(trainData.x);
        const trainYTensor = tf.tensor(trainData.y);

        const testData = await this.buildData(testCandles, TARGET_INDEX, this.stepSize, TARGET_SIZE);
        const testXTensor = tf.tensor(testData.x);
        const testYTensor = tf.tensor(testData.y);

        let mse = 1;
        let model = null;
        const acts = ['sigmoid'];//, 'softplus'];
        const losses = {
            absoluteDifference: tf.losses.absoluteDifference,
            // hingeLoss: tf.losses.hingeLoss,
            // logLoss: tf.losses.logLoss,
            // sigmoidCrossEntropy: tf.losses.sigmoidCrossEntropy,
            // softmaxCrossEntropy: tf.losses.softmaxCrossEntropy
        };

        // while (mse > MSE_LIMIT) {
            const lossKeys = Object.keys(losses);
            for (let i = 0; i < acts.length; i++) {
                for (let j = 0; j < lossKeys.length; j++) {
                    model = this.buildModel('tanh', tf.losses.meanSquaredError);// acts[i], losses[lossKeys[j]]);
                    const history = await model.fit(trainXTensor, trainYTensor, {
                        batchSize: 32,
                        epochs: EPOCHS
                    });

                    // 评估
                    const predTensor = model.predict(testXTensor);
                    console.log(trainXTensor.shape, trainYTensor.shape, testXTensor.shape, predTensor.shape);

                    mse = await tf.metrics.meanSquaredError(testYTensor.as1D(), predTensor.as1D()).array();
                    console.log(this.stepSize, mse, mse > MSE_LIMIT);
                }
            }
        // }

        await model.save('file://model/' + this.modelName);

        return await this.predictCell(model, testCandles, testLabels, candleRaws, 0);
    }

    async predictCell(model, candles, labels, candleRaws, index){
        if (index + this.stepSize + TARGET_SIZE + 1 >= labels.length) {
            return { labels: [], actualData: [], predData: [] };
        }
        
        const targetCandles = candles.slice(index, index + this.stepSize);

        const targetLabels = labels.slice(index + this.stepSize, index + this.stepSize + TARGET_SIZE);

        const targetX = tf.tensor([await normaliseX(targetCandles)]);
        const targetY = Transpose(targetCandles, [TARGET_INDEX]);

        const predTensor = model.predict(targetX).as1D();

        const actualY = Transpose(candles.slice(index + this.stepSize, index + this.stepSize + TARGET_SIZE), [TARGET_INDEX]);

        const predData = await unormaliseY(targetY, await predTensor.array());

        return { labels: targetLabels, actualData: actualY, predData };
    }

    async getTrainCandles(count = 400) {
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_' + this.granularity + '_' + count + '.cache';
        const candles = await this.getCandles(count, cachePath);

        // 删除 time 列
        const data = [];
        const labels = [];
        candles.forEach(candle => {
            labels.push(candle.time);
            data.push([candle.open, candle.close, candle.high, candle.low, candle.volume]);//, (candle.open - candle.close) / 2, (candle.high - candle.low) / 2, Math.sqrt(Math.pow(candle.open, 2) + Math.pow(candle.close, 2)), Math.sqrt(Math.pow(candle.high, 2) + Math.pow(candle.low, 2))]);
        });

        return { labels, candles: data, candleRaws: candles };
    }

    async getPredCandles(count = 200) {
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_' + this.granularity + '_pred_' + count + '.cache';
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

    async getCandles(count, cachePath){
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

    buildModel(act, loss) {
        const model = tf.sequential();

        //lstm input layer
        const hidden1 = tf.layers.lstm({
            units: 30,
            inputShape: [this.stepSize, 5],
            returnSequences: true
        });
        model.add(hidden1);

        //2nd lstm layer
        const output = tf.layers.lstm({
            units: TARGET_SIZE,
            returnSequences: false
        });
        model.add(output);

        model.add(
            tf.layers.dense({
                units: TARGET_SIZE
            })
        );

        model.add(tf.layers.activation({ activation: act }));

        //compile
        const rmsprop = tf.train.rmsprop(0.005);
        model.compile({
            optimizer: rmsprop,
            loss
        });

        return model;
    }

    async buildData(data, targetIndex, stepSize, targetSize) {
        const dataX = await normaliseX(data);
        const dataY = await normaliseY(Transpose(data, [targetIndex]), stepSize);

        const resData = { x: [], y: [] };
        const length = dataX.length;

        const xLength = stepSize;
        const yLength = targetSize;
        const stopIndex = length - xLength - yLength;

        for (let i = 0; i < stopIndex; i += 1) {
            let x = dataX.slice(i, i + xLength);
            let y = dataY.slice(i + xLength, i + xLength + yLength);

            resData.x.push(x);
            resData.y.push(y);
        }

        return resData;
    }
}

exports = module.exports = Lstm;
