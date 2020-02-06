const fs = require('fs');
const path = require('path');
const dateTime = require('node-datetime');

class Log {
    static logLevel(level){
        // error: 0, warning: 1, info: 2, request: 3
        switch (level) {
            case 'REQUEST':
            default:
                return process.env.LOG_LEVEL >= 3;
            case 'INFO':
                return process.env.LOG_LEVEL >= 2;
            case 'WARN':
                return process.env.LOG_LEVEL >= 1;
            case 'ERROR':
                return process.env.LOG_LEVEL >= 0;
        }
    }

    static request(id, options, res) {
        const dt = dateTime.create();
        const uri = options.uri || options;
        const req = uri == options ? '' : JSON.stringify(options);
        if(Log.logLevel('REQUEST')){
            console.log(dt.format('H:M:S') + ' [INFO - Request] '+ uri + ' ' + res);
            Log.write(dt.format('H:M:S') + ' [INFO - Request] '+ uri + ' ' + res);
        }

        // const sql = "insert into log_request(request_id, url, req, res) values(?, ?, ?, ?)";
        // DB.insertData(sql, [[id, uri, req, res]]);
    }

    static Info(name, message){
        if(Log.logLevel('INFO')) Log.writeLog('INFO', name, message);
    }

    static Warn(name, message){
        if(Log.logLevel('WARN')) Log.writeLog('WARN', name, message);
    }

    static Error(name, message){
        if(Log.logLevel('ERROR')) Log.writeLog('ERROR', name, message);
    }

    static writeLog(level, name, message){
        const dt = dateTime.create();
        console.log(dt.format('H:M:S') + ' ['+level+' - '+path.basename(name)+'] '+ message);
        Log.write(dt.format('H:M:S') + ' ['+level+' - '+path.basename(name)+'] '+ message);
    }

    static write(message) {
        const dt = dateTime.create();
        const pwd = process.cwd();
        fs.appendFileSync(pwd+'/logs/' + dt.format('y-m-d') + '.log', message+"\n");
    }
}

exports = module.exports = Log;