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

checkSchedule();
tradeSchedule();
querySchedule();
cancelSchedule();

hedgeQuerySchedule();
accountStatisticsSchedule();