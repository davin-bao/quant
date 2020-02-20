const fs = require('fs');
const tf = require('@tensorflow/tfjs');
const MarketplaceManager = require('../marketplace/Manager');
const Log = require('../definitions/Log');
const { Transpose } = require('../definitions/utils');
const { window, normaliseX, normaliseY } = require('../definitions/tensorUtils');
require('total.js');
require('tfjs-node-save');

// 窗口尺寸
const step = 20;

class Lstm {
    constructor(options = {}) {
        this.market = options.market;
        this.marketplace = options.marketplace;
        this.granularity = parseInt(options.granularity);
    }

    async predict() {
        const modelPath = 'model/lstm/model.json';
        let model = null;
        
        if (!fs.existsSync(modelPath)){
            await this.trainModel();
            model = await tf.loadLayersModel('file://' + modelPath);
        } else {
            model = await tf.loadLayersModel('file://' + modelPath);
        }

        const { labels, candles } = await this.getPredCandles();
        const taretCandles = candles.slice(-step);

        const testXTensor = await normaliseX(tf.tensor([taretCandles]));
        
        const targetData = Transpose(taretCandles, [2]);
        const targetTensor = tf.tensor(targetData);
        targetTensor.print();
    
        let predTensor = model.predict(testXTensor).as1D();

        predTensor = await predTensor.add(tf.scalar(1));
        predTensor = await predTensor.mul(targetTensor);
        predTensor.print();
    }

    async trainModel(){
        // 数据准备
        const { labels, candles } = await this.getTrainCandles();

        // 测试 训练数据分割
        const splitRow = candles.length - parseInt(0.2 * candles.length);
        const testLabels = labels.slice(splitRow, labels.length);
        const trainCandles = candles.slice(0, splitRow);
        const testCandles = candles.slice(splitRow, candles.length);
        const trainXTensor = await normaliseX(await window(tf.tensor(trainCandles), step));
        const testXTensor = await normaliseX(await window(tf.tensor(testCandles), step));

        const trainYTensor = await normaliseY(tf.tensor(Transpose(trainCandles, [2])), step);
        const testYTensor = await normaliseY(tf.tensor(Transpose(testCandles, [2])), step);

        // console.log(trainXTensor.shape, trainYTensor.shape, testXTensor.shape, testYTensor.shape);

        const model = tf.sequential();
        
        const lstm = tf.layers.lstm({
            units: 1,
            activation: 'linear',
            dropout: 0.2,
            inputShape: [step, 5],
            returnSequences: false
        });
        model.add(lstm);

        model.compile({
            optimizer: 'adam',
            loss: 'meanSquaredError'
        });

        let mse = 1;
        let predTensor = null;
        while(mse > 0.0005){
            console.log(mse, mse > 0.0005);
            const history = await model.fit(trainXTensor, trainYTensor, {
                batchSize: 32,
                epochs: 50
            });

            const targetData = Transpose(testCandles, [1]).slice(step);
            const targetTensor = tf.tensor(targetData);
            predTensor = model.predict(testXTensor).as1D();
            // 评估
            mse = await tf.metrics.meanSquaredError(testYTensor, predTensor).array();
            console.log(mse);

            predTensor = predTensor.add(tf.scalar(1));
            predTensor = predTensor.mul(targetTensor);
        }

        await model.save('file://model/lstm');

        return { labels: testLabels.slice(step), testData: Transpose(testCandles, [1]).slice(step), predData: await predTensor.array() };
    }

    async getTrainCandles() {
        let candles = [];
        let times = 5;
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_' + this.granularity + '.cache';
        if (fs.existsSync(cachePath)) {
            candles = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {
            const mp = await MarketplaceManager.get(this.marketplace, this.market);

            let lastTime = null;
            while (times > 0) {
                const firstCandles = await mp.candles(true, this.granularity, lastTime);
                candles = candles.concat(firstCandles);
                lastTime = firstCandles[firstCandles.length - 1][0];
                times--;
            }
            
            candles = candles.reverse();
            fs.writeFileSync(cachePath, JSON.stringify(candles), { encoding: 'utf-8' });
        }
        // 删除 time 列
        const data = [];
        const labels = [];
        candles.forEach(candle => {
            labels.push(candle.time);
            data.push([candle.open, candle.close, candle.high, candle.low, candle.volume]);
        });

        return { labels, candles: data };
    }

    async getPredCandles() {
        let candles = false;
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_' + this.granularity + '_pred.cache';
        if (fs.existsSync(cachePath)) {
            candles = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {
            const mp = await MarketplaceManager.get(this.marketplace, this.market);
            const firstCandles = await mp.candles(true, this.granularity);
            candles = firstCandles.reverse();
            fs.writeFileSync(cachePath, JSON.stringify(candles), { encoding: 'utf-8' });
        }
        // 删除 time 列
        const data = [];
        const labels = [];
        candles.forEach(candle => {
            labels.push(candle.time);
            data.push([candle.open, candle.close, candle.high, candle.low, candle.volume]);
        });

        return { labels, candles: data };
    }
}

exports = module.exports = Lstm;
