#!/usr/bin/env node
'use strict';

const models = [
    'Account',
    'BotLog',
    'Bots',
    'Exchange',
    'Order',
    'Profits',
    'Rasks',
    'Trade'
];

for(let model of models){
    const instance = require('../models/' + model);
    instance.sequelize.sync().done(() => {
        instance.findAll({}).then(ins => {
            if (ins.length <= 0) {
                instance.initExample();
            }
        });
        console.log('sync models done and waiting for 1 minitue to exit,Or CTRL+C to exit.');
    }, (err) => {
        console.log(err);
    });
}

const channels = [
    'Candle60'
];

for (let model of channels) {
    const instance = require('../channels/' + model);
    instance.sequelize.sync().done(() => {
        console.log('sync channels done and waiting for 1 minitue to exit,Or CTRL+C to exit.');
    }, (err) => {
        console.log(err);
    });
}