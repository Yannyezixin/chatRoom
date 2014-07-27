var fs = require('fs'),
    path = require('path'),
    sio = require('socket.io'),
    static = require('node-static');

var file = new static.Server(path.join(__dirname, '..', 'public'));
var mchat = require('http').createServer(function(req, res) {
    file.serve(req, res);
}).listen(3000);
var io = sio.listen(mchat),
    nicknames ={};

io.sockets.on('connection', function (socket) {
    socket.on('user message', function (msg) {
        socket.broadcast.emit('user message', socket.nickname, msg);
    });
    socket.on('nickname', function (nick, fn) {
        if (nicknames[nick]) {
            fn(true);
        } else {
            fn(false);
            nicknames[nick] = socket.nickname = nick;
            socket.broadcast.emit('announcement', nick + ' 进入房间');
            io.sockets.emit('nicknames', nicknames);
        }
    });

    socket.on('disconnect', function () {
        if (!socket.nickname) {
            return;
        }
        delete nicknames[socket.nickname];
        socket.broadcast.emit('announcement', socket.nickname + ' 离开房间');
        socket.broadcast.emit('nicknames', nicknames);
    })
});
