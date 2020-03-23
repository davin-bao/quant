#!/usr/bin/env node
const dotenv = require('dotenv');
const Sequelize = require('sequelize');
const dateTime = require('node-datetime');
const { Sleep } = require('./definitions/utils');
const Decimal = require('./definitions/decimal');
const Exchange = require('./models/Exchange');
const Event = require('./models/Event');
const Bots = require('./models/Bots');
const BotLog = require('./models/BotLog');
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

    const trade = await Trade.create({ bot_id: 1});
    await trade.update({
        bot_id: 2
    });
    return;

    // await BotLog.create({
    //     bot_id: 1,
    //     type: 'BotLog.TYPE_TRADE',
    //     memo: '收益: ',
    //     ctime:'dssds'
    // });

    // await Trade.batchUpdate([{id: 22}]);
    // return;
    // const exchange = await Exchange.findOne({
    //     where: {
    //         id: 1,
    //     }
    // });
    // await exchange.init(event);
    // SocketWorker(event);
    
    // await exchange.start();

    // return;
    // const bot = await Bots.findOne();
    // await bot.init()

    // const strategy = new Depth5Strategy({ bot });
    // await strategy.init();
    // await strategy.tick();
    // return;

    // const exchange = await Exchange.findOne({
    //     where: {
    //         id: 1,
    //     }
    // });
    // await exchange.init(event);
    // await exchange.start();


    // await bot.getExchange();
    // bot.init(event);
    // bot.start();

    // return;

    // const lastDepth5Record = await Depth5Channel.getLastSecondsRecord(10000);

    // const dt = dateTime.create();
    // let asks = [];
    // let bids = [];
    // console.log((dt.getTime() - 10000 * 1000), lastDepth5Record.length);

    // for (let i = 0; i < lastDepth5Record.length; i++) {
    //     asks = asks.concat(lastDepth5Record[i].asks);
    //     bids = bids.concat(lastDepth5Record[i].bids);
    // }

    // let askSum = 0, bidSum = 0;
    // for (let i = 0; i < asks.length; i++) {
    //     askSum = Decimal(askSum).add(asks[i][1]).toNumber();
    //     bidSum = Decimal(bidSum).add(bids[i][1]).toNumber();
    // }

    // const askAver = asks.length === 0 ? 0 : Decimal(askSum).div(asks.length).toNumber();
    // const bidAver = bids.length === 0 ? 0 : Decimal(bidSum).div(bids.length).toNumber();

    // console.log(
    //     askSum, asks.length,
    //     askAver,
    //     bidAver
    // );

    // return;

    // const dt1 = dateTime.create();
    // await Candle60Channel.addRecord({
    //     exchange: 'okex',
    //     market: 'etc_usdt',
    //     time: new Date(dt1.getTime()),
    //     timestamp: dt1.getTime(),
    //     start: 1,
    //     max:2,
    //     min:3, 
    //     end:4,
    //     volumn:3,
    //     money:1
    // }, event, 30);
    // const res1 = await Candle60Channel.findAll({ where:{ timestamp: { [Op.gte]: dt1.getTime() - 300 * 1000 } }});
    // for (const k in res1[0].time){
    //     console.log(k);
    // }
    
    // return;

    

    // const candle60Channel = new Candle60Channel();

    // await candle60Channel.add({ "exchange": "okex", "market": "etc_usdt", "timestamp": "2020-03-09T08:37:00.000Z", "start": "7.008", "max": "7.013", "min": "7", "end": "7.011", "volumn": "4223.01412" });
    // await candle60Channel.add({ "exchange": "okex", "market": "etc_usdt", "timestamp": "2020-03-09T08:37:00.000Z", "start": "7.008", "max": "7.013", "min": "7", "end": "7.011", "volumn": "4223.01412" });
    // return;

    

    // const depth5Channel = new Depth5Channel();
    // // const dt = datetime.create();

    // // 1583550891551
    // // 1583551602018
    // // const dt = new Date();
    // const ddt = dt.getTime() - 1800 * 1000;
    // console.log(await depth5Channel.cacheDb.findOne());
    // console.log('^^^', ddt, await depth5Channel.cacheDb.find({ timestamp: { $gte: 0 } }));

    // // const ddd = await depth5Channel.cacheDb.find({ timestamp: { $gte: 1583313666652 } });
    // // console.log(ddd);
    //     return;

    // // const trade = await Trade.buy({
    // //     bot_id: 1,
    // //     exchange: 'okex',
    // //     market: 'etc_usdt',
    // //     buy_qty: 0.01,
    // //     buy_price: '8.201',
    // // });
    // // let state = Trade.STATE_BUY_WAITING;
    // // while(state !== Trade.STATE_BUY_FILLED){
    // //     Sleep(1000);
    //     const trade = await Trade.findOne({
    //         where: {
    //             id: 12
    //         }
    //     });
    // //     state = trade1.state;
    // // }

    // await trade.sell({
    //     sell_price: '8.201'
    // });

    // return;

    // const currencies = await Account.getCurrenciesByExchange('okex');
    // return;

}

go();

return;