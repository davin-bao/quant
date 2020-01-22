exports.guid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

exports.loop = (arr, callback, delay) => {
    let i = 0;
    const ins = setInterval(()=>{
        callback(arr[i]);
        i++;
        if(i>=arr.length) clearInterval(ins);
    }, delay);
};

exports.getZoneTime = (offset)=> {
    // 取本地时间
    let localtime = new Date();
    // 取本地毫秒数
    let localmesc = localtime.getTime();
    // 取本地时区与格林尼治所在时区的偏差毫秒数
    let localOffset = localtime.getTimezoneOffset() * 60000;
    // 反推得到格林尼治时间
    let utc = localOffset + localmesc;
    // 得到指定时区时间
    let calctime = utc + (3600000 * offset);
    return new Date(calctime);
};