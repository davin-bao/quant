const Sequelize = require('sequelize');
const Decimal = require('decimal');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const Hedge = require('./Hedge');
const Setting = require('./Setting');
const Log = require('../definitions/Log');
const MarketplaceManager = require('../marketplace/Manager');
const Account = require('../models/Account');
const Error = require('../marketplace/response/Error');

class Order extends Model {
    // 发起交易
    async trade() {
        const self = this;
        const marketplace = self.marketplace;
        const currencies = self.market.split('_').trim();
        const currency = self.side === 'buy' ? currencies[1] : currencies[0];
        const account = await Account.getByMarketplaceAndCurrency(marketplace, currency);

        if(!account) {
            const memo = '账户 ' + marketplace +  '/' + currency + ' 不存在, 终止交易';
            Log.Info(__filename, '发起交易 no：' + self.id + ' ' + memo);
            self.update({
                state: Order.CANCEL,
                memo
            });
            return;
        }
        if(Decimal(account.available).sub(self.volume).toNumber() < 0){
            const memo = '账户 ' + marketplace +  '/' + currency + ' 余额不足, 终止交易';
            Log.Info(__filename, '发起交易 no：' + self.id + ' ' + memo);
            self.update({
                state: Order.CANCEL,
                memo
            });
            return;
        }
        // 发起交易请求
        const mp = MarketplaceManager.get(marketplace, self.market);
        let orderResult = await mp.orders(self.side, self.price, self.volume, self.id);

        if(orderResult instanceof Error){
            if(orderResult.code === Error.ACCOUNT_NOT_ENOUGH){
                const setting = Setting.instance();
                setting.update({
                    enabled: false
                });

                // 账户余额不足，关闭交易
                return;
            }
            orderResult = {order_id: -1, result: false, error_message: orderResult.message};
        }
        const memo = orderResult.error_message;
        Log.Info(__filename, '发起交易 no：' + self.id + ',结果: ' + orderResult.result + ',' + memo);
        await sequelize.transaction(async t=> {
            self.update({
                order_id: orderResult.order_id,
                state: orderResult.result ? Order.TRADING : Order.CANCEL,
                ttime: new Date().getTime(),
                memo
            });

            if (orderResult.state === Order.TRADING) {
                // 锁定
                await account.lock(self.volume, {transaction: t, relate_id: self.id});
            }
        });
    }
    // 查询订单
    async query() {
        const self = this;
        const marketplace = self.marketplace;

        // 发起交易查询
        const mp = MarketplaceManager.get(marketplace, self.market);
        let orderResult = await mp.ordersQuery(self.order_id);

        if(orderResult instanceof Error){
            orderResult = {order_id: -1, state: Order.TRADING, error_message: orderResult.message};
        }

        const memo = orderResult.error_message;
        Log.Info(__filename, '查询交易 no：' + self.id + ',' + memo);
        await sequelize.transaction(async t=> {
            self.update({
                state: orderResult.state,
                avg_price: orderResult.avg_price || 0,
                executed_volume: orderResult.executed_volume || 0,
                price: orderResult.price || 0,
                memo
            }, {transaction: t});

            if(orderResult.state === Order.FINISHED){
                const currencies = self.market.split('_').trim();
                const currencyAdd = self.side === 'buy' ? currencies[0] : currencies[1];
                const currencySub = self.side === 'buy' ? currencies[1] : currencies[0];

                const accountAdd = await Account.getByMarketplaceAndCurrency(self.marketplace, currencyAdd);
                const accountSub = await Account.getByMarketplaceAndCurrency(self.marketplace, currencySub);
                // 存入
                await accountAdd.deposit(orderResult.executed_volume, {transaction: t, relate_id: self.id});
                // 消费
                await accountSub.consume(orderResult.executed_volume, {transaction: t, relate_id: self.id});
            }
        });
    }
    // 取消订单
    async cancel(){
        const self = this;

        const marketplace = self.marketplace;

        // 发起交易查询
        const mp = MarketplaceManager.get(marketplace, self.market);
        let orderResult = await mp.ordersCancel(self.order_id);

        if(orderResult instanceof Error){
            if(orderResult.code === Error.ORDER_FINISHED_WHEN_CANCEL){ //挂单没有找到或已完成, 发起查询请求
                await self.query();
                return;
            }else if(orderResult.code === Error.ERROR_ORDER_ID){ // 订单号不存在
                orderResult = {order_id: -1, state: Order.CANCEL, error_message: orderResult.message};
            }else{
                orderResult = {order_id: -1, state: Order.TRADING, error_message: orderResult.message};
            }
        }
        const memo = orderResult.error_message;
        Log.Info(__filename, '取消交易 no：' + self.id + ',' + memo);
        await sequelize.transaction(async t=> {
            self.update({
                state: orderResult.state,
                avg_price: orderResult.avg_price || 0,
                executed_volume: orderResult.executed_volume || 0,
                price: orderResult.price || 0,
                memo
            }, {transaction: t});

            if (orderResult.state === Order.CANCEL) {
                const currencies = self.market.split('_').trim();
                const currency = self.side === 'buy' ? currencies[1] : currencies[0];
                const account = await Account.getByMarketplaceAndCurrency(marketplace, currency);
                await account.unlock(self.volume, {transaction: t, relate_id: self.id});
            }
        });
    }
}

Order.init({
    hedge_id: Sequelize.INTEGER,
    marketplace: Sequelize.STRING,
    order_id: Sequelize.STRING,
    market: Sequelize.STRING,
    side: Sequelize.STRING,
    volume: Sequelize.DECIMAL,
    remaining_volume: Sequelize.DECIMAL,
    executed_volume: Sequelize.DECIMAL,
    price: Sequelize.DECIMAL,
    avg_price: Sequelize.DECIMAL,
    state: Sequelize.STRING,
    ttime: Sequelize.DATE,
    ctime: Sequelize.DATE,
    memo: Sequelize.STRING
}, {
    sequelize,
    tableName: 'order',
    timestamps: false,
});

Order.WAITING = 'waiting';      // 等待发起交易
Order.TRADING = 'trading';      // 交易中
Order.CANCEL = 'cancel';        // 交易取消
Order.FINISHED = 'finished';    // 交易完成


Hedge.hasMany(Order, {foreignKey: 'hedge_id', targetKey: 'id'});

exports = module.exports = Order;