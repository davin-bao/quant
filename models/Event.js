const fs = require('fs');
const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');
const events = require("events");

require('total.js');
require('tfjs-node-save');

let event = null;

class Event extends events.EventEmitter {
    
    constructor(options = {}) {
        super();
    }
}

Event.CHANNEL_DEPTH5_ADD = 'channel_depth5_add';
Event.CHANNEL_CANDLE_ADD = 'channel_candle_add';
Event.CHANNEL_TRADE_ADD = 'channel_trade_add';

Event.BOT_LOG_ADD = 'subscribe/bot_log';
Event.EXCHANGE_CHANGE = 'exchange_change';
Event.BOT_CHANGE = 'bot_change';
Event.PROFIT_CHANGE = 'profit_change';
Event.TRADE_ACTIVE = 'trade_active';

Event.getInstance = () => {
    if(event === null) {
        event = new Event();
    }
    return event;
}

exports = module.exports = Event;
