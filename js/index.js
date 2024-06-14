/****************************************************************************
 * index.js
 * openacousticdevices.info
 * September 2022
 *****************************************************************************/

/* global FileReader */

const electron = require('electron');
const {app, dialog, getCurrentWindow, shell} = require('@electron/remote');
const fs = require('fs');
const path = require('path');

const currentWindow = getCurrentWindow();

const backstage = require('backstage');

const nightMode = require('./js/standard/nightMode');
const versionChecker = require('./js/standard/versionChecker');
const twoOption = require('./js/standard/twoOptionModal');

const constants = require('./js/constants');

const frequencyDisplay = require('./js/frequencyDisplay');
const timeDisplay = require('./js/timeDisplay');

const drawSVG = require('./js/drawSVG');
const plotter = require('./js/plotter');
const exportPlotter = require('./js/exportPlotter');
const paginationButtons = require('./js/paginationButtons');

const colourMap = require('./js/colourMap.js');

/* UI elements */

const inputSpan = document.getElementById('input-span');

const waveformBaselineSVG = document.getElementById('waveform-baseline-svg');
const waveformBorder = document.getElementById('waveform-resizable-border-div');
const waveformCanvas = document.getElementById('waveform-canvas');

waveformCanvas.height = waveformBorder.offsetHeight;

const spectrogramCanvas = document.getElementById('spectrogram-canvas');
const spectrogramBorder = document.getElementById('spectrogram-resizable-border-div');
const spectrogramHeterodyneSVG = document.getElementById('spectrogram-heterodyne-svg');

spectrogramCanvas.height = spectrogramBorder.offsetHeight;

const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const pausePlayButton = document.getElementById('pause-play-button');

const clearButton = document.getElementById('clear-button');

const savePlotButton = document.getElementById('save-plot-button');
const exportPNGButton = document.getElementById('export-png-button');
const exportJPGButton = document.getElementById('export-jpg-button');
const exportPDFButton = document.getElementById('export-pdf-button');
const exportAllButton = document.getElementById('export-all-button');
const exportCloseButton = document.getElementById('export-close-button');

const captureButton = document.getElementById('capture-wav-button');

const heterodyneUpButton = document.getElementById('heterodyne-up-button');
const heterodyneDownButton = document.getElementById('heterodyne-down-button');
const heterodyneSpan = document.getElementById('heterodyne-span');
const khzSpan = document.getElementById('khz-span');

/* Constants which control the starting delay between hold action increments and the rate at which it accelerates */

const HOLD_DELAY_MULTIPLIER = 0.99;
const HOLD_INITIAL_DELAY = 150;

/* Pagination elements */

const sampleRatePagination = document.getElementById('sample-rate-pagination');
const sampleRateValues = [8000, 16000, 32000, 48000, 96000, 192000, 250000, 384000];
const displayWidthPagination = document.getElementById('display-width-pagination');
const displayWidthValues = [1, 5, 10, 20, 60];
const autosaveLengthPagination = document.getElementById('autosave-length-pagination');
const autosaveLengthValues = [-1, 1, 5, 10, 60]; // -1 = off
const monitorPagination = document.getElementById('monitor-pagination');
const monitorValues = [0, 1, 2]; // Off, Monitor, Heterodyne

/* Error window elements */

// eslint-disable-next-line no-undef
const errorModal = new bootstrap.Modal(document.getElementById('error-modal'), {
    backdrop: 'static',
    keyboard: false
});
const errorTitle = document.getElementById('error-modal-title');
const errorBody = document.getElementById('error-modal-body');
const errorOkayButton = document.getElementById('error-modal-okay-button');
const errorDontShowHolder = document.getElementById('error-dont-show-holder');
const errorDontShowCheckbox = document.getElementById('error-dont-show-checkbox');

let errorOkayCallback;

let dontShowOldDeviceError = false;

/* Variables */

let stftBuffer;
let audioBuffer;

let currentSampleRate = 48000;

