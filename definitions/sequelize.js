var fs = require('fs');
const Sequelize = require('sequelize');
const Log = require('../definitions/Log');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './data.db',
    logging:Log.Info
});

exports = module.exports = sequelize;