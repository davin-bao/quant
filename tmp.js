#!/usr/bin/env node
const dotenv = require('dotenv');
const Sequelize = require('sequelize');
const dateTime = require('node-datetime');
const { Sleep } = require('./definitions/utils');
const Decimal = require('./definitions/decimal');
const Exchange = require('./models/Exchange');
const Event = require('./models/Event');
const Bots = require('./models/Bots');
const Account = require('./models/Account');
const CacheDb = require('./definitions/sqlite');
const Trade = require('./models/Trade');
const Depth5Channel = require('./channels/Depth5');
const TradeChannel = require('./channels/Trade');
const Candle60Channel = require('./channels/Candle60');
const Depth5Strategy = require('./strategy/Depth5');
const SocketWorker = require('./workers/SocketWorker');

dotenv.config('./env');

const Op = Sequelize.Op;

const go = async function () {
    const event = new Event();
    const exchange = await Exchange.findOne({
        where: {
            id: 1,
        }
    });
    await exchange.init(event);
    await exchange.start();

    return;
}

go();

return;