var fs = require('fs');
const Sequelize = require('sequelize');
const Log = require('../definitions/Log');


let sequelize = null;
if(process.env.DATABASE_URL){
    sequelize = new Sequelize(process.env.DATABASE_URL);
}else {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: './data.db',
        logging:Log.Info
    });
}

exports = module.exports = sequelize;