var fs = require('fs');
const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './data.db'
});

exports = module.exports = sequelize;