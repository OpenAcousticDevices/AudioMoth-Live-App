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

let dragStartY;

const frequencyScalingValues = [100, 200, 500, 1000, 2000, 5000, 10000];

const kHzStr = '&#8198;kHz';

/**
 * Format the frequency text
 * @param {str} str Display string
 */
function updateText (str) {

    frequencySpan.style.display = '';
    frequencySpan.innerHTML = str;

    clockSpan.style.display = 'none';

}

/**
 * Scale the frequency depending on the spectrogram range and height
 * @param {y} y Current position on spectrogram
 * @param {h} h Current spectrogram height
 * @param {nyquist} nyquist Current Nyquite limit
 */
function scaleFrequency (y, h, nyquist) {

    const frequencyPerPixel = nyquist / h;

    const frequency = y * frequencyPerPixel;

    for (let i = 0; i < frequencyScalingValues.length; i += 1) {

        const scalingValue = frequencyScalingValues[i];

        if (frequencyPerPixel < scalingValue) {

            return nyquist - scalingValue * Math.round(frequency / scalingValue);

        }

    }

    return frequency;

}

/**
 * Convert mouse position to spectrogram Y position
 * @param {e} event Current mouse event
 */
function getSpectrogramY (e) {

    const rect = spectrogramCanvas.getBoundingClientRect();

    const h = spectrogramFrequencySVG.height.baseVal.value;

    return Math.min(h, Math.max(0, e.clientY - rect.top));

}

/**
 * Handle mouse down
 * @param {e} event Current mouse event
 */
function mouseDown (e) {

    if (e.button !== 0) return;

    dragStartY = getSpectrogramY(e);

    dragging = true;

}

/**
 * Handle mouse move
 * @param {e} event Current mouse event
 */
function mouseMove (e) {

    const w = spectrogramFrequencySVG.width.baseVal.value;

    const h = spectrogramFrequencySVG.height.baseVal.value;

    const currentY = getSpectrogramY(e);

    drawSVG.clearSVG(spectrogramFrequencySVG);

    if (dragging === false || (dragging === true && currentY === dragStartY)) {

        const freq = scaleFrequency(currentY, h, nyquist);

        updateText((freq / 1000).toFixed(1) + kHzStr);

        drawSVG.addSVGLine(spectrogramFrequencySVG, 0, Math.floor(currentY) + 0.5, w, currentY, 'red');

    } else if (dragging === true) {

        const minimumY = Math.min(currentY, dragStartY);
        const maximumY = Math.max(currentY, dragStartY);

        drawSVG.addSVGLine(spectrogramFrequencySVG, 0, Math.floor(minimumY) + 0.5, w, Math.floor(minimumY) + 0.5, 'red');
        drawSVG.addSVGRect(spectrogramFrequencySVG, 0, Math.floor(minimumY) + 0.5, w, maximumY - minimumY, 'red', 1, true, 'red', 0.3);
        drawSVG.addSVGLine(spectrogramFrequencySVG, 0, Math.floor(maximumY) + 0.5, w, Math.floor(maximumY) + 0.5, 'red');

        const minimumFreq = scaleFrequency(maximumY, h, nyquist);
        const maximumFreq = scaleFrequency(minimumY, h, nyquist);

        updateText((minimumFreq / 1000).toFixed(1) + ' - ' + (maximumFreq / 1000).toFixed(1) + kHzStr);

    }

}

/**
 * Handle mouse up
 * @param {e} event Current mouse event
 */
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

exports.addDoubleClickListener = (callback) => {

    spectrogramCanvas.addEventListener('dblclick', (e) => {

        const currentY = getSpectrogramY(e);

        const h = spectrogramFrequencySVG.height.baseVal.value;

        const frequency = scaleFrequency(currentY, h, nyquist);

        callback(frequency);

    });

};

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
