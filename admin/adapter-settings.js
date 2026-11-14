// ioBroker Admin5 jsonConfig-based settings handler
'use strict';

let settings = {};

// Load settings from native config
function load(settings, onDone) {
    // ioBroker automatically populates the form from native config
    // This function is called by the adapter settings framework
    window.settings = settings;
    
    if (typeof onDone === 'function') {
        onDone();
    }
}

// Save settings back to native config
function save(callback) {
    // ioBroker automatically collects form values and saves to native config
    // This callback is called by the framework
    if (typeof callback === 'function') {
        callback();
    }
}

// Change handler (auto-detect changes)
function onChange(id, newVal, oldVal) {
    // Called when any setting changes in the UI
    console.log(`Setting changed: ${id} = ${newVal}`);
}
