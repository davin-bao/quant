const Sequelize = require('sequelize');
const Decimal = require('../definitions/decimal');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const Hedge = require('./Hedge');
const Setting = require('./Setting');
const Log = require('../definitions/Log');
const MarketplaceManager = require('../marketplace/Manager');
const Account = require('../models/Account');
const Error = require('../marketplace/response/Error');

const Op = Sequelize.Op;

class Order extends Model {
    // 发起交易
    async trade() {
        const self = this;
        const marketplace = self.marketplace;
        const currencies = self.market.split('_').trim();
        const currency = self.side === 'buy' ? currencies[1] : currencies[0];
        const account = await Account.getByMarketplaceAndCurrency(marketplace, currency);

        // if(!account) {
        //     const memo = '账户 ' + marketplace +  '/' + currency + ' 不存在, 终止交易';
        //     Log.Info(__filename, '发起交易 no：' + self.id + ' ' + memo);
        //     self.update({
        //         state: Order.CANCEL,
        //         memo
        //     });
        //     return;
        // }
        // if(Decimal(account.available).sub(self.volume).toNumber() < 0){
        //     const memo = '账户 ' + marketplace +  '/' + currency + ' 余额不足, 终止交易';
        //     Log.Info(__filename, '发起交易 no：' + self.id + ' ' + memo);
        //     self.update({
        //         state: Order.CANCEL,
        //         memo
        //     });
        //     return;
        // }
        // 发起交易请求
        const mp = MarketplaceManager.get(marketplace, self.market);
        let orderResult = await mp.orders(self.side, self.price, self.volume, self.id);

        if(orderResult instanceof Error){
            if(orderResult.code === Error.ACCOUNT_NOT_ENOUGH){
                // 账户余额不足，关闭交易
                // const cacheKey = 'LOCK|BALANCE|' + self.market + '|' + self.marketplace;
                // if (!F.cache.get(cacheKey)) {
                //     F.cache.set(cacheKey, true, '10 minutes');
                    try{

                        // 账户余额不足，关闭交易
                        const setting = await Setting.findOne({
                            where:{
                                market: self.market,
                                [Op.or]: [
                                    {
                                        marketplace_a: marketplace
                                    }, {
                                        marketplace_b: marketplace
                                    }
                                ]
                            }
                        });
                        let updated = {};
                        if(setting.marketplace_a === self.marketplace){
                            updated = {
                                side_a: self.side === Order.SIDE_BUY ? Setting.SIDE_BUY_FORBIDDEN : Setting.SIDE_SELL_FORBIDDEN
                            };
                        }
                        if(setting.marketplace_b === self.marketplace){
                            updated = {
                                side_b: self.side === Order.SIDE_BUY ? Setting.SIDE_BUY_FORBIDDEN : Setting.SIDE_SELL_FORBIDDEN
                            };
                        }
                        setting && setting.update(updated);
                        return;
                    }catch (e) {
                        throw e;
                    }finally {
                        // F.cache.remove(cacheKey);
                    }
                // }
            }
            orderResult = {order_id: -1, result: false, error_message: orderResult.message};
        }
        const memo = orderResult.error_message;
        Log.Info(__filename, '发起交易 no：' + self.id + ',结果: ' + orderResult.result + ',' + memo);
        await sequelize.transaction(async t=> {
            self.update({
                order_id: orderResult.order_id,
                state: orderResult.state,
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
        const currencies = self.market.split('_').trim();
        const currency = self.side === 'buy' ? currencies[1] : currencies[0];
        const account = await Account.getByMarketplaceAndCurrency(marketplace, currency);

        // 发起交易查询
        const mp = MarketplaceManager.get(marketplace, self.market);
        let orderResult = await mp.ordersQuery(self.order_id);

        if(orderResult instanceof Error){
            orderResult = {order_id: -1, state: Order.TRADING, error_message: orderResult.message};
        }

        const memo = orderResult.error_message;
        Log.Info(__filename, '查询交易 no：' + self.id + ',' + memo);
        await sequelize.transaction(async t=> {
            await self.update({
                state: orderResult.state,
                avg_price: orderResult.avg_price || 0,
                executed_volume: orderResult.executed_volume || 0,
                price: orderResult.price || 0,
                memo
            }, {transaction: t});

            if (orderResult.state === Order.CANCEL) {
                await account.unlock(self.volume, {transaction: t, relate_id: self.id});
            }else if(orderResult.state === Order.FINISHED){
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
                orderResult = {order_id: -1, state: Order.TRADING, error_message: '交易超时'};
            }
        }
        const memo = orderResult.error_message === '操作成功' ? '交易超时' : orderResult.error_message;
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
    //发起平衡账户交易
    async tradeBalance() {
        const self = this;

        if(parseInt(self.order_id) !== -1) return;

        const marketplace = self.marketplace;
        const currencies = self.market.split('_').trim();
        const currency = self.side === 'buy' ? currencies[1] : currencies[0];
        const account = await Account.getByMarketplaceAndCurrency(marketplace, currency);
        const mp = MarketplaceManager.get(marketplace, self.market);

        let orderResult = await mp.orders(self.side, -1, self.volume, self.id);

        if(orderResult instanceof Error){
            if(orderResult.code === Error.ACCOUNT_NOT_ENOUGH){
                // 账户余额不足，关闭交易
                Log.Info(__filename, '账户余额不足，关闭交易');
                return;
            }
            orderResult = {order_id: -1, result: false, error_message: orderResult.message};
        }
        const memo = orderResult.error_message;
        Log.Info(__filename, '发起平衡账户交易 no：' + self.id + ',结果: ' + orderResult.result + ',' + memo);
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
Order.NEED_TRADE = 'need_trade'; //委托失败，可重试
Order.CANCEL = 'cancel';        // 交易取消
Order.FINISHED = 'finished';    // 交易完成

Order.SIDE_BUY = 'buy';
Order.SIDE_SELL = 'sell';


Hedge.hasMany(Order, {foreignKey: 'hedge_id', targetKey: 'id'});

Order.balance = async function(options = {}){
    // 1. 查询账户余额
    // 2. 查询是否已经创建了交易,条件：
    // 时间是否在 2分钟内存在 hedge_id == -1 AND marketplace == options.marketplace AND market == options.market AND side = side
    // TODO
    // 3. 发起交易
    // 4. 创建市价订单
    const currency = options.side === 'buy' ? options.currencies[1] : options.currencies[0];

    const mp = MarketplaceManager.get(options.marketplace, options.market);
    const upstreamAccounts = await mp.getAccountList();
    let order = null;
    let volume = 0;  // 卖出数量 / 买入金额
    upstreamAccounts.forEach(upstreamAccount => {
        if (upstreamAccount.currency.toLowerCase() === currency.toLowerCase()) {
            volume = Decimal(upstreamAccount.available).div(2).toNumber();
        }
    });
    await sequelize.transaction(
        // { isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE },
        async t=> {
        const balanceOrders  = await Order.findAll({
            transaction: t,
            where: {
                hedge_id: -1,
                marketplace: options.marketplace,
                market: options.market,
                side: options.side,
                state: {
                    [Op.or]: [Order.WAITING, Order.TRADING, Order.CANCEL]
                }
            }
        });
        if(balanceOrders.length > 0){
            Log.Info(__filename, '存在未完成的平衡账户交易，撤销当前请求');
            return;
        }

        order = new Order({
            hedge_id: -1,
            order_id: '-1',
            marketplace: options.marketplace,
            market: options.market,
            side: options.side,
            volume, /// 卖出数量 | 买入金额
            price: -1,
            state: Order.WAITING
        });
        order = await order.save({transaction: t});
    });

    order && await order.tradeBalance();
};

exports = module.exports = Order;