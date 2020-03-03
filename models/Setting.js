const fs = require('fs');
var crypto = require('crypto');
const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');
const Instrument = require('./Instrument');
const ModelSetting = require('./ModelSetting');
const Tuning = require('./Tuning');
const Lstm = require('../strategy/Lstm'); 

const PARAMETERS = {
    targetIndex: 0,     // 预测值索引
    stepSize: 6,        // 窗口尺寸
    trainOffset: 50,    // 最新的 50 条记录不参与训练
    testSize: 200,       // 测试数据量
    percent: -1.0,        // 测试利率阈值
    targetSize: 1,      // 这个是我要预测的时间长度，12表示预测12个月的数据
    epochs: 20,         // 训练次数
    batchSize: 32,      // 训练批量
    lstmUnits: 30,      // 输入层隐藏神经元个数
    splitRatio: 0.2,    // 测试样本 / 训练样本
};

class Setting extends Model {
    // 训练模型，返回模型名称
    async train() {
        const self = this;
        const parameters = {
            ...PARAMETERS,
            ...JSON.parse(self.parameters)
        };

        const lstm = new Lstm({
            market: self.market,
            marketplace: self.marketplace,
            granularity: self.granularity,
            ...parameters
        });

        const { labels, candles } = await Instrument.getAll(parameters.testSize, parameters.trainOffset, { array: true });
        const modelName = await lstm.train(labels, candles);
        return modelName;
    }

    async test() {
        const self = this;
        const parameters = {
            ...PARAMETERS,
            ...JSON.parse(self.parameters)
        };

        const modelSetting = await ModelSetting.findOne({
            where: { setting_id: self.id, enabled: true },
            order: [
                ['id', 'DESC'],
            ]
        });
        let modelName = '';
        if (!modelSetting) {
            modelName = await self.train();
        }else{
            modelName = modelSetting.model;
        }

        let tuning = await self.tuning(modelName);
        while(tuning.percent < parameters.percent){
            modelName = await self.train();
            tuning = await self.tuning(modelName);
            if (tuning.percent < parameters.percent) {
                this.cleanModel(modelName);
            }
        }

        await self.cleanHistoryModel();
        await sequelize.transaction(async t => {
            if (modelSetting){
                modelSetting.save({
                    enabled: true,
                    pred_diff: tuning.predDiff,
                    loss_ratio: tuning.lossRatio,
                    win_ratio: tuning.winRatio
                })
            }else{
                await ModelSetting.update(
                    { enabled: false },
                    { where: { setting_id: self.id, enabled: true } },
                    { transaction: t }
                );

                await ModelSetting.create({
                    setting_id: self.id,
                    model: modelName,
                    enabled: true,
                    pred_diff: tuning.predDiff,
                    loss_ratio: tuning.lossRatio,
                    win_ratio: tuning.winRatio
                }, { transaction: t });
            }
        });

        return tuning;
    }

    async tuning(modelName) {
        const self = this;
        const parameters = {
            ...PARAMETERS,
            ...JSON.parse(self.parameters)
        };
        const candlesData = await Instrument.getAll(parameters.testSize, 0, { array: true });
        const predCache = await this.predict(modelName, candlesData);
        const tuning = new Tuning({
            candlesData,
            predCache,
            ...parameters
        });

        return await tuning.run();
    }

    async trace(modelSettingId, limit, offset, index) {
        const self = this;
        const parameters = {
            ...PARAMETERS,
            ...JSON.parse(self.parameters)
        };
        const modelSetting =await ModelSetting.findByPk(modelSettingId);
        if(!modelSetting) return;

        const candlesData = await Instrument.getAll(limit, offset, { array: true });
        const predCache = await this.predict(modelSetting.model, candlesData);

        const tuning = new Tuning({
            candlesData,
            predCache,
            modelSettingId: modelSetting.id,
            ...parameters
        });

        const trace = tuning.trace(index, modelSetting.pred_diff, modelSetting.loss_ratio, modelSetting.win_ratio);
        
        return trace;
    }

    async predict(modelName, candlesData) {
        const self = this;
        const parameters = {
            ...PARAMETERS,
            ...JSON.parse(self.parameters)
        };

        const lstm = new Lstm({
            market: self.market,
            marketplace: self.marketplace,
            granularity: self.granularity,
            ...parameters
        });

        let predCache = [];
        const cachePath = './logs/candles_' + this.marketplace + '_' + this.market + '_pred_' + crypto.createHash('md5').update(JSON.stringify(parameters)).digest("hex") + '.cache';
        if (fs.existsSync(cachePath)) {
            predCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        } else {
            let index = 0;
            while (index < candlesData.labels.length) {
                predCache[index] = await lstm.predict(modelName, index, candlesData);
                index++;
            }
            fs.writeFileSync(cachePath, JSON.stringify(predCache), { encoding: 'utf-8' });
        }
        return predCache;
    }

    async cleanHistoryModel(options = {}) {
        const self = this;
        const modelSettings = await ModelSetting.findAll({
            offset: 2,
            limit: 99,
            order: [
                ['id', 'DESC'],
            ],
            truncate: false
        });
        if (!modelSettings) return;

        for(let modelSetting of modelSettings){
            this.cleanModel(modelSetting.model);
            modelSetting.destroy(options);
        }
    }

    cleanModel(modelName) {
        const modelPath = './model/' + modelName;

        if (fs.existsSync(modelPath)) {
            fs.unlinkSync(modelPath + '/model.json');
            fs.unlinkSync(modelPath + '/weights.bin');
            fs.rmdirSync(modelPath);
        }
    }
}

Setting.init({
    market: { type: Sequelize.STRING, comment: '市场' },
    marketplace: { type: Sequelize.STRING, comment: '交易所' },
    granularity: { type: Sequelize.INTEGER, comment: '交易频率(s)' },
    depth: { type: Sequelize.INTEGER, comment: '深度', defaultValue: 5 },
    volume_limit: { type: Sequelize.DECIMAL(20,8), comment: '挂牌量大于该值，才进行交易判断', defaultValue: 0.1 },
    volume: { type: Sequelize.DECIMAL(20,8), comment: '每次交易请求量', defaultValue: 0.01 },
    trade_timeout: { type: Sequelize.INTEGER, comment: '交易超时阈值(s)', defaultValue: 240 },
    check_cron: { type: Sequelize.STRING, comment: '交易检测定时', defaultValue: '*/10 * * * * *' },
    enabled: { type: Sequelize.BOOLEAN, comment: '启用', defaultValue: true },
    side: { type: Sequelize.STRING, comment: '交易方向限制', defaultValue: 'un_forbidden' },
    parameters: { type: Sequelize.STRING, comment: '模型训练参数', defaultValue: '{}' }
}, {
    sequelize,
    tableName: 'setting',
    timestamps: false,
});

Setting.SIDE_BUY_FORBIDDEN = 'buy_forbidden';
Setting.SIDE_SELL_FORBIDDEN = 'sell_forbidden';
Setting.SIDE_UN_FORBIDDEN = 'un_forbidden';

exports = module.exports = Setting;