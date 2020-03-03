const fs = require('fs');
const dotenv = require('dotenv');
const tf = require('@tensorflow/tfjs');
const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Log = require('./definitions/Log');
const { Transpose } = require('./definitions/utils');
const { window, normaliseX, normaliseY, unormaliseY } = require('./definitions/tensorUtils');
const Setting = require('./models/Setting');

require('total.js');
require('tfjs-node-save');

dotenv.config('./env');

const check = async function() {
    const settings = await Setting.findAll({
        where: { enabled: true }
    });

    for(setting of settings){
        const result = await setting.test();
        console.log('SettingID: '+ setting.id + ' 利润：' + result.profit + ', 收益率:' + result.percent + '%', result);
    }
};

check().then(e=>{});