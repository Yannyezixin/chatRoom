var fs = require('fs'),
    path = require('path'),
    sio = require('socket.io'),
    static = require('node-static'),
    _ = require('underscore')._;

var file = new static.Server(path.join(__dirname, '..', 'public'));
var mchat = require('http').createServer(function(req, res) {
    file.serve(req, res);
}).listen(3000);
var io = sio.listen(mchat),
    people = {},
    nicknames ={};

io.sockets.on('connection', function (socket) {
    socket.on('user message', function (msg) {
        var re = /^[@]:.*:/;
        var whisper = re.test(msg);
        var whisperStr = msg.split(":");
        var found = false;
        if (whisper) {
            var whisperTo = whisperStr[1];
            var keys = Object.keys(people);
            if (keys.length != 0) {
                for (var i = 0; i < keys.length; i++) {
                    if (people[keys[i]].name === whisperTo) {
                        var whisperId = keys[i];
                        found = true;
                        if (socket.id === whisperId) {
                            socket.emit("announcement", "你不能给自己发送私密信息");
                        }
                        break;
                    }
                }
            }
            if (found && socket.id !== whisperId) {
                var whisperMsg = whisperStr[2];
                io.sockets.connected[whisperId].emit("whisper", socket.nickname, "私密(" + whisperMsg + ")");
            } else if (!found) {
                socket.emit("announcement", "不能找到 " + whisperTo);
            }
        } else {
            socket.broadcast.emit('user message', socket.nickname, msg);
        }
    });
    socket.on('nickname', function (nick, fn) {
        if (nicknames[nick]) {
            fn(true);
        } else {
            fn(false);
            people[socket.id] = {"name": nick};
            nicknames[nick] =  socket.nickname = nick;
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