let heterodyneFrequencyMax = currentSampleRate / 2;
const heterodyneFrequencyMin = 12000;
let heterodyneFrequency = heterodyneFrequencyMax / 2;

let fileName;

let displayWidthChanged = false;
let displayWidth = displayWidthValues[2];

let canvasSizeChanged = false;

const RESIZE_END_DELAY = 50;

const TARGET_FRAME_RATE = 60;
const MILLISECOND_IN_SECOND = 1000;
const FRAME_INTERVAL = MILLISECOND_IN_SECOND / TARGET_FRAME_RATE;

let resizeTimer;

let paused = false;
let resizing = false;

let monitorMode = backstage.MONITOR_OFF;

// eslint-disable-next-line no-unused-vars
let frameCounter = 0;
let lastFrameSeconds = 0;

let fileDestination;

let simulationInfo;

let displayingAutosaveWarning = false;

let localTimeEnabled = true;

let simulationRunning = false;

let lowAmpColourScaleEnabled = false;
let colourScaleChanged = false;

let colourMapIndex = colourMap.COLOUR_MAP_DEFAULT;

/* Error window displaying */

function displayError (title, body, showDontShowCheckbox, dontShowCheckboxChecked, okayCallback) {

    if (showDontShowCheckbox) {

        errorDontShowHolder.style.display = 'flex';
        errorDontShowCheckbox.checked = dontShowCheckboxChecked;

    } else {

        errorDontShowHolder.style.display = 'none';

    }

    errorTitle.innerHTML = title;
    errorBody.innerHTML = body;

    errorOkayCallback = okayCallback;

    errorModal.show();

}

errorOkayButton.addEventListener('click', (e) => {

    if (errorOkayCallback) {

        errorOkayCallback(e);

        errorOkayCallback = null;

    }

});

/* IPC messaging */

electron.ipcRenderer.on('night-mode', (e, nm) => {

    if (nm !== undefined) {

        nightMode.setNightMode(nm);

    } else {

        nightMode.toggle();

    }

    drawWaveformBaseline();

});

electron.ipcRenderer.on('poll-night-mode', () => {

    electron.ipcRenderer.send('night-mode-poll-reply', nightMode.isEnabled());

});

electron.ipcRenderer.on('high-sample-rate-default', (e, enabled) => {

    backstage.setHighDefaultSampleRate(enabled);

});

electron.ipcRenderer.on('low-amp-colour-scale', (e, enabled) => {

    lowAmpColourScaleEnabled = enabled;

    colourScaleChanged = true;

});

electron.ipcRenderer.on('change-colours', (e, ci) => {

    const colourMapName = colourMap.COLOUR_MAP_NAMES[ci];

    console.log('Changing colour map -', colourMapName);

    colourMapIndex = ci;

    drawWaveformBaseline();

});

function sendSimulationInfo () {

    const simulationPath = app.isPackaged ? path.join(process.resourcesPath, 'simulator') : path.join('.', 'simulator');

    simulationInfo = backstage.getSimulationInfo(simulationPath);
    electron.ipcRenderer.send('simulation-info', simulationInfo);

}

function changeSimulation (index) {

    simulationRunning = index !== -1;

    const simResult = backstage.setSimulation(simulationRunning, index);

    if (simResult) {

        if (simulationRunning) {

            console.log('Switched to simulate:', simulationInfo.descriptions[index]);

        } else {

            console.log('No longer simulating');

        }

        electron.ipcRenderer.send('is-simulating', simulationRunning);

        document.activeElement.blur();

    } else {

        console.error('Switching to simulation failed');

        electron.ipcRenderer.send('simulation-failed');

        displayError('Simulation error', 'Failed to load simulation.');

    }

}

