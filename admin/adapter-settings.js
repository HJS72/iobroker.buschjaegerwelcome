// Global settings object and load/save callbacks
let settings = {};

function onChange() {
	// Mark settings as changed (used by ioBroker)
	if (typeof sendTo === 'function') {
		// ioBroker will call save() when needed
	}
}

function load(settings, onDone) {
	// Load settings from the admin panel
	if (!settings) return;
	
	// Map settings to form fields
	document.getElementById('gatewayIp').value = settings.gatewayIp || '';
	document.getElementById('gatewayPort').value = settings.gatewayPort || '80';
	document.getElementById('username').value = settings.username || '';
	document.getElementById('password').value = settings.password || '';
	document.getElementById('sipPort').value = settings.sipPort || '5060';
	document.getElementById('pollInterval').value = settings.pollInterval || '60';
	document.getElementById('doorOpenDuration').value = settings.doorOpenDuration || '5';

	// Reinitialize materialize text fields
	M.updateTextFields();

	// Call the provided callback
	if (onDone && typeof onDone === 'function') {
		onDone();
	}
}

function save(callback) {
	// Collect settings from form fields
	const newSettings = {
		gatewayIp: document.getElementById('gatewayIp').value || '',
		gatewayPort: parseInt(document.getElementById('gatewayPort').value) || 80,
		username: document.getElementById('username').value || '',
		password: document.getElementById('password').value || '',
		sipPort: parseInt(document.getElementById('sipPort').value) || 5060,
		pollInterval: parseInt(document.getElementById('pollInterval').value) || 60,
		doorOpenDuration: parseInt(document.getElementById('doorOpenDuration').value) || 5,
	};

	// Send to ioBroker backend
	if (typeof sendTo === 'function') {
		sendTo(null, 'save', newSettings, function (result) {
			if (result.error) {
				showError(result.error);
			} else {
				showMessage('Settings saved successfully');
				if (callback && typeof callback === 'function') {
					callback(newSettings);
				}
			}
		});
	} else {
		// Fallback: store locally (for testing without ioBroker)
		console.log('Saved settings:', newSettings);
		if (callback && typeof callback === 'function') {
			callback(newSettings);
		}
	}
}

function showMessage(msg) {
	if (typeof M !== 'undefined' && M.toast) {
		M.toast({ html: msg, displayLength: 3000 });
	} else {
		alert(msg);
	}
}

function showError(msg) {
	if (typeof M !== 'undefined' && M.toast) {
		M.toast({ html: '<span style="color: #f44336;">' + msg + '</span>', displayLength: 5000 });
	} else {
		alert('Error: ' + msg);
	}
}
