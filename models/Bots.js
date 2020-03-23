const Sequelize = require('sequelize');
const schedule = require('node-schedule');
const Decimal = require('../definitions/decimal');
const sequelize = require('../definitions/sequelize');
const Manager = require('../client/Manager');
const Model = require('./Model');
const Exchange = require('./Exchange');
const Event = require('./Event');
const BotLog = require('./BotLog');
const Profits = require('./Profits');
const Account = require('./Account');

class Bots extends Model {
    async init() {
        this.event = Event.getInstance();
        this.options = {
            exchange_id: this.exchange_id,
            ...JSON.parse(this.parameters),
            simulate: this.simulate,
            bot: this
        };

        this.exchange = await Exchange.findByPk(this.exchange_id);
        const Strategy = require('../strategy/' + this.strategy);
        this.strategyInstance = new Strategy(this.options);
        await this.strategyInstance.init();

        return this;
    }

    async getExchange() {
        if (!this.exchange){
            this.exchange = await Exchange.findByPk(this.exchange_id);
            if (!this.exchange) throw Error('Bot ID:' + this.id + '配置的 exchange_id:' + this.exchange_id + '记录不存在');
        }
        
        return this.exchange;
    }

    async reset() {
        const exchange = await this.getExchange();
        const currency = exchange.market.split('_')[1];
        const account = await Account.findOne({
            where: {
                exchange: exchange.exchange,
                currency
            }
        });
        if (!account) throw Error('Bot ID:' + this.id + '配置的 exchange_id:' + this.exchange_id + '(' + currency + ')的 account 记录不存在');

        await sequelize.transaction(async t => {
            await this.update({
                balance: account.balance,
                begin_at: new Date().getTime()
            }, { transaction: t });

            await BotLog.destroy({
                where: {
                    bot_id: this.id
                }
            }, { transaction: t });

            await Profits.destroy({
                where: {
                    bot_id: this.id
                }
            }, { transaction: t });

            await Profits.add({
                bot_id: this.id,
                currency,
                profit: 0,
                ctime: new Date()
            }, { transaction: t });

            await BotLog.create({
                bot_id: this.id,
                type: BotLog.TYPE_TRADE,
                memo: '初始账户: ' + account.balance,
                ctime: new Date()
            }, { transaction: t });
        });
    }

    async start() {
        const self = this;
        await self.update({ 
            state: Bots.RUNNING,
        });
        self.event.emit(Event.BOT_CHANGE, { id: this.id, state: Bots.RUNNING });

        self.event.on(Event.CHANNEL_CANDLE_ADD, async (attributes) => {
            await self.strategyInstance.tick(attributes);
        });
    }
    
    async stop() {
        await this.update({
            state: Bots.STOPED,
            end_at: new Date().getTime()
        });
        this.event.emit(Event.BOT_CHANGE, { id: this.id, state: Bots.STOPED });

        this.event.removeAllListeners([Event.CHANNEL_CANDLE_ADD]);
        this.strategyInstance && this.strategyInstance.stop();
    }

    async log(type, memo, options={}) {
        await BotLog.create({
            bot_id: this.id,
            type,
            memo,
            ctime: new Date()
        }, options);
    }
}

Bots.init({
    exchange_id: { type: Sequelize.INTEGER, comment: '交易所ID', defaultValue: 0 },
    strategy: { type: Sequelize.STRING(30), comment: '策略' },
    parameters: { type: Sequelize.TEXT, comment: '参数', defaultValue: '{}' },
    state: { type: Sequelize.STRING(30), comment: '状态', defaultValue: 'stoped' },
    enabled: { type: Sequelize.BOOLEAN, comment: '启用', defaultValue: false },
    simulate: { type: Sequelize.BOOLEAN, comment: '模拟', defaultValue: false },
    balance: { type: Sequelize.DECIMAL(20, 8), comment: '初始余额', defaultValue: 0 },
    begin_at: { type: Sequelize.DATE, comment: '开始时间' },
    end_at: { type: Sequelize.DATE, comment: '结束时间' },
}, {
    sequelize,
    tableName: 'bots',
    timestamps: false,
});

Bots.RUNNING = 'running'; 
Bots.STOPED = 'stoped';

Bots.initExample = () => {
    Bots.create({
        exchange_id: 1,
        strategy: 'Depth5',
        parameters: JSON.stringify({})
    });
};

exports = module.exports = Bots;