electron.ipcRenderer.on('simulate', (e, index) => {

    if (monitorMode === 0 || index !== -1) {

        changeSimulation(index);

    } else if (twoOption.isChecked()) {

        const buttonText = monitorMode === 1 ? 'Disable Monitor' : 'Disable Heterodyne';

        twoOption.displayTwoOptionCheck('Warning', 'Make sure your microphone is positioned away from your speakers to prevent audio feedback.', 'Continue', () => {

            changeSimulation(index);

        }, buttonText, () => {

            console.log('Monitor off.');
            paginationButtons.selectActiveButton(monitorPagination, 0);
            changeAndSaveMonitorMode(backstage.MONITOR_OFF);

            changeSimulation(index);

        }, true, 'Always display warning');

    } else {

        changeSimulation(index);

    }

});

function endResize () {

    resizing = false;

    console.log('Redrawing plots after a window resize');

    const width = Math.min(waveformBorder.offsetWidth, spectrogramBorder.offsetWidth);

    plotter.resize(width, waveformBorder.offsetHeight, spectrogramBorder.offsetHeight, colourMapIndex);

    waveformBaselineSVG.style.display = '';
    waveformCanvas.style.display = '';

    spectrogramCanvas.style.display = '';

    drawWaveformBaseline();
    updateHeterodyneLine();

    canvasSizeChanged = true;

}

electron.ipcRenderer.on('resize', () => {

    if (resizing) {

        clearTimeout(resizeTimer);

    } else {

        resizing = true;

        drawSVG.clearSVG(waveformBaselineSVG);

        waveformCanvas.style.display = 'none';

        spectrogramCanvas.style.display = 'none';

        frequencyDisplay.clearDisplay();
        timeDisplay.clearDisplay();

    }

    resizeTimer = setTimeout(endResize, RESIZE_END_DELAY);

});

electron.ipcRenderer.on('local-time', (e, enabled) => {

    localTimeEnabled = enabled;

    backstage.setLocalTime(localTimeEnabled);

});

/* Check Github repo for updates */

electron.ipcRenderer.on('update-check', () => {

    versionChecker.checkLatestRelease(function (response) {

        if (response.error) {

            console.error(response.error);

            displayError('Failed checking for updates', response.error);

            return;

        }

        if (response.updateNeeded === false) {

            displayError('Update not needed', 'Your app is on the latest version (' + response.latestVersion + ').');

            return;

        }

        twoOption.displayTwoOption('Download newer version', 'A newer version of this app is available (' + response.latestVersion + '), would you like to download it?', 'Yes', () => {

            electron.shell.openExternal('https://www.openacousticdevices.info/applications');

        }, 'No', () => {

            console.log('Update rejected');

        });

    });

});

electron.ipcRenderer.on('change-save-destination', () => {

    changeFileDestination();

});

/**
 * Detect whether the heterodyne output is enabled
 */
function isHeterodyneEnabled () {

    return paginationButtons.getActiveValue(monitorPagination, monitorValues) === 2;

}

/**
 * Detect whether the monitor output is enabled
 */
function isMonitorEnabled () {

    return paginationButtons.getActiveValue(monitorPagination, monitorValues) === 1;

}

/**
 * Update monitor setting
 * @param {number} mode Which mode to use (MONITOR_OFF, MONITOR_PLAYTHROUGH, MONITOR_HETERODYNE)
 */
function changeAndSaveMonitorMode (mode) {

    monitorMode = mode;

    if (mode === backstage.MONITOR_HETERODYNE) {

        backstage.setMonitor(mode, heterodyneFrequency);

    } else {

        backstage.setMonitor(mode);

    }

}

/**
 * Enable/disable and move line on plot representing heterodyne frequency
 */
function updateHeterodyneLine () {

    drawSVG.clearSVG(spectrogramHeterodyneSVG);

    // If heterodyne mode is actually on

    if (isHeterodyneEnabled()) {

        const w = spectrogramHeterodyneSVG.width.baseVal.value;
        const h = spectrogramHeterodyneSVG.height.baseVal.value;

        const nyquist = currentSampleRate / 2;

        let y = (heterodyneFrequency / nyquist) * h;
        y = h - y;

        // If the line is to be drawn at the very edge, make it slightly more visible

        y = y === 0 ? 1 : y;

        // Offset to 0.5 barrier so line isn't anti-aliased

        y = Math.round(y) + 0.5;

        drawSVG.addSVGLine(spectrogramHeterodyneSVG, 0, y, w, y, 'white');

    }

}

