const Decimal = require('../../definitions/decimal');

class Depth {
    constructor(size, asks, bids, timestamp){
        this.size = size;
        this.asks = asks;
        this.bids = bids;

        if(asks.length > size){
            this.asks = asks.slice(0, size);
        }
        if(bids.length > size){
            this.bids = bids.slice(0, size);
        }
        this.timestamp = timestamp;
    }

    getAver(data) {
        if ((data instanceof Array) && data.length > 0) {
            let sum = 0;
            for (const item of data) {
                sum = Decimal(item[0]).mul(item[1]).add(sum).toNumber();
            }
            return Decimal(sum).div(data.length).toNumber();
        }
        return 0;
    }

    getAverAsk() {
        return this.getAver(this.asks);
    }

    getAverBid() {
        return this.getAver(this.bids);
    }

    getFirstAsks() {
        if((this.asks instanceof Array) && this.asks.length > 0) {
            return this.asks[0];
        }
        return [0,0];
    }

    getSecondAsks() {
        if((this.asks instanceof Array) && this.asks.length > 1) {
            return this.asks[1];
        }
        return this.getLastAsks();
    }

    getLastAsks() {
        if((this.asks instanceof Array) && this.asks.length > 0) {
            return this.asks[this.asks.length - 1];
        }
        return [0,0];
    }

    getFirstBids() {
        if((this.bids instanceof Array) && this.bids.length > 0) {
            return this.bids[0];
        }
        return [0,0];
    }

    getSecondBids() {
        if((this.bids instanceof Array) && this.bids.length > 1) {
            return this.bids[1];
        }
        return this.getLastBids();
    }

    getLastBids() {
        if((this.bids instanceof Array) && this.bids.length > 0) {
            return this.bids[this.bids.length - 1];
        }
        return [0,0];
    }


}

exports = module.exports = Depth;
