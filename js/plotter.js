/****************************************************************************
 * plotter.js
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

const constants = require('./constants');
const colourMap = require('./colourMap');

// Colours

let colourTable;

// Canvases

const waveformCanvas = document.getElementById('waveform-canvas');
const spectrogramCanvas = document.getElementById('spectrogram-canvas');

// Temporary canvases to store plots when resizing

let waveformTempCanvas = null;
let waveformTempContext = null;
let spectrogramTempCanvas = null;
let spectrogramTempContext = null;

// Waveform variables

let columnMax = constants.INT16_MIN;
let columnMin = constants.INT16_MAX;

let waveformPixelHeight;

let waveformCtx;
let waveformImageData;
let waveformPixels;

// Spectrogram variables

let stftArray;
let stftIndexLookup;

let spectrogramPixelHeight;

let spectrogramCtx;
let spectrogramImageData;
let spectrogramPixels;

// Shared variables

let pixelWidth;

let lastCount = 0;
let newColumn = true;
let positionInColumn = 0;

const UPDATE_BOTH = 0;
const UPDATE_WAVEFORM = 1;
const UPDATE_SPECTROGRAM = 2;

let nightMode = false;
let colourMapIndex = colourMap.COLOUR_MAP_DEFAULT;

// Reset functions

function resetColourMap (newColourMapIndex) {

    colourMapIndex = newColourMapIndex;

    colourTable = colourMap.create(colourMapIndex);

}

function resetWaveform () {

    // Update canvas size

    pixelWidth = waveformCanvas.width;
    waveformPixelHeight = waveformCanvas.height;

    // Set up pixel data

    waveformCtx = waveformCanvas.getContext('2d');

    waveformImageData = waveformCtx.getImageData(0, 0, pixelWidth, waveformPixelHeight);

    waveformPixels = new Uint32Array(waveformImageData.data.buffer);

}

function resetSpectrogram () {

    // Update canvas size

    pixelWidth = spectrogramCanvas.width;
    spectrogramPixelHeight = spectrogramCanvas.height;

    // Generate colour table

    if (!colourTable) {

        resetColourMap(colourMapIndex);

    }

    // Generate STFT array

    const stftArrayBuffer = new ArrayBuffer(constants.STFT_OUTPUT_SAMPLES * constants.BYTES_IN_FLOAT64);

    stftArray = new Float64Array(stftArrayBuffer);

    // Generate STFT index lookup table

    const stftIndexLookupBuffer = new ArrayBuffer(spectrogramPixelHeight * constants.BYTES_IN_FLOAT64);

    stftIndexLookup = new Float64Array(stftIndexLookupBuffer);

    for (let i = 0; i < spectrogramPixelHeight; i += 1) {

        stftIndexLookup[i] = constants.STFT_OUTPUT_SAMPLES - 1 - Math.round(i * (constants.STFT_OUTPUT_SAMPLES - 2) / (spectrogramPixelHeight - 1));

    }

    // Set up pixel data

    spectrogramCtx = spectrogramCanvas.getContext('2d');

    spectrogramImageData = spectrogramCtx.getImageData(0, 0, pixelWidth, spectrogramPixelHeight);

    spectrogramPixels = new Uint32Array(spectrogramImageData.data.buffer);

}

exports.reset = (colourMapIndex) => {

    resetColourMap(colourMapIndex);

    resetWaveform();

    resetSpectrogram();

};

// Resize functions

exports.resize = (newWidth, newWaveformHeight, newSpectrogramHeight) => {

    waveformCanvas.width = newWidth;

    spectrogramCanvas.width = newWidth;

    if (newWaveformHeight) waveformCanvas.height = newWaveformHeight;

    if (newSpectrogramHeight) spectrogramCanvas.height = newSpectrogramHeight;

    if (newWidth || newWaveformHeight) resetWaveform();

    if (newWidth || newSpectrogramHeight) resetSpectrogram();

};

/**
 * Save the current contents of the waveform and spectrogram canvases to their respective temporary canvases.
 */
exports.saveCanvasesToTemporary = () => {

    if (!waveformTempCanvas) {

        waveformTempCanvas = document.createElement('canvas');
        waveformTempContext = waveformTempCanvas.getContext('2d');

    }

    if (!spectrogramTempCanvas) {

        spectrogramTempCanvas = document.createElement('canvas');
        spectrogramTempContext = spectrogramTempCanvas.getContext('2d');

    }

    // Draw to waveform temporary canvas

    waveformTempCanvas.width = waveformCanvas.width;
    waveformTempCanvas.height = waveformCanvas.height;
    waveformTempContext.drawImage(waveformCanvas, 0, 0);

    // Draw to spectrogram temporary canvas

    spectrogramTempCanvas.width = spectrogramCanvas.width;
    spectrogramTempCanvas.height = spectrogramCanvas.height;
    spectrogramTempContext.drawImage(spectrogramCanvas, 0, 0);

};

