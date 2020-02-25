const fs = require('fs');
const dotenv = require('dotenv');
const tf = require('@tensorflow/tfjs');
const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('./definitions/Log');
const { Transpose } = require('./definitions/utils');
const { window, normalization1D, normalization2D, normalization3D, normaliseY } = require('./definitions/tensorUtils');
const Lstm = require('./strategy/Lstm');

require('total.js');
require('tfjs-node-save');

dotenv.config('./env');

const STEP_SIZE = 5;
const STEP_NUM = 24;
const STEP_OFFSET = 1;
const TARGET_SIZE = 12;
const LSTM_UNITS = 30;

const X_LEN = STEP_SIZE + STEP_OFFSET * (STEP_NUM - 1);
const Y_LEN = TARGET_SIZE;

const config = { epochs: 30, batchSize: 4 };

function buildX(data, stepSize, stepNum, stepOffset) {
    let xData = [];
    for (let n = 0; n < stepNum; n += 1) {
        const startIndex = n * stepOffset;
        const endIndex = startIndex + stepSize;
        const item = data.slice(startIndex, endIndex).map(obj => obj.value);
        xData.push(item);
    }
    return xData;
}

function makeTrainData(data, stepSize, stepNum, stepOffset, targetSize) {
    const trainData = { x: [], y: [] };

    const length = data.length;

    const xLength = stepSize + stepOffset * (stepNum - 1);
    const yLength = targetSize;
    const stopIndex = length - xLength - yLength;

    for (let i = 0; i < stopIndex; i += 1) {
        const x = data.slice(i, i + xLength);
        const y = data.slice(i + xLength + 1, i + xLength + 1 + yLength);

        const xData = buildX(x, stepSize, stepNum, stepOffset);
        const yData = y;

        trainData.x.push(xData.map(item => item));
        trainData.y.push(yData.map(item => item.value));
    }
    return trainData;
}

function buildModel() {
    const model = tf.sequential();

    //lstm input layer
    const hidden1 = tf.layers.lstm({
        units: LSTM_UNITS,
        inputShape: [STEP_NUM, STEP_SIZE],
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

    model.add(tf.layers.activation({ activation: "tanh" }));

    //compile
    const rmsprop = tf.train.rmsprop(0.005);
    model.compile({
        optimizer: rmsprop,
        loss: tf.losses.meanSquaredError
    });

    return model;
}

async function predict(model, input) {
    const prediction = await model.predict(tf.tensor([input])).data();
    return prediction;
}

async function trainBatch(data, model) {
    
    // Save the model
    // const saveResults = await model.save('downloads://air-time-model');
    const epochs = config.epochs;
    const results = [];
    const xs = tf.tensor3d(data.x);
    const ys = tf.tensor2d(data.y);

    const history = await model.fit(xs, ys, {
        batchSize: config.batchSize,
        epochs: config.epochs,
        validationSplit: 0.2
    });

    console.log("training complete!");
    return history;
}

const check = async function() {

    // const airPassagnerData = await loadData(
    //     "https://cdn.jsdelivr.net/gh/gangtao/datasets@master/csv/air_passengers.csv"
    // );

    // const chartData = airPassagnerData.map(item => ({
    //     time: item.Date,
    //     value: parseInt(item.Number)
    // }));

    const lstm = new Lstm({
        market: 'etc_usdt',
        marketplace: 'okex',
        granularity: 900
    });
    const { labels, candles } = await lstm.getTrainCandles();


    // Normalize data with value change
    let changeData = [];
    for (let i = 1; i < candles.length; i++) {
        const item = {};
        item.date = labels[i];
        const val = parseFloat(candles[i]);
        const val0 = parseFloat(candles[i - 1]);
        item.value = val / val0 - 1;
        changeData.push(item);
    }

    const trainData = makeTrainData(
        changeData,
        STEP_SIZE,
        STEP_NUM,
        STEP_OFFSET,
        TARGET_SIZE
    );
    const model = buildModel();
    model.summary();
    console.log(11);
    const history = await trainBatch(trainData, model);
    console.log(22);
    const inputStart = changeData.length - X_LEN;
    const inputEnd = changeData.length;
    const input = changeData.slice(inputStart, inputEnd);
    const predictInput = buildX(input, STEP_SIZE, STEP_NUM, STEP_OFFSET);
    const prediction = await predict(model, predictInput);

    // re-constructe predicted value based on change
    const base = airPassagnerData[airPassagnerData.length - 1];
    const baseDate = moment(new Date(base.Date));
    const baseValue = parseInt(base.Number);

    let predictionValue = [];
    let val = baseValue;
    for (let i = 0; i < prediction.length; i += 1) {
        const item = {};
        const date = baseDate.add(1, 'months');
        item.time = moment(date).format('YYYY-MM-DD');
        item.value = val + val * prediction[i];
        item.isPrediction = "Yes";
        predictionValue.push(item);
        val = item.value;
    }

    console.log(predictionValue);
    let airPassagnerDataWithPrediction = [];
    chartData.forEach(item => {
        item.isPrediction = "No";
        airPassagnerDataWithPrediction.push(item);
    })
    predictionValue.forEach(item => {
        airPassagnerDataWithPrediction.push(item);
    })
    

    return;
    // const model = buildModel();
    // model.summary();
    
    // const lstm = Lstm({
    //     market: 'etc_usdt',
    //     marketplace: 'okex',
    //     granularity: 900
    // });
    // const { labels, candles } = await this.getTrainCandles();
    // const changeData = candles;
};

check().then(e=>{});