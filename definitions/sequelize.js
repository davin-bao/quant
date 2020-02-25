var fs = require('fs');
const dotenv = require('dotenv');
const Sequelize = require('sequelize');
const Log = require('../definitions/Log');
dotenv.config('./env');

let sequelize = null;
if (!process.env.DIALECT || process.env.DIALECT === 'sqlite') {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: './data.db',
        logging: Log.Info
    });
} else {
    sequelize = new Sequelize(process.env.MYSQL_DB, process.env.MYSQL_USER, process.env.MYSQL_PASS, {
        host: process.env.MYSQL_HOST,    //数据库地址,默认本机
        port: process.env.MYSQL_PORT,
        dialect: process.env.DIALECT,
        pool: {   //连接池设置
            max: 5, //最大连接数
            min: 0, //最小连接数
            idle: 10000
        },
    });
}

exports = module.exports = sequelize;