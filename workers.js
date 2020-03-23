const dotenv = require('dotenv');
const Sequelize = require('sequelize');
const Decimal = require('./definitions/decimal');
const Event = require('./models/Event');
const ExchangeWorker = require('./workers/ExchangeWorker');
const BotWorker = require('./workers/BotWorker');
const SocketWorker = require('./workers/SocketWorker');

const BotLog = require('./models/BotLog');
const Profits = require('./models/Profits');

dotenv.config('./env');
require('total.js');

ExchangeWorker();
BotWorker();
SocketWorker();

