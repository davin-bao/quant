const req = require('request-promise');
const Log = require('./Log');
const guid = require('./utils').guid;

const request = async (options) => {
    const uid = guid();

    if(typeof(options)=='string'){
        options = {
            uri: options,
            proxy: "http://127.0.0.1:1080/",
            rejectUnauthorized: false
        };
    }else{
        options.proxy = "http://127.0.0.1:1080/";
        options.rejectUnauthorized = false;
    }

    try{
        const res = await req(options);
        console.log(options.uri, res);
        Log.request(uid, options, res);
        res.uid = uid;
        return res;
    }catch (err) {
        Log.request(uid, options, err);
        err.uid = uid;
        throw err;
    }
};

exports = module.exports = request;
