#!/usr/bin/env node
'use strict';

const models = [
    'Account',
    'AccountLog',
    'AccountStatistics',
    'Hedge',
    'Order',
    'Setting'
];

for(let model of models){
    require('../models/' + model).sequelize.sync().done(() => {
        console.log('sync db done and waiting for 1 minitue to exit,Or CTRL+C to exit.');
    }, (err) => {
        console.log(err);
    });
}

