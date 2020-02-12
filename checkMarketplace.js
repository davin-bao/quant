const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const dateTime = require('node-datetime');
const Decimal = require('./definitions/decimal');
const { loop } = require('./definitions/utils');
const MarketplaceManager = require('./marketplace/Manager');
const Setting = require('./models/Setting');

const schedule = require('node-schedule');

dotenv.config('./env');
require('total.js');


const marketplace = 'hbg';

const check = async function() {
    const mp = await MarketplaceManager.get(marketplace, 'etc_usdt');

    // 查询系统时间差异
    // const result = await mp.validateTimestamp();
    // 市场
    // const markets = await mp.getMarkets();
    // 获取深度
    // const depth = await mp.getDepth(5);

    // 账户
    // const account = await mp.getAccount('usdt');
    // 交易
    const order = await mp.orders('sell', '12', 0.01, '1233', 10269865);
    // 查询交易
    //  const query = await mp.ordersQuery('1234556');
    // 取消交易
    //  const query = await mp.ordersCancel('12345');


    console.log(order);

};

const Log = function(filename, msg) {
        const dt = dateTime.create();
        const pwd = process.cwd();
        console.log(msg);
        fs.appendFileSync(pwd+'/logs/check-' + marketplace+ '-' + dt.format('y-m-d') + '.log', msg+"\n");
};

check().then(e=>{});
