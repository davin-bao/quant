const dotenv = require('dotenv');
const Decimal = require('decimal');
const checkSchedule = require('./schedule/check');
const tradeSchedule = require('./schedule/trade');
const querySchedule = require('./schedule/query');
const cancelSchedule = require('./schedule/cancel');
const hedgeQuerySchedule = require('./schedule/hedgeQuery');
const accountStatisticsSchedule = require('./schedule/accountStatistics');

const Sequelize = require('sequelize');
const sequelize = require('./definitions/sequelize');
const Log = require('./definitions/Log');

const Op = Sequelize.Op;
const Order = require('./models/Order');

dotenv.config('./env');

// const market = 'etc_usdt';
// const currencies = market.split('_').trim();
// Order.balance({
//     marketplace: 'okex',
//     market: 'etc_usdt',
//     side: 'sell',
//     currencies,
// }).then(e=>{
//     console.log('fff',e);
// });

checkSchedule();
querySchedule();
cancelSchedule();
//
hedgeQuerySchedule();
accountStatisticsSchedule();