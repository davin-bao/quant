
class Depth {
    constructor(size, asks, bids, timestamp){
        this.size = size;
        this.asks = asks;
        this.bids = bids;
        this.timestamp = timestamp;
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
