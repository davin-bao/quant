const dotenv = require('dotenv');
const Decimal = require('./definitions/decimal');
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

// console.log(Decimal('1203.02').sub('1203.12').toNumber());
// console.log(Decimal(11.903).sub(11.9117).toNumber(), 11.903 - 11.9117);
// return;
//dt | zb Buy:11.8866 okex Sell:11.885 fee:0.00007000000000000001 | profit:-0.00010799999999999577
// 'market:'+this.market+' | ' + this.marketplaceB + ' Buy:'+bBuyPrice+' ' + this.marketplaceA + ' Sell:'+aSellPrice+' fee:'+ (aSellFee + bBuyFee) +' | profit:' + ((bBuyPrice * volume - aSellPrice * volume - aSellFee*2 - bBuyFee*2)));

// const bBuyPrice = '11.8866';
// const aSellPrice = '11.885';
// const volume = '0.02';
// const aSellFee = volume * '0.15'/100;
// const bBuyFee = volume * 0.20/100;
// console.log((bBuyPrice * volume - aSellPrice * volume - aSellFee * 2 - bBuyFee * 2));
// return;
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
tradeSchedule();
querySchedule();
cancelSchedule();
//
hedgeQuerySchedule();
accountStatisticsSchedule();