/**
 * Draw the temporary canvases back to the waveform and spectrogram canvases, stretching their contents to match the canvas sizes.
 */
exports.drawTemporaryToCanvases = () => {

    if (waveformTempCanvas && waveformTempContext) {

        const waveformContext = waveformCanvas.getContext('2d');
        waveformContext.drawImage(
            waveformTempCanvas,
            0,
            0,
            waveformTempCanvas.width,
            waveformTempCanvas.height,
            0,
            0,
            waveformCanvas.width,
            waveformCanvas.height
        );

    }

    if (spectrogramTempCanvas && spectrogramTempContext) {

        const spectrogramContext = spectrogramCanvas.getContext('2d');
        spectrogramContext.drawImage(
            spectrogramTempCanvas,
            0,
            0,
            spectrogramTempCanvas.width,
            spectrogramTempCanvas.height,
            0,
            0,
            spectrogramCanvas.width,
            spectrogramCanvas.height
        );

    }

};

/**
 * Clear the temporary canvases.
 */
exports.clearTemporaryCanvases = () => {

    if (waveformTempCanvas && waveformTempContext) {

        waveformTempContext.clearRect(0, 0, waveformTempCanvas.width, waveformTempCanvas.height);
        waveformTempCanvas = null;
        waveformTempContext = null;

    }

    if (spectrogramTempCanvas && spectrogramTempContext) {

        spectrogramTempContext.clearRect(0, 0, spectrogramTempCanvas.width, spectrogramTempCanvas.height);
        spectrogramTempCanvas = null;
        spectrogramTempContext = null;

    }

};

// Drawing functions

function scrollOrClearColumns (pixels, pixelHeight, redraw, numberOfColumns) {

    if (redraw) {

        // Clear columns

        for (let row = 0; row < pixelHeight; row++) {

            for (let col = 0; col < pixelWidth - numberOfColumns; col += 1) {

                const index = row * pixelWidth + col;

                pixels[index] = 0;

            }

        }

    } else if (numberOfColumns > 0) {

        // Shift columns

        for (let row = 0; row < pixelHeight; row++) {

            for (let col = 0; col < pixelWidth - numberOfColumns; col += 1) {

                const index = row * pixelWidth + col;

                pixels[index] = pixels[index + numberOfColumns];

            }

        }

    }

}

function drawWaveformColumn (columnOffset) {

    const halfHeight = Math.round(waveformPixelHeight / 2) - 1;

    const multiplier = -halfHeight / constants.INT16_MIN;

    columnMin = Math.round(columnMin * multiplier + halfHeight);
    columnMax = Math.round(columnMax * multiplier + halfHeight);

    let colour;

    if (nightMode) {

        colour = constants.PIXEL_COLOUR_NIGHT;
        colour = colourMapIndex === colourMap.COLOUR_MAP_DEFAULT ? colour : constants.PIXEL_COLOUR_MONOCHROME_NIGHT;

    } else {

        colour = constants.PIXEL_COLOUR;
        colour = colourMapIndex === colourMap.COLOUR_MAP_DEFAULT ? colour : constants.PIXEL_COLOUR_MONOCHROME;

    }

    for (let row = 0; row < waveformPixelHeight; row += 1) {

        const col = pixelWidth - columnOffset;

        const index = row * pixelWidth + col;

        const pixelIsBlank = row < columnMin || row > columnMax;

        waveformPixels[index] = pixelIsBlank ? 0 : colour;

    }

    columnMax = constants.INT16_MIN;
    columnMin = constants.INT16_MAX;

}

function drawSpectrogramColumn (columnOffset, lowAmpColourScaleEnabled) {

    const colourMin = lowAmpColourScaleEnabled ? constants.LOW_AMP_COLOUR_MIN : constants.STATIC_COLOUR_MIN;
    const colourMax = lowAmpColourScaleEnabled ? constants.LOW_AMP_COLOUR_MAX : constants.STATIC_COLOUR_MAX;

    for (let row = 0; row < spectrogramPixelHeight; row += 1) {

        const col = pixelWidth - columnOffset;

        const index = row * pixelWidth + col;

        let colourIndex = Math.round(255 * (stftArray[stftIndexLookup[row]] - colourMin) / (colourMax - colourMin));

        colourIndex = Math.max(colourIndex, 0);
        colourIndex = Math.min(colourIndex, 255);

        spectrogramPixels[index] = colourTable[colourIndex];

    }

}

