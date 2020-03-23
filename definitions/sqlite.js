const dotenv = require('dotenv');
const Sequelize = require('sequelize');
const Log = require('./Log');
dotenv.config('./env');

const Sqlite = new Sequelize({
    dialect: 'sqlite',
    storage: './cache/cache.db',
    logging: Log.Info
});

exports = module.exports = Sqlite;