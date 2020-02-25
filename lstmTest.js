const fs = require('fs');
const dotenv = require('dotenv');
const tf = require('@tensorflow/tfjs');
const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('./definitions/Log');
const { Transpose } = require('./definitions/utils');
const { window, normaliseX, normaliseY, unormaliseY } = require('./definitions/tensorUtils');
const TradeTest = require('./strategy/TradeTest');

require('total.js');
require('tfjs-node-save');

dotenv.config('./env');

const check = async function() {
    const tradeTest = new TradeTest({
        market: 'etc_usdt',
        marketplace: 'okex',
        granularity: 900
    });

    await tradeTest.do();

    // console.log('利润：' + profit + ', 收益率:' + percent + '%');
};

check().then(e=>{});