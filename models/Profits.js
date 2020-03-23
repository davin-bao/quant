const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Decimal = require('../definitions/decimal');
const Model = require('./Model');
const Event = require('./Event');

class Profits extends Model {}

Profits.init({
    bot_id: { type: Sequelize.INTEGER, comment: 'Bot Id' },
    currency: { type: Sequelize.STRING(30), comment: '货币' },
    balance: { type: Sequelize.DECIMAL(20, 8), comment: '累计收益', defaultValue: 0 },
    profit: { type: Sequelize.DECIMAL(20, 8), comment: '收益', defaultValue: 0 },
    ctime: Sequelize.DATE,
}, {
    hooks: {
        afterCreate: (instance, options) => {
            const event = Event.getInstance(); 

            event.emit(Event.PROFIT_CHANGE, {
                id: instance.bot_id,
                legend: instance.currency,
                value: instance.balance,
                xAxis: instance.ctime,
            });
        }
    },
    sequelize,
    tableName: 'profits',
    timestamps: false,
});

Profits.add = async (attributes, options = {}) => {
    const lastProfit = await Profits.findOne({
        where: { bot_id: attributes.bot_id },
        order: [['id', 'DESC']]
    });

    attributes.balance = attributes.profit;
    if (lastProfit) attributes.balance = Decimal(lastProfit.balance).add(attributes.profit).toNumber();

    await Profits.create(attributes, options);
};

exports = module.exports = Profits;