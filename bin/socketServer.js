const WebSocket = require('ws');

class SocketServer {
    constructor(port = 8080) {
        const self = this;
        this.wss = new WebSocket.Server({ port });
        this.clients = [];

        this.wss.on('connection', function connection(ws) {
            ws.on('message', function incoming(message) {
                console.log('receive message:' + message);
                const mess = JSON.parse(message);
                const channels = mess.channel.split('/');

                if(channels.length < 2) return;
                switch (channels[0]){
                    case 'subscribe':
                    default:
                        self.clients.push({
                            type: mess.channel,
                            filter: mess.data,
                            ws
                        });
                        break;
                }
            });
        });
    }

    send(mess) {
        const { channel, data } = mess;
        this.clients.forEach(function each(client) {
            const { type, filter, ws } = client;
            if (type === channel){
                if (ws.isAlive === false || ws.readyState === 3) return ws.terminate();

                if (
                    type === 'subscribe/candle60s' && 
                    filter.exchange === data.exchange && 
                    filter.market === data.market
                ) ws.send(JSON.stringify(mess));

                if (
                    (
                        type === 'subscribe/exchange' ||
                        type === 'subscribe/bot' ||
                        type === 'subscribe/profit' ||
                        type === 'subscribe/bot_log' ||
                        type === 'subscribe/trade_active'
                    ) &&
                    parseInt(filter.id) === parseInt(data.id)
                ) ws.send(JSON.stringify(mess));
            }
        });
    }
}

exports = module.exports = SocketServer;