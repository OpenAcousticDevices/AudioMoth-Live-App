/****************************************************************************
 * timeDisplay.js
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

const drawSVG = require('./drawSVG');

const waveformCanvas = document.getElementById('waveform-resizable-border-div');
const waveformTimeSVG = document.getElementById('waveform-time-svg');

const timeSpan = document.getElementById('time-span');
const clockSpan = document.getElementById('clock-span');

let dragging = false;
let dragStart;

const TIME_MODE_NONE = 0;
const TIME_MODE_HOVER = 1;
const TIME_MODE_DRAG = 2;
let mode = TIME_MODE_NONE;

let start;
let end;

let displayWidth = 10000;
let currentTime = 0;

let localTimeEnabled = true;

function roundAccordingToDisplayWidth (n) {

    let precision = 1;

    switch (displayWidth) {

    case 1000:
        precision = 1;
        break;
    case 5000:
        precision = 5;
        break;
    case 10000:
        precision = 10;
        break;
    case 20000:
        precision = 20;
        break;
    case 60000:
        precision = 50;
        break;
    default:
        precision = 1;
        break;

    }

    return Math.ceil(n / precision) * precision;

}

function formatTime (t, showMilliseconds, roundMilliseconds) {

    const time = new Date(t);

    let hours = time.getUTCHours();
    let mins = time.getUTCMinutes();
    let secs = time.getUTCSeconds();
    let milliseconds = time.getUTCMilliseconds();

    milliseconds = roundMilliseconds ? roundAccordingToDisplayWidth(milliseconds) : milliseconds;

    if (milliseconds >= 1000) {

        milliseconds = 0;
        secs++;

    }

    if (secs === 60) {

        secs = 0;
        mins++;

    }

    if (mins === 60) {

        mins = 0;
        hours = (hours + 1) % 24;

    }

    hours = hours.toString();
    mins = mins.toString();
    secs = secs.toString();
    milliseconds = milliseconds.toString();

    let str = hours.padStart(2, '0') + ':' + mins.padStart(2, '0') + ':' + secs.padStart(2, '0');
    str = showMilliseconds ? str + '.' + milliseconds.padStart(3, '0') : str;

    return str;

}

function updateText (str) {

    timeSpan.style.display = '';
    timeSpan.innerHTML = str;

    clockSpan.style.display = 'none';

}

function mouseDown (e) {

    if (e.button !== 0) {

        return;

    }

    const rect = waveformCanvas.getBoundingClientRect();

    dragStart = e.clientX - rect.left;
    dragging = true;

}

function updateHover () {

    const w = waveformTimeSVG.width.baseVal.value;
    const h = waveformTimeSVG.height.baseVal.value;

    let startTime = start * displayWidth;

    let roundMilliseconds = true;

    const precision = displayWidth / 1000.0;

    if (startTime <= precision) {

        roundMilliseconds = false;
        startTime = 0;

    }

    if (displayWidth - startTime <= precision) {

        roundMilliseconds = false;
        startTime = displayWidth;

    }

    let str = formatTime(currentTime - displayWidth + startTime, true, roundMilliseconds);
    str = localTimeEnabled ? str : str + ' UTC';

    updateText(str);

    const lineX = start * w;

    drawSVG.clearSVG(waveformTimeSVG);

    drawSVG.addSVGLine(waveformTimeSVG, lineX, 0, lineX, h, 'red');

}

function updateDrag () {

    const w = waveformTimeSVG.width.baseVal.value;
    const h = waveformTimeSVG.height.baseVal.value;

    let startTime = start * displayWidth;
    let endTime = end * displayWidth;

    let roundMillisecondsStart = true;
    let roundMillisecondsEnd = true;

    const precision = displayWidth / 1000.0;

    if (startTime <= precision) {

        roundMillisecondsStart = false;
        startTime = 0;

    }

    if (displayWidth - endTime <= precision) {

        roundMillisecondsEnd = false;
        endTime = displayWidth;

    }

    let str = formatTime(currentTime - displayWidth + startTime, true, roundMillisecondsStart) + ' - ' + formatTime(currentTime - displayWidth + endTime, true, roundMillisecondsEnd);
    str = localTimeEnabled ? str : str + ' UTC';

    updateText(str);

    const startX = start * w;
    const endX = end * w;
    const dragW = endX - startX;

    drawSVG.clearSVG(waveformTimeSVG);

    drawSVG.addSVGLine(waveformTimeSVG, Math.floor(startX) + 0.5, 0, Math.floor(startX) + 0.5, h, 'red');
    drawSVG.addSVGRect(waveformTimeSVG, startX, 0, dragW, h, 'red', 1, true, 'red', 0.3);
    drawSVG.addSVGLine(waveformTimeSVG, Math.floor(endX) + 0.5, 0, Math.floor(endX) + 0.5, h, 'red');

}

function mouseMove (e) {

    const w = waveformTimeSVG.width.baseVal.value;

    const rect = waveformCanvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;

    drawSVG.clearSVG(waveformTimeSVG);

    if (dragging) {

        start = Math.min(dragStart, currentX) / w;

        end = Math.max(dragStart, currentX) / w;

        if (start === end) {

            start = Math.min(start, 1.0);
            start = Math.max(start, 0);

            mode = TIME_MODE_HOVER;

            updateHover();

        } else {

            // Cap value to nyquist as canvas captures mouse movement slightly outside of its bounds

            start = Math.min(start, 1.0);
            end = Math.min(end, 1.0);

            start = Math.max(start, 0);
            end = Math.max(end, 0);

            mode = TIME_MODE_DRAG;

            updateDrag();

        }

    } else {

        start = currentX / w;

        mode = TIME_MODE_HOVER;

        updateHover();

    }

}

function mouseUp (e) {

    if (dragging) {

        clearDisplay();

        mouseMove(e);

    } else {

        dragging = false;

    }

}

/**
 * Clear line display and reset span
 */