/**
 * Enable or disable heterodyne buttons from selecting incorrect values
 */
function checkHeterodyneButtons () {

    heterodyneUpButton.disabled = (heterodyneFrequency + 100 > heterodyneFrequencyMax);

    heterodyneDownButton.disabled = (heterodyneFrequency - 100 < heterodyneFrequencyMin);

}

/**
 * Enable heterodyne sample rate buttons according to currently selected sample rate
 */
function updateHeterodyneUI (reset) {

    const sampleRate = currentSampleRate;

    heterodyneFrequencyMax = sampleRate / 2;

    heterodyneFrequency = (reset || sampleRate < 48000) ? sampleRate / 4 : heterodyneFrequency;

    // Disable heterodyne UI if sample rate is less than 48 kHz

    if (!isHeterodyneEnabled()) {

        heterodyneUpButton.disabled = true;
        heterodyneDownButton.disabled = true;

        heterodyneSpan.innerText = (heterodyneFrequency / 1000).toFixed(1);
        heterodyneSpan.classList.add('grey');
        khzSpan.classList.add('grey');

    } else {

        heterodyneUpButton.disabled = false;
        heterodyneDownButton.disabled = false;

        heterodyneSpan.classList.remove('grey');
        khzSpan.classList.remove('grey');

        heterodyneSpan.innerText = (heterodyneFrequency / 1000).toFixed(1);

        checkHeterodyneButtons();

        changeAndSaveMonitorMode(backstage.MONITOR_HETERODYNE);

    }

    updateHeterodyneLine();

}

/**
 * Disable sample rates above the current device's sample rate (you can't downsample up)
 */
function updateSampleRateButtons (currentSampleRate, maximumSampleRate) {

    for (let i = 0; i < sampleRateValues.length; i++) {

        let buttonEnabled = true;

        if (!simulationRunning && sampleRateValues[i] > maximumSampleRate) {

            buttonEnabled = false;

        }

        if (simulationRunning && sampleRateValues[i] !== currentSampleRate) {

            buttonEnabled = false;

        }

        if (buttonEnabled) {

            paginationButtons.enableButton(sampleRatePagination, i);

        } else {

            paginationButtons.disableButton(sampleRatePagination, i);

        }

        if (sampleRateValues[i] === currentSampleRate) {

            paginationButtons.selectActiveButton(sampleRatePagination, i);

        }

    }

}

/**
 * Draw a line across the centre of the waveform plot
 */
function drawWaveformBaseline () {

    drawSVG.clearSVG(waveformBaselineSVG);

    const w = waveformBaselineSVG.width.baseVal.value;
    const h = waveformBaselineSVG.height.baseVal.value;

    let colour;

    if (colourMapIndex === colourMap.COLOUR_MAP_DEFAULT) {

        colour = nightMode.isEnabled() ? 'white' : 'black';

    } else {

        colour = 'grey';

    }

    const y = Math.floor(h / 2) + 0.5;

    drawSVG.addSVGLine(waveformBaselineSVG, 0, y, w, y, colour);

}

/**
 * Main display update function
 */
