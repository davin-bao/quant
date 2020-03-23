const nedb = require('nedb');

let tables = [];

class CacheDb {
    constructor(options={}) {
        const name = options.name || 'global';

        if (!tables[name]) tables[name] = new nedb({
            filename: './cache/' + name + '.db',
            autoload: true,
            ...options
        });
        this.db = tables[name];
    }

    insert(doc) {
        return new Promise((resolve, reject) => {
            this.db.insert(doc, (err, newDoc) => {
                if (err) reject(err);
                else resolve(newDoc);
            });
        });
    }

    update(query, data, options) {
        return new Promise((resolve, reject) => {
            this.db.update(query, data, options, function () {
                resolve(); 
            });
        });
    }

    find(query, sort = null, skip = null, limit = null) {
        return new Promise((resolve, reject) => {
            if (limit === null && skip === null && sort === null) {
                this.db.find(query, function (err, docs) {
                    if (err) reject(err);
                    else resolve(docs);
                });
            }else{
                let sql = this.db.find(query);
                if (sort != null) {
                    sql = sql.sort(sort);
                }
                if (skip != null) {
                    sql = sql.skip(skip);
                }
                if (limit != null) {
                    sql = sql.limit(limit);
                }

                sql.exec(function (err, docs) {
                    if (err) reject(err);
                    else resolve(docs);
                });
            }
        });
    }

    findOne(query, sort = null) {
        return new Promise((resolve, reject) => {
            if(sort === null){
                this.db.findOne(query, (err, docs) => {
                    if (err) reject(err);
                    else resolve(docs);
                });
            }else{
                this.db.findOne(query).sort(sort).exec(function (err, docs) {
                    if (err) reject(err);
                    else resolve(docs);
                });
            }
        });
    }

    count(query) {
        return new Promise((resolve, reject) => {
            this.db.count(query, (err, count) => {
                if (err) reject(err);
                else resolve(count);
            });
        });
    }

    remove(query, options) {
        return new Promise((resolve, reject) => {
            this.db.remove(query, options, (err, numRemoved) => {
                if (err) reject(err);
                else resolve(numRemoved);
            });
        });
    }
}

exports = module.exports = CacheDb;