function clearDisplay () {

    clockSpan.style.display = '';

    timeSpan.innerHTML = '';
    timeSpan.style.display = 'none';

    drawSVG.clearSVG(waveformTimeSVG);

    dragging = false;

    mode = TIME_MODE_NONE;

}

exports.clearDisplay = clearDisplay;

exports.updateTime = (milliseconds, ltEnabled) => {

    currentTime = milliseconds;

    // Update clock text

    clockSpan.innerText = formatTime(currentTime, false);

    localTimeEnabled = ltEnabled;

    if (!localTimeEnabled) {

        clockSpan.innerText += ' UTC';

    }

    // Update time text

    if (mode === TIME_MODE_HOVER) {

        updateHover();

    } else if (mode === TIME_MODE_DRAG) {

        updateDrag();

    }

};

/**
 * Update the max amount of time displayed on the plot
 * @param {number} dw Current display width in seconds
 */
function updateDisplayWidth (dw) {

    displayWidth = dw * 1000;

}

exports.updateDisplayWidth = updateDisplayWidth;

/**
 * Add mouse listeners
 */
exports.init = (dw, inEvent) => {

    updateDisplayWidth(dw);

    waveformCanvas.addEventListener('mousedown', mouseDown);
    waveformCanvas.addEventListener('mousemove', mouseMove);
    waveformCanvas.addEventListener('mouseup', mouseUp);
    waveformCanvas.addEventListener('mouseenter', inEvent);
    waveformCanvas.addEventListener('mouseleave', (e) => {

        if (dragging) {

            mouseMove(e);

        } else {

            clearDisplay();

        }

    });

    document.body.addEventListener('mouseleave', clearDisplay);

    // Detect mouse button being released when outside of the bounds of the canvas

    document.body.addEventListener('mouseup', (e) => {

        if (e.button === 0 && dragging) {

            clearDisplay();

        }

    });

};
