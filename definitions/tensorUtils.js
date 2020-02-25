const tf = require('@tensorflow/tfjs');
const { Transpose } = require('./utils');

// 滑动窗口
exports.window = async (tensor, step) => {
    const data = await tensor.array();
    const res = [];
    if (data.length <= step) {
        return tf.tensor([data]);
    }
    for (let i = 0; i < data.length - step + 1; i++) {
        res[i] = data.slice(i, i + step);
    }

    return tf.tensor(res);
};

exports.normalization1D = async (tensor) => {
    tensor = tf.transpose(tensor);

    const max = tensor.max();
    const min = tensor.min();
    const diff = max.sub(min);
    const diffSum = await diff.sum().array();
    if (diffSum === 0) {
        return tf.zeros(tensor.shape);
    }

    // 将 [1,2,3] 改为 [[1,1,1,...], [2,2,2,...],[3,3,3,...]]
    // const tensorDiff = tf.transpose(tf.ones([tensor.shape[1], diff.shape[0]]).mul(diff));
    // const tensorMin = tf.transpose(tf.ones([tensor.shape[1], min.shape[0]]).mul(min));

    const tmp = tensor.sub(min);
    const res = tmp.div(diff);

    return await tf.transpose(res);
};

exports.normalization2D = async (tensor) => {
    tensor = tf.transpose(tensor);

    const max = tensor.max(1);
    const min = tensor.min(1);
    const diff = max.sub(min);
    const diffSum = await diff.sum().array();
    if (diffSum === 0) {
        return tf.zeros(tensor.shape);
    }

    // 将 [1,2,3] 改为 [[1,1,1,...], [2,2,2,...],[3,3,3,...]]
    const tensorDiff = tf.transpose(tf.ones([tensor.shape[1], diff.shape[0]]).mul(diff));
    const tensorMin = tf.transpose(tf.ones([tensor.shape[1], min.shape[0]]).mul(min));

    const tmp = tensor.sub(tensorMin);
    const res = tmp.div(tensorDiff);

    return await tf.transpose(res);
};
// 输入值归一化
exports.normalization3D = async (tensor) => {
    const data = await tensor.array();
    
    const res = [];
    for (let k = 0; k < data.length; k++) {
        const item = tf.tensor(data[k]);
        res[k] = await (await this.normalization2D(item)).array();
    }

    return tf.tensor(res);
};

exports.normaliseX = async (data) => {
    const res = [];
    for (let i = 0; i < data.length; i++) {
        res[i] = [];
        for (let j = 0; j < data[i].length; j++) {
            const val = parseFloat(data[i][j]);
            const val0 = parseFloat((i == 0 ? data[i][j] : data[i - 1][j]));
            res[i][j] = val0 === 0 ? 1 : (val / val0 - 1);
        }
    }
    return res;
};
// 目标值归一化
exports.normaliseY = async (data, stepSize) => {
    const res = [];
    for (let i = 0; i < data.length; i++) {
        const index = (i <= stepSize + 1) ? 0 : (i - stepSize - 1);

        res[i] = data[i] / data[index] - 1;
    }

    return res;
};
exports.unormaliseY = async (data, predRatio) => {
    const res = [];
    for (let i = 0; i < predRatio.length; i++) {
        res[i] = (predRatio[i] + 1) * data[i];
    }

    return res;
};