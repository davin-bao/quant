
class Account {
    constructor(id, currency, available, locked){
        this.id = id;
        this.currency = currency;
        this.available = available;
        this.locked = locked;
    }
}

exports = module.exports = Account;
