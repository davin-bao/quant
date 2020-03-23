const schedule = require('node-schedule'); 
const SocketServer = require('../bin/socketServer');
const Depth5 = require('../channels/Depth5');
const Event = require('../models/Event');

const depth5 = new Depth5();

const handle = async () => {
    const server = new SocketServer();
    const event = Event.getInstance();
    //
    event.on('candle60s', attributes => {
        console.log('---------- event on candle60s ' + JSON.stringify(attributes));
        server.send({ channel: 'subscribe/candle60s', data: attributes });
    });
    event.on(Event.EXCHANGE_CHANGE, attributes => {
        console.log('---------- event on ' + Event.EXCHANGE_CHANGE + ' ' + JSON.stringify(attributes));
        server.send({ channel: 'subscribe/exchange', data: attributes });
    });
    event.on(Event.BOT_CHANGE, attributes => {
        console.log('---------- event on ' + Event.BOT_CHANGE + ' ' + JSON.stringify(attributes));
        server.send({ channel: 'subscribe/bot', data: attributes });
    });
    event.on(Event.PROFIT_CHANGE, attributes => {
        console.log('---------- event on ' + Event.PROFIT_CHANGE + ' ' + JSON.stringify(attributes));
        server.send({ channel: 'subscribe/profit', data: attributes });
    });
    event.on(Event.BOT_LOG_ADD, attributes => {
        console.log('---------- event on ' + Event.BOT_LOG_ADD + ' ' + JSON.stringify(attributes), attributes);
        server.send({ channel: 'subscribe/bot_log', data: attributes });
    });
    event.on(Event.TRADE_ACTIVE, attributes => {
        console.log('---------- event on ' + Event.TRADE_ACTIVE);
        server.send({ channel: 'subscribe/trade_active', data: attributes });
    });
};

const SocketWorker = async () => {
    await handle();
};

exports = module.exports = SocketWorker;