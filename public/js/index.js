var socket = io.connect();
var localstatus = false;
var messageRight = false;

socket.on('connect', function () {
    $('#chat').addClass('connected');
});

socket.on('user message',message);

socket.on('whisper',message);

socket.on('announcement', function (msg) {
    if (localstatus) {
        $('#content').append($('<p>').append($('<b>').text(msg)));
    }
});

socket.on('roomStatus', function (data) {
    if (localstatus) {
        $('#roomStatus').empty().append($('<span>位于聊天室: ' + data.roomName + '</span>'));
        $('#roomStatus').append($('<span>').text(' 建立人：' + data.roomStatus[0] + '. 成员:'));
        for (var i = 0; i < data.roomStatus.length; i++) {
            $('#roomStatus').append($('<b>').text(data.roomStatus[i]));
        }
    }
});

socket.on('clearRoomStatus', function () {
    $('#roomStatus').empty();
});

socket.on('nicknames', function (nicknames) {
    if (localstatus) {
        $('#nicknames').empty().append($('<span>在线: </span>'));
        $('#send-message').css('visibility', 'visible');
        for (var i in nicknames) {
            $('#nicknames').append($('<b>').append($('<a class="whisper" href="#">').text('@'), $('<span>').text(nicknames[i])));
        }
    }
});

socket.on('roomList', function (data) {
    $("#roomlists").text("");
    $('#roomNum').append('<b>').text(data.count);
    if (!jQuery.isEmptyObject(data.rooms)) {
        $.each(data.rooms, function (id, room) {
            var html = '<button class="joinRoomBtn" id=' + id + '>加入</button>';
            $('#roomlists').append('<tr><td id=' + id + '>' + room.name + '</td><td>' + html + '</td>');
        })
    } else {
        $('#roomlists').append('<tr><td>没有在线的聊天室</td></tr>');
    }
});

socket.on('sendRoomID', function(data) {
    myRoomID = data.id;
});

$(function () {
    $('#nick').focus();
    $('#set-nickname').submit(function () {
        if ($('#nick').val() !== '') {
            socket.emit('nickname', $('#nick').val(), function(set) {
                if (!set) {
                    clear();
                    localstatus = true;
                    $('#roomlist').css('visibility', 'visible');
                    return $('#chat').addClass('nickname-set');
                }
                $('#nickname-error').css('visibility', 'visible');
            });
        }
        return false;
    });
    $('#send-message').submit(function () {
        if ($('#message').val() !== '') {
            messageRight = true;
            message('me', $('#message').val());
            socket.emit('sendmessage', $('#message').val());
            clear();
        }
        return false;
    });

    function clear () {
        $('#message').val('').focus();
    };

    $("#nicknames").on('click','a', function () {
        var name = $(this).siblings("span").text();
        $("#message").val("@:" + name + ":");
        $("#message").focus();
    });

    $('#action').click(function () {
        if ($('#option').css('visibility') == 'visible') {
            $('#option').css('visibility', 'hidden');
        } else {
            $('#option').css('visibility', 'visible');
        }
    });

    $('#roomlists').on('click', '.joinRoomBtn', function () {
        var roomID = $(this).attr("id");
        socket.emit("joinRoom", roomID);
    });

    $('#exitroom').click(function () {
        var roomID = myRoomID;
        socket.emit('leaveRoom', roomID);
    });

    $('#set-roomname').submit(function () {
        if ($('#roomName').val()) {
            var roomExists = false;
            var roomName = $('#roomName').val();
            socket.emit('check', roomName, function (data) {
                roomExists = data.result;
                if (roomExists) {
                    $('#content').append($('<p>').text('聊天室已经存在'));
                } else {
                    alert(roomName);
                    socket.emit("createRoom", roomName);
                }
            });
        }
        return false;
    });
});

function message (from, msg) {
    if (localstatus) {
        var date = new Date();
        var time = (date.getMonth() + 1) + '-' +
                   date.getDate() + '  ' +
                   date.getHours() + ':' +
                   date.getMinutes() + ':' +
                   date.getSeconds();
        if (messageRight) {
            var site = '<p class="right">';
            messageRight = false;
        } else {
            var site = '<p>';
        }
        $('#content').append($(site).append($('<em>').text(time)));
        $('#content').append($(site).append($('<b>').text(from + ': '), msg));
        $('#content').get(0).scrollTop = 100000000;
    }
}
