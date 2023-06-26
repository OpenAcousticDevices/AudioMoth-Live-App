/****************************************************************************
 * frequencyDisplay.js
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

const drawSVG = require('./drawSVG');

const spectrogramCanvas = document.getElementById('spectrogram-resizable-border-div');
const spectrogramFrequencySVG = document.getElementById('spectrogram-frequency-svg');

const frequencySpan = document.getElementById('frequency-span');
const clockSpan = document.getElementById('clock-span');

let nyquist = 24000;

let dragging = false;
let dragStart;

function updateText (str) {

    frequencySpan.style.display = '';
    frequencySpan.innerHTML = str;

    clockSpan.style.display = 'none';

}

function mouseDown (e) {

    if (e.button !== 0) {

        return;

    }

    const rect = spectrogramCanvas.getBoundingClientRect();

    dragStart = e.clientY - rect.top;
    dragging = true;

}

function mouseMove (e) {

    const rect = spectrogramCanvas.getBoundingClientRect();
    const currentY = e.clientY - rect.top;

    const w = spectrogramFrequencySVG.width.baseVal.value;
    const h = spectrogramFrequencySVG.height.baseVal.value;

    drawSVG.clearSVG(spectrogramFrequencySVG);

    const kHzStr = '&#8198;kHz';

    if (dragging) {

        let startFreq = (Math.min(dragStart, currentY) / h) * nyquist;
        startFreq = Math.round(startFreq / 100) * 100;

        let endFreq = (Math.max(dragStart, currentY) / h) * nyquist;
        endFreq = Math.round(endFreq / 100) * 100;

        if (startFreq === endFreq) {

            const lineY = (startFreq / nyquist) * h;

            // Cap value to nyquist as canvas captures mouse movement slightly outside of its bounds

            startFreq = Math.min(nyquist - startFreq, nyquist);
            startFreq = Math.max(startFreq, 0);

            updateText((startFreq / 1000).toFixed(1) + kHzStr);

            drawSVG.addSVGLine(spectrogramFrequencySVG, 0, lineY, w, lineY, 'red');

        } else {

            const startY = (startFreq / nyquist) * h;
            const endY = (endFreq / nyquist) * h;
            const dragH = endY - startY;

            // Cap value to nyquist as canvas captures mouse movement slightly outside of its bounds

            startFreq = Math.min(nyquist - startFreq, nyquist);
            endFreq = Math.min(nyquist - endFreq, nyquist);

            startFreq = Math.max(startFreq, 0);
            endFreq = Math.max(endFreq, 0);

            updateText((endFreq / 1000).toFixed(1) + ' - ' + (startFreq / 1000).toFixed(1) + kHzStr);

            drawSVG.addSVGLine(spectrogramFrequencySVG, 0, Math.floor(startY) + 0.5, w, Math.floor(startY) + 0.5, 'red');
            drawSVG.addSVGRect(spectrogramFrequencySVG, 0, startY, w, dragH, 'red', 1, true, 'red', 0.3);
            drawSVG.addSVGLine(spectrogramFrequencySVG, 0, Math.floor(endY) + 0.5, w, Math.floor(endY) + 0.5, 'red');

        }

    } else {

        let freq = (currentY / h) * nyquist;
        freq = Math.round(freq / 100) * 100;

        updateText(((nyquist - freq) / 1000).toFixed(1) + kHzStr);

        const lineY = (freq / nyquist) * h;

        drawSVG.addSVGLine(spectrogramFrequencySVG, 0, lineY, w, lineY, 'red');

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

    frequencySpan.innerHTML = '';
    frequencySpan.style.display = 'none';

    clockSpan.style.display = '';

    drawSVG.clearSVG(spectrogramFrequencySVG);

    dragging = false;

}

exports.clearDisplay = clearDisplay;

/**
 * Update the max frequency displayed on the plot
 * @param {number} sampleRate Current sample rate
 */
function updateSampleRate (sampleRate) {

    nyquist = sampleRate / 2;

}

exports.updateSampleRate = updateSampleRate;

/**
 * Set current sample rate and add mouse listeners
 * @param {number} sampleRate Current sample rate
 */
exports.init = (sampleRate, inEvent) => {

    updateSampleRate(sampleRate, true);

    spectrogramCanvas.addEventListener('mousedown', mouseDown);
    spectrogramCanvas.addEventListener('mousemove', mouseMove);
    spectrogramCanvas.addEventListener('mouseup', mouseUp);
    spectrogramCanvas.addEventListener('mouseenter', inEvent);
    spectrogramCanvas.addEventListener('mouseleave', (e) => {

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
