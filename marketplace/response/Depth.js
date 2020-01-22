
class Depth {
    constructor(size, asks, bids, timestamp){
        this.size = size;
        this.asks = asks;
        this.bids = bids;
        this.timestamp = timestamp;
    }

    getLastAsks() {
        if((this.asks instanceof Array) && this.asks.length > 0) {
            return this.asks[this.asks.length - 1];
        }
        return [0,0];
    }

    getLastBids() {
        if((this.bids instanceof Array) && this.bids.length > 0) {
            return this.bids[this.bids.length - 1];
        }
        return [0,0];
    }


}

exports = module.exports = Depth;
