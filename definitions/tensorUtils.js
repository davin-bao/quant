const tf = require('@tensorflow/tfjs');

// 滑动窗口
exports.window = async (tensor, step) => {
    const data = await tensor.array();
    const res = [];
    for (let i = 0; i < data.length - step; i++) {
        res[i] = data.slice(i, i + step);
    }

    return tf.tensor(res);
};
// 输入值归一化
exports.normaliseX = async (tensor) => {

    const data = await tensor.array();
    const res = [];
    for (let k = 0; k < data.length; k++) {
        const item = data[k];
        res[k] = [];
        for (let i = 0; i < item.length; i++) {
            res[k][i] = [];
            for (let j = 0; j < item[i].length; j++) {
                res[k][i][j] = item[i][j] / item[0][j] - 1;
            }
        }
    }

    return tf.tensor(res);
};
// 目标值归一化
exports.normaliseY = async (tensor, step) => {
    const data = await tensor.array();
    const res = [];
    for (let i = 0; i < data.length - step; i++) {
        res[i] = data[i + step - 1] / data[i] - 1;
    }

    return tf.tensor(res);
};