function updateDisplay () {

    let redraw = false;

    const result = backstage.getFrame();

    if (result.oldAudioMothFound && !dontShowOldDeviceError) {

        let outdatedWarningText = 'The AudioMoth USB Microphone firmware running on your AudioMoth device is out of date. Download the ';
        outdatedWarningText += '<a href="#" id="firmware-link">latest version</a>';
        outdatedWarningText += ' and flash it using the AudioMoth Flash App.';

        displayError('Outdated firmware', outdatedWarningText, true, dontShowOldDeviceError, () => {

            dontShowOldDeviceError = errorDontShowCheckbox.checked;

        });

        const firmwareLink = document.getElementById('firmware-link');

        firmwareLink.addEventListener('click', () => {

            shell.openExternal('https://www.openacousticdevices.info/usb-microphone');

        });

    }

    simulationRunning = result.simulationRunning;

    if (result.redrawRequired) {

        // Notify gain window that device has changed

        electron.ipcRenderer.send('redraw');

        const oldDeviceName = inputSpan.innerText;
        const newDeviceName = result.deviceName;

        // If Default Input -> AUM or AUM -> Default Input, disable monitor/heterodyne to prevent accidental feedback

        if (!oldDeviceName.includes('Simulated') && !newDeviceName.includes('Simulated')) {

            if ((oldDeviceName.includes('Default Input') && newDeviceName.includes('AudioMoth USB Microphone')) || (newDeviceName.includes('Default Input') && oldDeviceName.includes('AudioMoth USB Microphone'))) {

                if (isMonitorEnabled() || isHeterodyneEnabled()) {

                    console.log('Switched between default input and AudioMoth USB Mic, disabling monitor/heterodyne');

                    paginationButtons.selectActiveButton(monitorPagination, 0);
                    changeAndSaveMonitorMode(backstage.MONITOR_OFF);

                }

            }

        }

        const sampleRateChanged = currentSampleRate !== result.currentSampleRate;

        currentSampleRate = result.currentSampleRate;

        inputSpan.innerText = result.deviceName;

        updateSampleRateButtons(currentSampleRate, result.maximumSampleRate);

        if (sampleRateChanged) frequencyDisplay.updateSampleRate(currentSampleRate);

        if (currentSampleRate < 48000) {

            if (isHeterodyneEnabled()) {

                paginationButtons.selectActiveButton(monitorPagination, 1);
                changeAndSaveMonitorMode(backstage.MONITOR_PLAYTHROUGH);

            }

            paginationButtons.disableButton(monitorPagination, 2);

        } else {

            paginationButtons.enableButton(monitorPagination, 2);

        }

        updateHeterodyneUI(sampleRateChanged);

        redraw = true;

    }

    if (displayWidthChanged || canvasSizeChanged || colourScaleChanged) {

        console.log('Redrawing plots');

        timeDisplay.updateDisplayWidth(displayWidth);

        displayWidthChanged = false;
        canvasSizeChanged = false;
        colourScaleChanged = false;

        redraw = true;

    }

    if (!resizing) plotter.update(audioBuffer, stftBuffer, plotter.UPDATE_BOTH, redraw, result.audioIndex, result.audioCount, displayWidth * currentSampleRate, nightMode.isEnabled(), lowAmpColourScaleEnabled, colourMapIndex);

    // Update time display

    const updateTime = result.audioTime;

    timeDisplay.updateTime(updateTime, localTimeEnabled);

    // Update frame rate and set time until next frame

    frameCounter += 1;

    const frameUpdateTime = Date.now();

    const seconds = Math.floor(frameUpdateTime / MILLISECOND_IN_SECOND);

    const milliseconds = frameUpdateTime - seconds * MILLISECOND_IN_SECOND;

    const intervalToNextFrame = FRAME_INTERVAL * Math.ceil(milliseconds / FRAME_INTERVAL) - milliseconds;

    if (seconds !== lastFrameSeconds) {

        lastFrameSeconds = seconds;

        frameCounter = 0;

    }

    setTimeout(updateDisplay, intervalToNextFrame);

}

/**
 * Start the microphone samples and update the display
 */
function startMicrophone () {

    const result = backstage.initialise();

    if (!result.success) {

        displayError('Initialisation error', 'Could not initialise the input device.');

    }

    backstage.setAutoSaveCallback(() => {

        console.log('backstage.setAutoSaveCallback');

        if (!displayingAutosaveWarning) {

            displayingAutosaveWarning = true;

            displayError('Autosave error', 'Failed to save a WAV file. Check the file destination is still valid.', false, false, () => {

                displayingAutosaveWarning = false;

            });

        }

    });

    audioBuffer = result.audioBuffer;

    stftBuffer = result.stftBuffer;

    setTimeout(updateDisplay, 100);

}

