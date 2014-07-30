var fs = require('fs'),
    path = require('path'),
    sio = require('socket.io'),
    static = require('node-static'),
    uuid = require('node-uuid');
    Room = require('./room.js'),
    _ = require('underscore')._;

var file = new static.Server(path.join(__dirname, '..', 'public'));
var mchat = require('http').createServer(function(req, res) {
    file.serve(req, res);
}).listen(3000);

var io = sio.listen(mchat),
    people = {},
    rooms = {},
    sockets = [],
    nicknames ={};

io.set("log level", 1);

io.sockets.on('connection', function (socket) {
    socket.on('sendmessage', function (msg) {
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
            if (people[socket.id].inroom) {
                console.log(socket.room);
                socket.broadcast.in(socket.room).emit('user message', socket.nickname, msg);
            } else {
                socket.emit('announcement', '请先选择一个聊天室加入');
            }
        }
    });
    socket.on('nickname', function (nick, fn) {
        var ownerRoomID = inRoomID = null;
        if (nicknames[nick]) {
            fn(true);
        } else {
            fn(false);
            people[socket.id] = {"name": nick, "owns": ownerRoomID, "inroom": inRoomID};
            nicknames[nick] =  socket.nickname = nick;
            sizeRooms = _.size(rooms);
            socket.emit('roomList', {rooms: rooms, count: sizeRooms});
            socket.broadcast.emit('announcement', nick + ' 进入M-Chat');
            io.sockets.emit('nicknames', nicknames);
            sockets.push(socket);
        }
    });

    socket.on('disconnect', function () {
        if (!socket.nickname) {
            return;
        }
        purge(socket, 'disconnect');
        delete nicknames[socket.nickname];
        delete people[socket.id];
        var o = _.findWhere(sockets, {'id': socket.id});
        sockets = _.without(sockets, o);
        socket.broadcast.emit('announcement', socket.nickname + ' 离开M-Chat');
        socket.broadcast.emit('nicknames', nicknames);
    })

    socket.on('check', function (name, fn) {
        var match = false;
        _.find(rooms, function(key, value) {
            if (key.name === name) {
                return match = true;
            }
        });
        fn({result: match});
    });

    socket.on('createRoom', function(roomName) {
        if (people[socket.id].inroom) {
            socket.emit('announcement', '你已经在聊天室中，请先退出聊天室');
        } else if (!people[socket.id].owns) {
            var id = uuid.v4();
            var room = new Room(roomName, id, socket.id);
            var roomPeopleName = [];
            rooms[id] = room;
            sizeRooms = _.size(rooms);
            io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
            socket.room = roomName;
            console.log(socket.room);
            socket.join(socket.room);
            people[socket.id].owns = id;
            people[socket.id].inroom = id;
            room.addPerson(socket.id);
            roomPeopleName.push(people[socket.id].name);
            console.log(roomPeopleName[0]);
            socket.emit('sendRoomID', {id: id});
            socket.emit('announcement', "欢迎来到 " + room.name + ".");
            socket.emit('roomStatus', {roomName: room.name, roomStatus: roomPeopleName})
        } else {
            socket.emit('announcement', "你已经建立了聊天室，请先退出");
        }
    });

    socket.on('joinRoom', function (id) {
        var room = rooms[id];
        if (socket.id === room.owner) {
            socket.emit("announcement", "你建立了这个聊天室并且已经在该聊天室中");
        } else {
            if (_.contains((room.people), socket.id)) {
                socket.emit("announcement", '你已经加入这个聊天室');
            } else {
                if (people[socket.id].inroom !== null) {
                    socket.emit("announcement", '你已经加入了(' + rooms[people[socket.id].inroom].name + '), 请先退出聊天室' );
                } else {
                    var roomPeopleName = [];
                    room.addPerson(socket.id);
                    for (var i = 0; i < room.people.length; i++) {
                        roomPeopleName.push(people[room.people[i]].name);
                        console.log(roomPeopleName[i]);
                    }
                    people[socket.id].inroom = id;
                    socket.room = room.name;
                    socket.join(socket.room);
                    user = people[socket.id];
                    io.sockets.in(socket.room).emit("announcement", user.name + '进入' + room.name + '聊天室');
                    socket.emit('sendRoomID', {id: id});
                    socket.emit('announcement', '欢迎来到' + room.name);
                    io.sockets.in(socket.room).emit('roomStatus', {roomName: room.name, roomStatus: roomPeopleName});
                }
            }
        }
    });

    socket.on('leaveRoom', function (roomID) {
        var room = rooms[roomID];
        if (room) {
            purge(socket, 'leaveRoom');
        }
    });
});

function purge (s, action) {
    if (people[s.id].inroom) {
        var room = rooms[people[s.id].inroom];
        if (s.id == room.owner) {
            if (action === 'disconnect') {
                s.broadcast.in(room.name).emit('announcement', room.name + '聊天室建立人' + people[s.id].name + '离开M-Chat, 所以你们也退出了聊天室');
                var socketids = [];
                for (var i = 0; i < sockets.length; i++) {
                    socketids.push(sockets[i].id);
                    if (_.contains((socketids), room.people)) {
                        sockets[i].leave(room.name);
                    }
                }

                if (_.contains((room.people), s.id)) {
                    for (var i = 0; i < room.people.length; i++) {
                        people[room.people[i]].inroom = null;
                    }
                }
                delete rooms[people[s.id].owns];
                sizeRooms = _.size(rooms);
                io.sockets.emit('roomList', {rooms: rooms, count: sizeRooms});
            } else {
                s.broadcast.in(room.name).emit('announcement', room.name + '聊天室建立人' + people[s.id].name + '退出该聊天室, 所以你们也退出了聊天室');
                s.emit('announcement', '你退出了' + room.name + '聊天室');
                var socketids = [];
                for (var i = 0; i < sockets.length; i++) {
                    socketids.push(sockets[i].id);
                    if (_.contains((socketids), room.people)) {
                        sockets[i].leave(room.name);
                    }
                }

                if (_.contains((room.people), s.id)) {
                    for (var i = 0; i < room.people.length; i++) {
                        people[room.people[i]].inroom = null;
                    }
                }
                delete rooms[people[s.id].owns];
                people[s.id].owns = null;
                sizeRooms = _.size(rooms);
                io.sockets.emit('roomList', {rooms: rooms, count: sizeRooms});
            }
            io.sockets.in(room.name).emit('clearRoomStatus');
        } else {
            if (action === 'disconnect') {
                s.broadcast.in(room.name).emit("announcement", people[s.id].name + ' 离开' + room.name + '聊天室');
                if (_.contains((room.people), s.id)) {
                    var personIndex = room.people.indexOf(s.id);
                    room.people.splice(personIndex, 1);
                    s.leave(room.name);
                }
            } else {
                if (_.contains((room.people), s.id)) {
                    var personIndex = room.people.indexOf(s.id);
                    room.people.splice(personIndex, 1);
                    people[s.id].inroom = null;
                    s.broadcast.in(room.name).emit('announcement', people[s.id].name + ' 离开了聊天室');
                    s.emit('announcement', '你已经离开了 '+ room.name + ' 聊天室');
                    s.leave(room.name);
                    s.emit('clearRoomStatus');
                }
            }
            var roomPersonName = [];
            for(var i = 0; i < room.people.length; i++) {
                roomPersonName.push(people[room.people[i]].name);
            }
            io.sockets.in(room.name).emit('roomStatus', {roomName: room.name, roomStatus: roomPersonName});
        }
    }
}
