const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const dateTime = require('node-datetime');
const Model = require('./Model');
const BotLog = require('./BotLog');
const Order = require('./Order');

class Rasks extends Model {
    setBot(bot) {
        this.bot = bot;
    }

    async getExchange() {
        const exchange = await Exchange.findByPk(this.exchange_id);
        if (!exchange) throw Error('Rask ID:' + this.id + '配置的 exchange_id:' + this.exchange_id + '记录不存在');
        return exchange;
    }

    async canBuy(price, quantity) {
        if(!this.enabled) return true;
        const exchange = await this.getExchange();

        if(quantity > this.limit_volume){
            this.bot.log(BotLog.TYPE_RASK, '风控：单笔委托上限');
            return false;
        }
        const { orderBuyCount } = await Order.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'orderBuyCount']],
            where: {
                state: Order.STATE_WAITING,
                bot_id: this.bot.id,
                created_at: {
                    [Op.gte]: dateTime.create(new Date().getTime() + this.limit_clear)
                }
            },
        });
        if (orderBuyCount >= this.limit_count) {
            this.bot.log(BotLog.TYPE_RASK, '风控：委托流控上限');
            return false;
        }

        const { orderTotalCount } = await Order.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'orderTotalCount']],
            where: {
                bot_id: this.bot.id,
                state: {
                    [Op.in]: [Order.STATE_FILLED]
                },
                created_at: {
                    [Op.gte]: this.bot.begin_at
                }
            }
        });
        if (orderTotalCount >= this.total_count) {
            this.bot.log(BotLog.TYPE_RASK, '风控：总成交上限');
            return false;
        }

        const { orderActiveCount } = await Order.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'orderActiveCount']],
            where: {
                bot_id: this.bot.id,
                state: {
                    [Op.in]: [Order.STATE_WAITING, Order.STATE_PARTIAL]
                },
                created_at: {
                    [Op.gte]: this.bot.begin_at
                }
            }
        });
        if (orderActiveCount >= this.active_count) {
            this.bot.log(BotLog.TYPE_RASK, '风控：活动委托上限');
            return false;
        }

        return true;
    }
    canSell() {
        return true;
    }
    async canCancel() {
        if (!this.enabled) return true;

        const { orderCancelCount } = await Order.findOne({
            raw: true,
            attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'orderCancelCount']],
            where: {
                bot_id: this.bot.id,
                state: {
                    [Op.in]: [Order.STATE_CANCELLING, Order.STATE_CANCEL_SUCCESS]
                },
                created_at: {
                    [Op.gte]: this.bot.begin_at
                }
            }
        });
        if (orderCancelCount >= this.cancel_count) {
            this.bot.log(BotLog.TYPE_RASK, '风控：合约撤单上限');
            return false;
        }
        return true;
    }
}

Rasks.init({
    exchange_id: { type: Sequelize.INTEGER, comment: '交易所ID', defaultValue: 0 },
    limit_count: { type: Sequelize.INTEGER(11), comment: '委托流控上限(笔)', defaultValue: 1 },
    limit_clear: { type: Sequelize.INTEGER(11), comment: '委托流控清空(s)', defaultValue: 1 },
    limit_volume: { type: Sequelize.DECIMAL(20, 8), comment: '单笔委托上限(量)', defaultValue: 0.01 },
    total_count: { type: Sequelize.INTEGER(11), comment: '总成交上限(笔)', defaultValue: 1000 },
    active_count: { type: Sequelize.INTEGER(11), comment: '活动委托上限(笔)', defaultValue: 50 },
    cancel_count: { type: Sequelize.INTEGER(11), comment: '合约撤单上限(笔)', defaultValue: 500 },
    enabled: { type: Sequelize.BOOLEAN, comment: '启用', defaultValue: false },
}, {
    sequelize,
    tableName: 'rasks',
    timestamps: false,
});

Rasks.initExample = () => {
    Rasks.create({
        exchange_id: 1,
        limit_count: 1,
        limit_clear: 1,
        limit_volume: 0.01,
        total_count: 1000,
        active_count: 50,
        cancel_count: 500
    });
};

exports = module.exports = Rasks;