(function() {
    var sig_field = $('#signature');
    var sig = '';
    sig_field
        .on('mousedown', function(e) {
            var last_position = {
                x: e.clientX - $(this).offset().left,
                y: e.clientY - $(this).offset().top
            };
            sig_field.on('mousemove', function(e) {
                e.stopPropagation();
                var ctx = sig_field[0].getContext('2d');
                ctx.strokeStyle = '#96e2d1';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(last_position.x, last_position.y);
                ctx.lineTo(
                    e.clientX - $(this).offset().left,
                    e.clientY - $(this).offset().top
                );
                last_position = {
                    x: e.clientX - $(this).offset().left,
                    y: e.clientY - $(this).offset().top
                };

                ctx.stroke();
                ctx.closePath();
            });
        })

        .on('mouseup', function(e) {
            sig_field.off('mousemove');
        });
    //
    $('button').on('click', function(e) {
        params = {};

        params['signature'] = sig_field[0].toDataURL();

        sendData(params, '/petition');
    });

    function sendData(params, url) {
        var token = $('#_csrf').attr('value');
        var xhr = $.ajax({
            type: 'POST',
            url: url,
            dataType: 'json',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('x-csrf-token', token);
            },
            contentType: 'application/json',
            data: JSON.stringify(params),
            success: function(response) {
                if (response.result == 'redirect') {
                    //redirect
                    window.location.replace(response.url);
                }
            }
        });
    }
})();