/**
 * Open file dialog window and set file destination
 */
function changeFileDestination (callback) {

    const selectedDestination = dialog.showOpenDialogSync(currentWindow, {
        title: 'Set destination for captured files',
        properties: ['openDirectory']
    });

    if (selectedDestination !== undefined) {

        fileDestination = selectedDestination[0];

        console.log('Set file destination to:', fileDestination);

        backstage.setFileDestination(fileDestination);

    }

    if (callback) {

        callback(fileDestination !== undefined);

    }

}

/**
 * Capture the most recent displayWidth samples and save them as a WAV file
 */
function capture () {

    captureButton.disabled = true;

    backstage.capture(displayWidth, (success) => {

        if (!success) {

            displayError('Capture WAV error', 'Failed to capture WAV file. Check the file destination is still valid.');

        }

        function act () {

            captureButton.disabled = false;
            captureButton.focus();

        }

        setTimeout(act, 200);

    });

}

function setPause (newPause) {

    paused = newPause;

    pauseIcon.style.display = paused ? 'none' : '';
    playIcon.style.display = paused ? '' : 'none';

    if (paused) {

        pausePlayButton.classList.remove('btn-danger');
        pausePlayButton.classList.add('btn-success');

        paginationButtons.disableAll(sampleRatePagination);
        paginationButtons.disableAll(displayWidthPagination);
        paginationButtons.disableAll(autosaveLengthPagination);
        clearButton.disabled = true;

    } else {

        pausePlayButton.classList.remove('btn-success');
        pausePlayButton.classList.add('btn-danger');

        paginationButtons.enableAll(sampleRatePagination);
        paginationButtons.enableAll(displayWidthPagination);
        paginationButtons.enableAll(autosaveLengthPagination);
        clearButton.disabled = false;

    }

    electron.ipcRenderer.send('set-paused', paused);

    const pauseResult = backstage.setPause(paused, displayWidth);

    if (pauseResult.audioIndex !== undefined) {

        const recordingDate = new Date(pauseResult.audioStartTime);

        fileName = recordingDate.getUTCFullYear().toString();
        fileName += (recordingDate.getUTCMonth() + 1).toString().padStart(2, '0');
        fileName += recordingDate.getUTCDate().toString().padStart(2, '0');
        fileName += '_';
        fileName += recordingDate.getUTCHours().toString().padStart(2, '0');
        fileName += recordingDate.getUTCMinutes().toString().padStart(2, '0');
        fileName += recordingDate.getUTCSeconds().toString().padStart(2, '0');
        fileName += '_';
        fileName += recordingDate.getUTCMilliseconds().toString().padStart(3, '0');

        exportPlotter.prepare(audioBuffer, stftBuffer, pauseResult.audioIndex, pauseResult.audioCount, displayWidth, currentSampleRate, lowAmpColourScaleEnabled, colourMapIndex);

    }

}

/* Add event listener to pause/play button */

pausePlayButton.addEventListener('click', () => {

    setPause(!paused);

});

document.addEventListener('keydown', (e) => {

    if (e.code === 'KeyP') {

        setPause(!paused);

    }

});

clearButton.addEventListener('click', () => {

    backstage.clear();

});

captureButton.addEventListener('click', () => {

    if (fileDestination === undefined) {

        backstage.setPause(true, displayWidth);

        changeFileDestination((success) => {

            if (success) {

                capture();

            }

            if (!paused) {

                backstage.setPause(false, displayWidth);

            }

        });

    } else {

        capture();

    }

});

/* Prepare pagination buttons */

paginationButtons.initButtons(sampleRatePagination, (activeIndex) => {

    const requestedSampleRate = sampleRateValues[activeIndex];

    backstage.changeSampleRate(requestedSampleRate);

    console.log('Sample rate changed to:', requestedSampleRate, 'kHz');

});

