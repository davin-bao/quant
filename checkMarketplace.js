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


const marketplace = 'gate';

const check = async function() {
    const mp = await MarketplaceManager.get(marketplace, 'etc_usdt');

    // 查询系统时间差异
    // const result = await mp.validateTimestamp();
    // 市场
    // const markets = await mp.getMarkets();
    // console.log(markets);

    // 获取深度
    // const depth = await mp.getDepth(2);
    // console.log(depth);

    // 账户
    // const account = await mp.getAccount('usdt');
    // console.log(account);
    // 交易
    // const order = await mp.orders('sell', '13', 0.1, '1233', 10269865);
    // console.log(order);
    // 取消交易
    // const orderCancel = await mp.ordersCancel('12345');
    // console.log(orderCancel);
    // 查询交易
    //  const query = await mp.ordersQuery('1234556');
    // console.log(query);

};

check().then(e=>{});
