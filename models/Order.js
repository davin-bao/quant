const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class Order extends Model { }

Order.init({
    bot_id: { type: Sequelize.INTEGER, comment: 'BOT ID', defaultValue: 0 },
    trade_id: { type: Sequelize.INTEGER, comment: '交易ID', defaultValue: 0 },
    order_id: { type: Sequelize.STRING(100), comment: '上游订单ID', defaultValue: 0 },        // 订单ID
    market: { type: Sequelize.STRING(30), comment: '货币对' },
    price: { type: Sequelize.DECIMAL(20, 8), comment: '委托价格', defaultValue: 0 },              // 委托价格
    quantity: { type: Sequelize.DECIMAL(20, 8), comment: '委托数量（交易货币数量）', defaultValue: 0 }, 
    notional: { type: Sequelize.DECIMAL(20, 8), comment: '买入金额，市价买入时返回', defaultValue: 0 },        // 买入金额，市价买入时返回
    side: { type: Sequelize.STRING(10), comment: 'buy 或 sell', defaultValue: 'buy' },                // buy 或 sell
    filled_notional: { type: Sequelize.DECIMAL(20, 8), comment: '已成交金额', defaultValue: 0 },  // 已成交金额
    filled_quantity: { type: Sequelize.DECIMAL(20, 8), comment: '已成交数量', defaultValue: 0 },  // 已成交数量
    filled_fee: { type: Sequelize.DECIMAL(20, 8), comment: '已成交交易费用', defaultValue: 0 }, 
    last_fill_px: { type: Sequelize.DECIMAL(20, 8), comment: '最新成交价格（如果没有，推0）', defaultValue: 0 },        // 最新成交价格（如果没有，推0）
    last_fill_qty: { type: Sequelize.DECIMAL(20, 8), comment: '最新成交数量（如果没有，推0）', defaultValue: 0 },      // 最新成交数量（如果没有，推0）
    last_fill_time: { type: Sequelize.DATE, comment: '最新成交时间（如果没有，推1970-01-01T00:00:00.000Z）' },    // 最新成交时间（如果没有，推1970-01-01T00:00:00.000Z）
    margin_trading: { type: Sequelize.STRING(10), comment: '币币/杠杆交易', defaultValue: 'spot' },
    order_type: { type: Sequelize.STRING(10), comment: '订单类型', defaultValue: 'maker' },
    state: { type: Sequelize.STRING(20), comment: '状态', defaultValue: 'waiting' },
    timestamp: { type: Sequelize.DATE, comment: '订单状态更新时间' }, 
    type: { type: Sequelize.STRING(10), comment: 'limit或market（默认是limit）', defaultValue: 'limit' },
    created_at: { type: Sequelize.DATE, comment: '订单创建时间' },
}, {
    sequelize,
    tableName: 'orders',
    timestamps: false,
});

Order.STATE_WAITING = 'waiting';      // 等待发起交易
Order.STATE_PARTIAL = 'partial';      // 部分成交
Order.STATE_FILLED = 'filled';        // 完全交易
Order.STATE_CANCELLING = 'cancelling';         // 交易取消
Order.STATE_CANCEL_SUCCESS = 'cancel_success'; // 交易取消成功
Order.STATE_FAILED = 'failed';        // 交易失败

Order.SIDE_BUY = 'buy';
Order.SIDE_SELL = 'sell';

Order.batchUpdate = async (spotOrders) => {
    for (const item of spotOrders){
        await Order.update(item, {
            where: {
                id: item.id
            }
        });
    }
}

Order.initExample = () => {
    //
};

exports = module.exports = Order;