paginationButtons.initButtons(displayWidthPagination, (activeIndex) => {

    displayWidth = displayWidthValues[activeIndex];

    displayWidthChanged = true;

    console.log('Display width changed to:', displayWidth, 'seconds');

});

paginationButtons.initButtons(autosaveLengthPagination, (activeIndex) => {

    const autosaveLengthSelection = autosaveLengthValues[activeIndex];

    if (autosaveLengthSelection === -1) {

        console.log('Autosave disabled');

        backstage.setAutoSave(0);

    } else {

        console.log('Autosave length changed to:', autosaveLengthSelection, 'mins');

        if (fileDestination === undefined) {

            changeFileDestination((success) => {

                if (success) {

                    console.log('File destination set for autosave, enabling autosave');

                    backstage.setAutoSave(autosaveLengthSelection);

                } else {

                    console.log('Failed to set file destination for autosave');

                    paginationButtons.selectActiveButton(autosaveLengthPagination, 0);

                    // Set focus to off button

                    autosaveLengthPagination.children[0].children[0].focus();

                }

            });

        } else {

            backstage.setAutoSave(autosaveLengthSelection);

        }

    }

});

function handleMonitorChange (monitorSelection) {

    if (monitorSelection === 1) {

        console.log('Monitor on.');
        changeAndSaveMonitorMode(backstage.MONITOR_PLAYTHROUGH);

    } else if (monitorSelection === 2) {

        console.log('Heterodyne enabled with frequency:', heterodyneFrequency, 'Hz');
        changeAndSaveMonitorMode(backstage.MONITOR_HETERODYNE);

    }

    updateHeterodyneUI(false);

}

paginationButtons.initButtons(monitorPagination, (activeIndex) => {

    const monitorSelection = monitorValues[activeIndex];

    if (monitorSelection === 0) {

        console.log('Monitor off.');
        changeAndSaveMonitorMode(backstage.MONITOR_OFF);
        updateHeterodyneUI(false);

    } else {

        if (simulationRunning) {

            handleMonitorChange(monitorSelection);

        } else if (twoOption.isChecked()) {

            const buttonText = monitorSelection === 1 ? 'Disable Monitor' : 'Disable Heterodyne';

            twoOption.displayTwoOptionCheck('Warning', 'Make sure your microphone is positioned away from your speakers to prevent audio feedback.', 'Continue', () => {

                handleMonitorChange(monitorSelection);

            }, buttonText, () => {

                console.log('Monitor off.');
                paginationButtons.selectActiveButton(monitorPagination, 0);
                changeAndSaveMonitorMode(backstage.MONITOR_OFF);
                updateHeterodyneUI(false);

            }, true, 'Always display warning');

        } else {

            handleMonitorChange(monitorSelection);

        }

    }

});

// Heterodyne UI

function changeHeterodyneFrequency (newHeterodyneFrequency) {

    newHeterodyneFrequency = Math.max(newHeterodyneFrequency, heterodyneFrequencyMin);
    newHeterodyneFrequency = Math.min(newHeterodyneFrequency, heterodyneFrequencyMax);

    heterodyneFrequency = newHeterodyneFrequency;

    updateHeterodyneUI(false);

    if (isHeterodyneEnabled()) {

        changeAndSaveMonitorMode(backstage.MONITOR_HETERODYNE);

    }

}

/**
 * Add functionality to a button which runs a function every delay ms while it is held
 * @param {Element} button Button to apply functionality to
 * @param {number} delay Amount of time between each firing of the action
 * @param {function} action Function to be run every delay ms
 */
function holdButton (button, delay, action) {

    let t;
    const start = delay;

    const repeat = () => {

        if (button.disabled) {

            clearTimeout(t);
            delay = start;
            return;

        }

        action(100);
        t = setTimeout(repeat, delay);

        delay = delay * HOLD_DELAY_MULTIPLIER;

    };

    button.addEventListener('mousedown', (e) => {

        if (e.button === 2) {

            action(1000);
            return;

        }

        repeat();

    });

    button.addEventListener('mouseup', () => {

        clearTimeout(t);
        delay = start;

    });

}

