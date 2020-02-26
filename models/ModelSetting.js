const Sequelize = require('sequelize');
const sequelize = require('../definitions/sequelize');
const Model = require('./Model');

class ModelSetting extends Model {}

ModelSetting.init({
    setting_id: { type: Sequelize.INTEGER, comment: '设置ID' },
    model: { type: Sequelize.STRING, comment: '当前模型' },
    enabled: { type: Sequelize.BOOLEAN, comment: '启用', defaultValue: false },
    pred_diff: { type: Sequelize.DECIMAL(20,8), comment: '预测值涨幅' },
    loss_ratio: { type: Sequelize.DECIMAL(20,8), comment: '割肉阈值' },
    win_ratio: { type: Sequelize.DECIMAL(20,8), comment: '盈利阈值' },
}, {
    sequelize,
    tableName: 'model_setting',
    timestamps: true,
});

exports = module.exports = ModelSetting;