// Main exported update function

exports.update = (audioBuffer, stftBuffer, mode, redraw, index, count, displayWidthSamples, isNightMode, lowAmpColourScaleEnabled, newColourMapIndex) => {

    if (nightMode !== isNightMode) redraw = true;

    nightMode = isNightMode;

    if (colourMapIndex !== newColourMapIndex) {

        resetColourMap(newColourMapIndex);

        redraw = true;

    }

    let numberOfSamples = count - lastCount;

    if (numberOfSamples >= displayWidthSamples) redraw = true;

    if (redraw) {

        numberOfSamples = Math.min(count, displayWidthSamples);

        for (let i = 0; i < stftArray.length; i += 1) stftArray[i] = 0;

        columnMax = constants.INT16_MIN;
        columnMin = constants.INT16_MAX;

        positionInColumn = 0;

    }

    const offset = (audioBuffer.length + index - numberOfSamples) % audioBuffer.length;

    // Calculate step size based on samples per column

    const stepSize = pixelWidth / displayWidthSamples;

    // Calculate expected number of columns

    const expectedNumberOfColumns = Math.floor(positionInColumn + numberOfSamples * stepSize);

    // Scroll or clear the waveform

    if (mode === UPDATE_BOTH || mode === UPDATE_WAVEFORM) scrollOrClearColumns(waveformPixels, waveformPixelHeight, redraw, expectedNumberOfColumns);

    if (mode === UPDATE_BOTH || mode === UPDATE_SPECTROGRAM) scrollOrClearColumns(spectrogramPixels, spectrogramPixelHeight, redraw, expectedNumberOfColumns);

    // Main loop

    let numberOfColumns = 0;

    for (let i = 0; i < numberOfSamples; i++) {

        const index = (offset + i) % audioBuffer.length;

        const sample = -audioBuffer[index];

        columnMax = (sample > columnMax) ? sample : columnMax;
        columnMin = (sample < columnMin) ? sample : columnMin;

        if (index % constants.STFT_INPUT_SAMPLES === 0) {

            const stftIndex = index / constants.STFT_INPUT_OUTPUT_RATIO;

            for (let i = 0; i < stftArray.length; i += 1) {

                const data = stftBuffer[stftIndex + i];

                stftArray[i] = newColumn || data > stftArray[i] ? data : stftArray[i];

            }

            newColumn = false;

        }

        positionInColumn += stepSize;

        if (positionInColumn >= 1) {

            // Check for extra column due to rounding errors

            if (numberOfColumns < expectedNumberOfColumns) {

                if (mode === UPDATE_BOTH || mode === UPDATE_WAVEFORM) drawWaveformColumn(expectedNumberOfColumns - numberOfColumns);

                if (mode === UPDATE_BOTH || mode === UPDATE_SPECTROGRAM) drawSpectrogramColumn(expectedNumberOfColumns - numberOfColumns, lowAmpColourScaleEnabled);

                numberOfColumns += 1;

                positionInColumn -= 1;

                newColumn = true;

            }

        }

    }

    // Check for missing column due to rounding errors

    if (numberOfColumns < expectedNumberOfColumns) {

        if (mode === UPDATE_BOTH || mode === UPDATE_WAVEFORM) drawWaveformColumn(expectedNumberOfColumns - numberOfColumns);

        if (mode === UPDATE_BOTH || mode === UPDATE_SPECTROGRAM) drawSpectrogramColumn(expectedNumberOfColumns - numberOfColumns, lowAmpColourScaleEnabled);

        positionInColumn -= 1;

        newColumn = true;

    }

    // Update the image

    if (redraw || expectedNumberOfColumns > 0) {

        if (mode === UPDATE_BOTH || mode === UPDATE_WAVEFORM) waveformCtx.putImageData(waveformImageData, 0, 0);

        if (mode === UPDATE_BOTH || mode === UPDATE_SPECTROGRAM) spectrogramCtx.putImageData(spectrogramImageData, 0, 0);

    }

    // Update last count value

    lastCount = count;

};

exports.UPDATE_BOTH = UPDATE_BOTH;
exports.UPDATE_WAVEFORM = UPDATE_WAVEFORM;
exports.UPDATE_SPECTROGRAM = UPDATE_SPECTROGRAM;