holdButton(heterodyneUpButton, HOLD_INITIAL_DELAY, (amount) => {

    changeHeterodyneFrequency(heterodyneFrequency + amount);

});

holdButton(heterodyneDownButton, HOLD_INITIAL_DELAY, (amount) => {

    changeHeterodyneFrequency(heterodyneFrequency - amount);

});

// Keyboard can be used to click the buttons but not trigger hold, so detect that as a separate event

heterodyneDownButton.addEventListener('click', (e) => {

    if (e.pointerId === -1) {

        changeHeterodyneFrequency(heterodyneFrequency - 100);

    }

});

heterodyneUpButton.addEventListener('click', (e) => {

    if (e.pointerId === -1) {

        changeHeterodyneFrequency(heterodyneFrequency + 100);

    }

});

// Image saving UI

function saveImage (exportType, callback) {

    if (exportType === constants.EXPORT_PDF) {

        const exportPath = path.join(fileDestination, fileName + '.pdf');

        try {

            exportPlotter.savePDF(displayWidth, currentSampleRate, fileName, exportPath);

        } catch (error) {

            callback(error);

            return;

        }

        callback();

        return;

    }

    const imageCanvas = exportPlotter.getCanvas(displayWidth, currentSampleRate, fileName + '.WAV');

    imageCanvas.toBlob((blob) => {

        const reader = new FileReader();

        reader.onloadend = () => {

            const extension = exportType === constants.EXPORT_PNG ? '.png' : '.jpg';

            const exportPath = path.join(fileDestination, fileName + extension);

            fs.writeFile(exportPath, new Uint8Array(reader.result), callback);

        };

        reader.readAsArrayBuffer(blob);

    });

}

function savePlot (exportType, callback) {

    if (!paused) {

        setPause(true);

    }

    if (fileDestination === undefined) {

        changeFileDestination((success) => {

            if (success) {

                saveImage(exportType, callback);

            }

        });

    } else {

        saveImage(exportType, callback);

    }

}

// Plot export buttons

savePlotButton.addEventListener('click', () => {

    setPause(true);

});

function handlePlotResult (err) {

    if (err) {

        console.error(err);

        displayError('Export image error', 'Failed to export image.');

    }

}

exportPNGButton.addEventListener('click', () => {

    exportCloseButton.click();
    savePlot(constants.EXPORT_PNG, handlePlotResult);

});

exportJPGButton.addEventListener('click', () => {

    exportCloseButton.click();
    savePlot(constants.EXPORT_JPG, handlePlotResult);

});

exportPDFButton.addEventListener('click', () => {

    exportCloseButton.click();
    savePlot(constants.EXPORT_PDF, handlePlotResult);

});

exportAllButton.addEventListener('click', () => {

    exportCloseButton.click();

    savePlot(constants.EXPORT_PNG, (err) => {

        if (err) {

            handlePlotResult(err);

        } else {

            savePlot(constants.EXPORT_JPG, (err) => {

                if (err) {

                    handlePlotResult(err);

                } else {

                    savePlot(constants.EXPORT_PDF, handlePlotResult);

                }

            });

        }

    });

});

window.onbeforeunload = (e) => {

    // Prevent close

    e.returnValue = false;

    // Shutdown autosave

    backstage.forceAutoSaveToStop();

    // Clear function which catches close and trigger it again

    window.onbeforeunload = null;

    electron.ipcRenderer.send('app-quit');

};

/* Prepare UI */

plotter.reset(colourMapIndex);

drawWaveformBaseline();

startMicrophone();

frequencyDisplay.init(currentSampleRate, timeDisplay.clearDisplay);
timeDisplay.init(displayWidth, frequencyDisplay.clearDisplay);

sendSimulationInfo();
