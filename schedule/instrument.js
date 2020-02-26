const fs = require('fs');
const Sequelize = require('sequelize');
const datetime = require('node-datetime');
const schedule = require('node-schedule'); 
const Decimal = require('../definitions/decimal');
const Log = require('../definitions/Log');
const Setting = require('../models/Setting');
const Instrument = require('../models/Instrument');
const MarketplaceManager = require('../marketplace/Manager');
const { Sleep } = require('../definitions/utils');

require('total.js');

const Op = Sequelize.Op;

const handle = async (setting) => {
    Log.Info(__filename, 'Instrument querying  ' + setting.market.toUpperCase() + ' ...');

    // A 所
    const mp = MarketplaceManager.get(setting.marketplace, setting.market);


    // 获取市场深度
    const depth = await mp.getDepth(setting.depth);

    // 获取K线数据
    const timestamp = datetime.create();
    const timestamp1 = datetime.create(timestamp.getTime() - setting.granularity * 20 * 1000);
    timestamp1.offsetInHours(-8);
    const lastTime = timestamp1.format('Y-m-dTH:M:00.00Z');  // '2020-02-22T05:15:00.000Z';
    Sleep(10000);

    const candles = await mp.candles(true, setting.granularity, null, lastTime);
    if (candles.length <= 0) {
        //
    }

    wirte(setting, candles, depth);
};

const wirte = async (setting, candles, depth) => {
    const timestamp = datetime.create();
    timestamp.offsetInHours(-8);
    const currentDate = timestamp.format('Y_m_d');

    const historyPath = './history/' + setting.marketplace + '/';
    if (!fs.existsSync(historyPath)){
        fs.mkdirSync(historyPath);
    }

    const candleFile = historyPath + currentDate + '_candles_' + setting.market + '_' + setting.granularity + '.data';
    let oldCandles = [];
    if (fs.existsSync(candleFile)) {
        oldCandles = JSON.parse(fs.readFileSync(candleFile, 'utf-8'));
    }
    oldCandles.push(candles[0]);
    fs.writeFileSync(candleFile, JSON.stringify(oldCandles), { encoding: 'utf-8' });

    const depthFile = historyPath + currentDate + '_depths_' + setting.market + '_' + setting.granularity + '.data';
    let depths = [];
    if (fs.existsSync(depthFile)) {
        depths = JSON.parse(fs.readFileSync(depthFile, 'utf-8'));
    }
    depths.push(depth);
    fs.writeFileSync(depthFile, JSON.stringify(depths), { encoding: 'utf-8' });

    //获取 candles 关于收盘价、最高价、最低价 数组
    let closeMin10 = 9999999;
    let closeMax20 = 0;
    let lowMin10 = 9999999;
    let highMax20 = 0;
    candles.forEach(candle => {
        if (candle.close > closeMax20) closeMax20 = candle.close;
        if (candle.high > highMax20) highMax20 = candle.high;
    });
    candles.slice(0, 10).forEach(candle => {
        if (candle.close < closeMin10) closeMin10 = candle.close;
        if (candle.low < lowMin10) lowMin10 = candle.low;
    });

    Instrument.create({
        label: candles[0].time,
        open: candles[0].open,
        close: candles[0].close,    // 添加新的参数 open - close
        high: candles[0].high,      // 该参数的浮动没有意义， 实际训练中不参与
        low: candles[0].low,        // 该参数的浮动没有意义， 实际训练中不参与， 但是要添加新的参数 high - low
        volume: candles[0].volume,
        ask: depth.getAverAsk(),
        bid: depth.getAverBid(),
        high_diff: Decimal(candles[0].high).sub(candles[1].close).toNumber(), // 最高价 - 前一交易日的收盘价
        low_diff: Decimal(candles[0].low).sub(candles[1].close).toNumber(), // 最低价 - 前一交易日的收盘价
        close10: Decimal(candles[0].close).sub(closeMin10).toNumber(), // 收盘价 - 过去10个交易周期中收盘的最低价 < 0，卖出信号
        close20: Decimal(candles[0].close).sub(closeMax20).toNumber(), // 收盘价 - 过去20个交易周期中收盘的最高价 > 0，买入信号
        close_low10: Decimal(candles[0].close).sub(lowMin10).toNumber(), // 收盘价 - 过去10个交易周期中的最低价 < 0，卖出信号
        close_high20: Decimal(candles[0].close).sub(highMax20).toNumber(), // 收盘价 - 过去20个交易周期中的最高价 > 0，买入信号
    });
}

const instrumentSchedule = async () => {
    // OKEX [60 180 300 900 1800 3600 7200 14400 21600 43200 86400 604800]
    // poloniex [300, 900, 1800, 7200, 14400, 86400]; 
    const granularities = [300, 900, 1800, 7200, 14400, 86400];
    const crons = [
        '*/5 * * * *',      // 300
        '*/15 * * * *',     // 900
        '*/30 * * * *',     // 1800
        '0 */2 * * *',      // 7200
        '0 */4 * * *',      // 14400
        '0 0 * * *',        // 86400
    ];
    const settings = await Setting.findAll({
        where: { enabled: true }
    });

    for (const setting of settings) {
        const cacheKey = 'TASK|INSTRUMENT|' + setting.market + '|' + setting.marketplace;
        //每10s定时执行一次
        schedule.scheduleJob(crons[granularities.indexOf(setting.granularity)], () => {
            if (!F.cache.get(cacheKey)) {
                F.cache.set2(cacheKey, true, '1 hour');

                handle(setting).catch(e => {
                    Log.Error(__filename, e);
                }).finally(() => {
                    F.cache.remove(cacheKey);
                });
            }
        });
    }
};

exports = module.exports = instrumentSchedule;