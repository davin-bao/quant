const fs = require('fs');
var crypto = require('crypto');
const tf = require('@tensorflow/tfjs');
const MarketplaceManager = require('../marketplace/Manager');
const Log = require('../definitions/Log');
const { guid, Transpose } = require('../definitions/utils');
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
// 输入层隐藏神经元个数
const LSTM_UNITS = 30;
// 批量
const BATCH_SIZE = 32;
// 训练次数
const EPOCHS = 20;
// 均方差阈值
const MSE_LIMIT = 0.0015;

class Lstm {
    constructor(options = {}) {
        this.options = options;
        this.market = options.market;
        this.marketplace = options.marketplace;
        this.granularity = parseInt(options.granularity);
        this.targetIndex = options.targetIndex || TARGET_INDEX;
        this.stepSize = options.stepSize || STEP_SIZE;
        this.targetSize = options.targetSize || TARGET_SIZE;
        this.epochs = options.epochs || EPOCHS;
        this.batchSize = options.batchSize || BATCH_SIZE;
        this.lstmUnits = options.lstmUnits || LSTM_UNITS;
        this.splitRatio = options.splitRatio || SPLIT_RATIO;
    }

    async loadModel(modelName) {
        const modelPath = 'model/' + modelName + '/model.json';
        let model = null;
        if (!fs.existsSync(this.modelPath)) {
            model = await tf.loadLayersModel('file://' + modelPath);
        }
        return model;
    }

    async predict(modelName, index = 0, candlesData) {
        let model = await this.loadModel(modelName);

        const { labels, candles } = candlesData;

        if (index + this.stepSize + this.targetSize + 1 >= labels.length) {
            return { labels: [], actualData: [], predData: [] };
        }

        const targetCandles = candles.slice(index, index + this.stepSize);

        const targetLabels = labels.slice(index + this.stepSize, index + this.stepSize + this.targetSize);

        const targetX = tf.tensor([await normaliseX(targetCandles)]);
        const targetY = Transpose(targetCandles, [this.targetIndex]);

        const predTensor = model.predict(targetX).as1D();

        const actualData = Transpose(candles.slice(index + this.stepSize, index + this.stepSize + this.targetSize), [this.targetIndex]);

        const predData = await unormaliseY(targetY, await predTensor.array());
        
        return {
            labels: targetLabels,
            actualData: actualData,
            predData: predData
        };
    }

    async train(labels, candles){
        // 测试 训练数据分割
        const splitRow = candles.length - parseInt(this.splitRatio * candles.length);
        const testLabels = labels.slice(splitRow, labels.length);
        const trainCandles = candles.slice(0, splitRow);
        const testCandles = candles.slice(splitRow, candles.length);

        const trainData = await this.buildData(trainCandles, this.targetIndex, this.stepSize, this.targetSize);
        const trainXTensor = tf.tensor(trainData.x);
        const trainYTensor = tf.tensor(trainData.y);

        const testData = await this.buildData(testCandles, this.targetIndex, this.stepSize, this.targetSize);
        const testXTensor = tf.tensor(testData.x);
        const testYTensor = tf.tensor(testData.y);

        let mse = 1;
        let model = null;
        const inputShape = [trainXTensor.shape[1], trainXTensor.shape[2]];
        // const acts = ['sigmoid'];//, 'softplus'];
        // const losses = {
        //     absoluteDifference: tf.losses.absoluteDifference
        // };

        // while (mse > MSE_LIMIT) {
        model = this.buildModel('tanh', tf.losses.meanSquaredError, inputShape);
        const history = await model.fit(trainXTensor, trainYTensor, {
            batchSize: this.batchSize,
            epochs: this.epochs
        });

        // 评估
        const predTensor = model.predict(testXTensor);
        // console.log(trainXTensor.shape, trainYTensor.shape, testXTensor.shape, predTensor.shape);

        mse = await tf.metrics.meanSquaredError(testYTensor.as1D(), predTensor.as1D()).array();
        console.log('mse: ' + mse);
        // }

        const modelName = crypto.createHash('md5').update(JSON.stringify(this.options)).digest("hex");

        await model.save('file://model/' + modelName);

        return modelName;
    }

    buildModel(act, loss, inputShape) {
        const model = tf.sequential();

        //lstm input layer
        const hidden1 = tf.layers.lstm({
            units: this.lstmUnits,
            inputShape,
            returnSequences: true
        });
        model.add(hidden1);

        //2nd lstm layer
        const output = tf.layers.lstm({
            units: this.targetSize,
            returnSequences: false
        });
        model.add(output);

        model.add(
            tf.layers.dense({
                units: this.targetSize
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
