'use strict';

let settings = {};
let changed = false;

// Load settings from adapter config
function load(settings, onDone) {
    window.settings = settings;
    changed = false;
    
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

// Change handler - marks settings as changed
function onChange() {
    changed = true;
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
            changed = false;
            if (typeof callback === 'function') {
                callback();
            }
        });
    } else if (typeof callback === 'function') {
        callback();
    }
}

// Bind change handlers to all inputs
$(document).ready(function () {
    // Translate labels
    if (typeof translateAll === 'function') {
        translateAll();
    }

    // Track changes on all .value inputs
    $('.value').on('change input', function () {
        onChange();
    });
});
