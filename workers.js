const dotenv = require('dotenv');
const Sequelize = require('sequelize');
const Decimal = require('./definitions/decimal');
const instrumentSchedule = require('./schedule/instrument');

dotenv.config('./env');

instrumentSchedule();