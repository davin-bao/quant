const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const Event = require('./Event');

class BotLog extends Model {}

BotLog.init({
    bot_id: { type: Sequelize.INTEGER, comment: 'Bot Id' },
    type: { type: Sequelize.STRING, comment: '类型', defaultValue: 'other' },
    memo: { type: Sequelize.TEXT, comment: '内容' },
    ctime: Sequelize.DATE,
}, {
    hooks: {
        afterCreate: (instance, options) => {
            const event = Event.getInstance();

            event.emit(Event.BOT_LOG_ADD, { 
                id: instance.bot_id, 
                rowData: [instance.id, instance.type, instance.memo, instance.ctime]
            });
        }
    },
    sequelize,
    tableName: 'bot_log',
    timestamps: false,
});

BotLog.TYPE_RASK = 'rasks';
BotLog.TYPE_STRATEGY = 'strategy';
BotLog.TYPE_AUOTATION = 'auotation';
BotLog.TYPE_TRADE = 'trade';
BotLog.OTHER = 'other';

BotLog.initExample = () => {
    //
};

exports = module.exports = BotLog;