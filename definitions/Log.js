const fs = require('fs');
const path = require('path');
const dateTime = require('node-datetime');

class Log {
    static request(id, options, res) {
        const dt = dateTime.create();
        const uri = options.uri || options;
        const req = uri == options ? '' : JSON.stringify(options);

        console.log(dt.format('H:M:S') + ' [INFO - Request] '+ uri + ' ' + res);
        Log.write(dt.format('H:M:S') + ' [INFO - Request] '+ uri + ' ' + res);

        // const sql = "insert into log_request(request_id, url, req, res) values(?, ?, ?, ?)";
        // DB.insertData(sql, [[id, uri, req, res]]);
    }

    static Info(name, message){
        Log.writeLog('INFO', name, message);
    }

    static Warn(name, message){
        Log.writeLog('WARN', name, message);
    }

    static Error(name, message){
        Log.writeLog('ERROR', name, message);
    }

    static writeLog(level, name, message){
        const dt = dateTime.create();
        console.log(dt.format('H:M:S') + ' ['+level+' - '+path.basename(name)+'] '+ message);
        Log.write(dt.format('H:M:S') + ' ['+level+' - '+path.basename(name)+'] '+ message);
    }

    static write(message) {
        const dt = dateTime.create();
        const pwd = process.cwd();
        fs.appendFileSync(pwd+'/tmp/' + dt.format('y-m-d') + '.log', message+"\n");
    }
}

exports = module.exports = Log;