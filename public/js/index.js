var socket = io.connect();
var localstatus = false;
var messageRight = false;
socket.on('connect', function () {
    $('#chat').addClass('connected');
});
socket.on('user message',message);
socket.on('announcement', function (msg) {
    if (localstatus) {
        $('#content').append($('<p>').text(msg));
    }
});

socket.on('nicknames', function (nicknames) {
    if (localstatus) {
        $('#nicknames').empty().append($('<span>在线: </span>'));
        $('#send-message').css('visibility', 'visible');
        for (var i in nicknames) {
            $('#nicknames').append($('<b>').text(nicknames[i]));
        }
    }
});

$(function () {
    $('#set-nickname').submit(function () {
        if ($('#nick').val() !== '') {
            socket.emit('nickname', $('#nick').val(), function(set) {
                if (!set) {
                    clear();
                    localstatus = true;
                    return $('#chat').addClass('nickname-set');
                }
                $('#nickname-error').css('visibility', 'visible');
            });
        }
        return false;
    });
    $('#send-message').submit(function () {
        messageRight = true;
        message('me', $('#message').val());
        socket.emit('user message', $('#message').val());
        clear();
        return false;
    });
    function clear () {
        $('#message').val('').focus();
    };
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
