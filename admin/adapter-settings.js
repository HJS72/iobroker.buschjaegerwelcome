'use strict';

let settings = {};

// Load settings from adapter config
function load(settings, onDone) {
    window.settings = settings;
    
    // Populate form fields from settings
    $('#gatewayIp').val(settings.gatewayIp || '');
    $('#gatewayPort').val(settings.gatewayPort || 80);
    $('#username').val(settings.username || '');
    $('#password').val(settings.password || '');
    $('#sipPort').val(settings.sipPort || 5060);
    $('#pollInterval').val(settings.pollInterval || 30);
    $('#doorOpenDuration').val(settings.doorOpenDuration || 5);

    if (onDone && typeof onDone === 'function') {
        onDone();
    }
}

// Save settings back to adapter config
function save(callback) {
    // Collect form values
    const newSettings = {
        gatewayIp: $('#gatewayIp').val() || '',
        gatewayPort: parseInt($('#gatewayPort').val()) || 80,
        username: $('#username').val() || '',
        password: $('#password').val() || '',
        sipPort: parseInt($('#sipPort').val()) || 5060,
        pollInterval: parseInt($('#pollInterval').val()) || 30,
        doorOpenDuration: parseInt($('#doorOpenDuration').val()) || 5
    };

    // Send to ioBroker backend
    if (typeof sendTo === 'function') {
        sendTo(null, 'save', newSettings, function (result) {
            if (typeof callback === 'function') {
                callback();
            }
        });
    } else if (typeof callback === 'function') {
        callback();
    }
}

// Bind save button
$(document).ready(function () {
    $('#save').click(function () {
        save();
    });

    $('#cancel').click(function () {
        if (typeof load === 'function') {
            load(window.settings, function () {});
        }
    });
});
