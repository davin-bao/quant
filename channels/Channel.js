const datetime = require('node-datetime');
const Decimal = require('../definitions/decimal');
const CacheDb = require('../definitions/sqlite');
const Sequelize = require('sequelize');

class Channel extends Sequelize.Model {}

exports = module.exports = Channel;
