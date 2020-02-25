const fs = require('fs');
const dotenv = require('dotenv');
const tf = require('@tensorflow/tfjs');
const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('./definitions/Log');
const { Transpose } = require('./definitions/utils');
const { window, normaliseX, normaliseY, unormaliseY } = require('./definitions/tensorUtils');
const Lstm = require('./strategy/Lstm');

require('total.js');
require('tfjs-node-save');

dotenv.config('./env');

const step = 5;
const targetIndex = 0;

// STEP_SIZE
// 这个是数据窗口的大小，3表示每一个数据包含三个值，数据input维度就是3
// STEP_NUM
// 这个是一共要走多少步，24表示走24步，那个Time维度就是24
// STEP_OFFSET
// 这个offset决定了时间窗口向前移动的时候，每次走多少个时间单位，我这里取1，也就是每次走一步，这样第一个数据和第二个数据其实存在两个重复值。
// TARGET_SIZE
// 这个是我要预测的时间长度，12表示预测12个月的数据。
const STEP_SIZE = 10;
const STEP_NUM = 24;
const STEP_OFFSET = 1;
const TARGET_SIZE = 10;
const LSTM_UNITS = 30;

const TARGET_INDEX = 0;

const check = async function() {
    const lstm = new Lstm({
        market: 'etc_usdt',
        marketplace: 'okex',
        granularity: 180
    });
    const { labels, candles, candleRaws } = await lstm.getTrainCandles();

    const orders = [];
    const volume = 1;
    let accountInit = account = 100;

    for (let i = 0; i < candleRaws.length; i++) {
        const price = candleRaws[i].close;

        // 当今天的收盘价大于过去20个交易日中的最高价时，以收盘价买入；
        if (i > 20) {
            const last20Data = Transpose(candles, [2]).slice(i - 20, i);
            const maxData = Math.max(...last20Data);
            if (candleRaws[i].close > maxData) {
                account = account - volume * price;
                orders.push({ buyTime: candleRaws[i].time, buy: price, amount: volume * price, state: 0 });
            }
        }
        // 买入后，当收盘价小于过去10个交易日中的最低价时，以收盘价卖出。
        if (i > 10) {
            const last10Data = Transpose(candles, [3]).slice(i - 10, i);
            const minData = Math.min(...last10Data);
            
            if (candleRaws[i].close < minData){
                for(let j = 0; j < orders.length; j++){
                    if(orders[j].state === 0){
                        account = account + volume * price;
                        orders[j].sellTime = candleRaws[i].time;
                        orders[j].sell = price;
                        orders[j].profit = orders[j].sell - orders[j].buy;
                        orders[j].state = 1;
                    }
                }
            }
        }
        // 止损, 如果当前订单亏损 0.15， 卖出
        for (let j = 0; j < orders.length; j++) {
            if (orders[j].state === 0 && (price - orders[j].buy)/orders[j].buy < -0.01) {
                account = account + volume * price;
                orders[j].sellTime = candleRaws[i].time;
                orders[j].sell = price;
                orders[j].profit = orders[j].sell - orders[j].buy;
                orders[j].state = 1;
            }
        }
    }

    const profit = account - accountInit;
    const percent = profit * 100 / accountInit;
    console.log('利润：' + profit + ', 收益率:' + percent + '%');
};

check().then(e=>{});