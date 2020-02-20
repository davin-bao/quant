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

exports.DateFormat = function (date, fmt) {
    var o = {
        "M+": date.getMonth() + 1,                 //月份
        "d+": date.getDate(),                    //日
        "h+": date.getHours(),                   //小时
        "m+": date.getMinutes(),                 //分
        "s+": date.getSeconds(),                 //秒
        "q+": Math.floor((date.getMonth() + 3) / 3), //季度
        "S": date.getMilliseconds()             //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};
// 取二维数组中的一列
exports.Transpose = function (data, cols) {
    var res = [];
    for (let i = 0; i < data.length; i++) {
        if (cols.length === 1) res.push(data[i][cols[0]]);
        else{
            const row = [];
            for (let j = 0; j < cols.length; j++) {
                row.push(data[i][cols[j]]);
            }
            res.push(row);
        }
    }
    
    return res;
};

