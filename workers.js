const dotenv = require('dotenv');
const checkSchedule = require('./schedule/check');
const tradeSchedule = require('./schedule/trade');
const querySchedule = require('./schedule/query');
const cancelSchedule = require('./schedule/cancel');
const hedgeQuerySchedule = require('./schedule/hedgeQuery');
const accountStatisticsSchedule = require('./schedule/accountStatistics');

dotenv.config('./env');

checkSchedule();
tradeSchedule();
querySchedule();
cancelSchedule();

hedgeQuerySchedule();
accountStatisticsSchedule();