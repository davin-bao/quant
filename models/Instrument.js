const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const Decimal = require('../definitions/decimal');

const Op = Sequelize.Op;

class Instrument extends Model {
}

Instrument.init({
    label: { type: Sequelize.STRING, comment: '时间' },
    open: { type: Sequelize.DECIMAL(20, 8), comment: '开盘价' },
    close: { type: Sequelize.DECIMAL(20, 8), comment: '收盘价' },
    high: { type: Sequelize.DECIMAL(20, 8), comment: '最高价' },
    low: { type: Sequelize.DECIMAL(20, 8), comment: '最低价' },
    volume: { type: Sequelize.DECIMAL(20, 8), comment: '交易量' },
    ask: { type: Sequelize.DECIMAL(20, 8), comment: '买单深度' },
    bid: { type: Sequelize.DECIMAL(20, 8), comment: '卖单深度' },
    high_diff: { type: Sequelize.DECIMAL(20, 8), comment: '最高价 - 前一交易日的收盘价' },
    low_diff: { type: Sequelize.DECIMAL(20, 8), comment: '最低价 - 前一交易日的收盘价' },
    close10: { type: Sequelize.DECIMAL(20, 8), comment: '收盘价 - 过去10个交易周期中收盘的最低价 < 0，卖出信号' },
    close20: { type: Sequelize.DECIMAL(20, 8), comment: '收盘价 - 过去20个交易周期中收盘的最高价 > 0，买入信号' },
    close_low10: { type: Sequelize.DECIMAL(20, 8), comment: '收盘价 - 过去10个交易周期中的最低价 < 0，卖出信号' },
    close_high20: { type: Sequelize.DECIMAL(20, 8), comment: '收盘价 - 过去20个交易周期中的最高价 > 0，买入信号' },
}, {
    sequelize,
    tableName: 'instrument',
    timestamps: true,
});

/**
 * options = {
 *  array: true,
 *  lastCount: 30,  // 向前多取些数据
 *  ema: [7, 30]
 * }
 */
Instrument.getAll = async function (limit = 200, offset = 0, options = {}) {
    options = {
        array: false,
        lastCount: 30,
        ...options
    };
    // 向前移动游标 options.lastCount
    let start = offset - options.lastCount;
    let nlimit = limit + options.lastCount;
    let sliceStart = options.lastCount;
console.log(offset, options.lastCount, start);
    if (offset < options.lastCount) {
        start = 0;
        nlimit = limit + offset;
        sliceStart = offset;
    }

    const result = await Instrument.findAll({
        offset: start,
        limit: nlimit,
        order: [
            ['label', 'DESC'],
        ]
    });
    let instruments = result.reverse();

    let data = [];
    const labels = [];

    for (let i = 0; i < instruments.length; i++) {
        const item = instruments[i];
        labels.push(item.label);

        const dataItem = {
            label: item.label,
            open: item.open,
            close: item.close,
            open_close: item.open - item.close,
            high_low: item.high - item.low,
            volume: item.volume,
            ask: item.ask,
            bid: item.bid,
            high_diff: item.high_diff,
            low_diff: item.low_diff,
            close10: item.close10,
            close20: item.close20,
            close_low10: item.close_low10,
            close_high20: item.close_high20,
        };
        // EMA 指标计算
        if (options.ema) {
            for (const count of options.ema) {
                let emaXn_1 = (i > 0) ? data[i - 1]['ema' + count] : instruments[0].close;
                dataItem['ema' + count] = Decimal(item.close).mul(2).add(Decimal(emaXn_1).mul(count - 1).toNumber()).div(count + 1).toNumber();
            }
        }

        data.push(dataItem);
    }

    if (options.array) {
        const dataArr = [];
        for (const dataItem of data) {
            const itemData = [];
            for (const key of Object.keys(dataItem)) {
                if (key != 'label') itemData.push(dataItem[key]);
            }
            dataArr.push(itemData);
        }

        data = dataArr;
    }

    return { labels: labels.slice(sliceStart, labels.length), candles: data.slice(sliceStart, data.length) };
}

exports = module.exports = Instrument;