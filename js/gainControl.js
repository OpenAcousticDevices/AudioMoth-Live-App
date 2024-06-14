/****************************************************************************
 * gainControl.js
 * openacousticdevices.info
 * May 2024
 *****************************************************************************/

const electron = require('electron');

const nightMode = require('./js/standard/nightMode');

const audioMothUsbMicrophoneCmd = require('audiomoth-usb-microphone-cmd');

const paginationButtons = require('./js/paginationButtons');

const gainPagination = document.getElementById('gain-pagination');
const gainValues = [0, 1, 2, 3, 4];
const rangePagination = document.getElementById('range-pagination');
const rangeValues = [true, false];

const restoreButton = document.getElementById('restore-button');

let isSimulating = false;

function updateSettings () {

    const gainValue = paginationButtons.getActiveValue(gainPagination, gainValues);
    const rangeValue = paginationButtons.getActiveValue(rangePagination, rangeValues);

    if (gainValue !== undefined && rangeValue !== undefined) {

        audioMothUsbMicrophoneCmd.update(gainValue, rangeValue, (result) => {

            console.log(result);

        });

    }

}

function clearUI () {

    paginationButtons.removeActiveButton(gainPagination);
    paginationButtons.removeActiveButton(rangePagination);

    document.activeElement.blur();

}

function disableUI () {

    clearUI();

    paginationButtons.disableAll(gainPagination);
    paginationButtons.disableAll(rangePagination);
    restoreButton.disabled = true;

}

function enableUI () {

    paginationButtons.enableAll(gainPagination);
    paginationButtons.enableAll(rangePagination);
    restoreButton.disabled = false;

}

paginationButtons.initButtons(gainPagination, updateSettings);
paginationButtons.initButtons(rangePagination, updateSettings);

restoreButton.addEventListener('click', () => {

    audioMothUsbMicrophoneCmd.restore((result) => {

        console.log(result);

        readSettings();

    });

});

function parseListEntry (line) {

    const lineSplit = line.split(' ');

    let gain = -1;
    let lgr = false;
    let success = false;

    for (let i = 0; i < lineSplit.length; i++) {

        const trimmedVal = lineSplit[i].replace(/\s+/g, ' ').trim();

        if (trimmedVal === 'gain' && i + 1 < lineSplit.length) {

            gain = parseInt(lineSplit[i + 1]);
            success = true;

        }

        if (trimmedVal === 'lgr') {

            lgr = true;

        }

    }

    return {
        success,
        gain,
        lgr
    };

}

function updateUI (settings) {

    paginationButtons.selectActiveButton(gainPagination, settings.gain);
    paginationButtons.selectActiveButton(rangePagination, settings.lgr ? 0 : 1);

}

function readSettings () {

    if (isSimulating) {

        return;

    }

    audioMothUsbMicrophoneCmd.read((result) => {

        console.log(result);

        enableUI();

        if (result === null || result.includes('[ERROR]') || isSimulating) {

            disableUI();

            return;

        }

        const splitResult = result.split('\n');

        // Check if single or multiple devices are connected

        if (splitResult.length === 3) {

            // Check for an error or warning

            if (splitResult[1].includes('[WARNING]') || splitResult[1].includes('[ERROR]')) {

                disableUI();

                return;

            }

            // If a single device is connected, update the UI to show its settings

            const deviceSettings = parseListEntry(splitResult[1]);

            if (deviceSettings.success) {

                updateUI(deviceSettings);

            } else {

                disableUI();

            }

        } else {

            // If multiple devices are connected, check to see if their settings are all the same

            let currentSettings;
            let success = false;

            for (let i = 1; i < splitResult.length - 1; i++) {

                if (splitResult[i].includes('[WARNING]') || splitResult[i].includes('[ERROR]')) {

                    continue;

                }

                const deviceSettings = parseListEntry(splitResult[i]);

                if (!deviceSettings.success) {

                    continue;

                }

                success = true;

                if (currentSettings === undefined) {

                    currentSettings = deviceSettings;

                } else {

                    if (currentSettings.gain !== deviceSettings.gain || currentSettings.lgr !== deviceSettings.lgr) {

                        // If the settings differ between devices, clear the UI

                        console.log('Device settings differ');

                        clearUI();

                        return;

                    }

                }

            }

            if (!success) {

                // If all devices failed

                disableUI();

                return;

            }

            if (currentSettings) {

                // If the settings are the same on all devices, set the UI to reflect that

                updateUI(currentSettings);

            }

        }

    });

}

electron.ipcRenderer.on('night-mode', (e, nm) => {

    if (nm !== undefined) {

        nightMode.setNightMode(nm);

    } else {

        nightMode.toggle();

    }

});

electron.ipcRenderer.on('poll-night-mode', () => {

    electron.ipcRenderer.send('night-mode-poll-reply', nightMode.isEnabled());

});

electron.ipcRenderer.on('get-settings', readSettings);

electron.ipcRenderer.on('is-simulating', (e, is) => {

    isSimulating = is;

    if (isSimulating) {

        disableUI();

    }

});

readSettings();
