/****************************************************************************
 * exportPlotter.js
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

const jsPDF = require('jspdf');
const customFont = require('./customFont');

const constants = require('./constants');
const colourMap = require('./colourMap');

// Colour table

let colourTable;

// Canvas dimensions

const w = 840;
const h = Math.ceil(w / 4 * 3);

const waveformW = 748;
const waveformH = 238;

const spectrogramW = waveformW;
const spectrogramH = 255;

const labelAreaWidth = 45;

// Canvases

let waveformCanvas = document.createElement('canvas');
waveformCanvas.width = waveformW;
waveformCanvas.height = waveformH;

let spectrogramCanvas = document.createElement('canvas');
spectrogramCanvas.width = spectrogramW;
spectrogramCanvas.height = spectrogramH;

let exportCanvas = document.createElement('canvas');
exportCanvas.width = w;
exportCanvas.height = h;

// Plot sizes

const xAxisLabelH = 10;
const yAxisLabelW = 15;
const xAxisMarkerH = 25;
const yAxisMarkerW = 40;

const edgeSpacingW = 15;
const edgeSpacingH = 15;

const topSpacing = 30 + edgeSpacingH;

const xAxisH = xAxisMarkerH + xAxisLabelH;
const yAxisW = yAxisMarkerW + yAxisLabelW + edgeSpacingW;

// Axis label information

let xLabels = [];
let waveformYLabels = [];
let spectrogramYLabels = [];

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

let newColumn = true;
let positionInColumn = 0;

// Axis labels

const yLabelCounts = {
    8000: 4,
    16000: 4,
    32000: 4,
    48000: 4,
    96000: 4,
    192000: 4,
    250000: 5,
    384000: 4
};

const xMarkerLength = 4;
const yMarkerLength = 4;

// Reset functions

function resetWaveform () {

    waveformCanvas = document.createElement('canvas');
    waveformCanvas.width = waveformW;
    waveformCanvas.height = waveformH;

    // Update canvas size

    pixelWidth = waveformCanvas.width;
    waveformPixelHeight = waveformCanvas.height;

    // Set up pixel data

    waveformCtx = waveformCanvas.getContext('2d');

    waveformImageData = waveformCtx.getImageData(0, 0, pixelWidth, waveformPixelHeight);

    waveformPixels = new Uint32Array(waveformImageData.data.buffer);

}

function resetSpectrogram () {

    spectrogramCanvas = document.createElement('canvas');
    spectrogramCanvas.width = spectrogramW;
    spectrogramCanvas.height = spectrogramH;

    // Update canvas size

    pixelWidth = spectrogramCanvas.width;
    spectrogramPixelHeight = spectrogramCanvas.height;

    // Generate colour

    if (!colourTable) {

        colourTable = colourMap.create();

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

function resetExportCanvas () {

    exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;

}

// Drawing functions

function drawWaveformColumn (columnOffset) {

    const halfHeight = waveformPixelHeight / 2;

    const multiplier = -halfHeight / constants.INT16_MIN;

    columnMin = Math.round(columnMin * multiplier + halfHeight);
    columnMax = Math.round(columnMax * multiplier + halfHeight);

    for (let row = 0; row < waveformPixelHeight; row += 1) {

        const col = pixelWidth - columnOffset;

        const index = row * pixelWidth + col;

        const pixelIsBlank = row < columnMin || row > columnMax;

        waveformPixels[index] = pixelIsBlank ? 0 : constants.PIXEL_COLOUR;

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

function samplesToPixels (samples, totalSamples) {

    const pixels = samples / totalSamples * spectrogramW;

    return pixels;

}

function prepareAxisLabels (sampleRate, displayWidth) {

    // Clear arrays

    xLabels = [];
    waveformYLabels = [];
    spectrogramYLabels = [];

    // Prepare y axis labels for spectrogram

    const yLabelCount = yLabelCounts[sampleRate];

    const ySpecLabelIncrement = sampleRate / 2 / yLabelCount;

    const ySpecIncrement = spectrogramH / yLabelCount;

    const specLabelX = labelAreaWidth - 7;
    const specMarkerX = labelAreaWidth - yMarkerLength;

    for (let i = 0; i <= yLabelCount; i++) {

        const labelText = (i * ySpecLabelIncrement / 1000) + 'kHz';

        const y = spectrogramH - (i * ySpecIncrement);

        if (i === 0) {

            const endLabelY = spectrogramH - 0.5;

            spectrogramYLabels.push({
                labelX: specLabelX,
                labelY: y,
                label: labelText,
                lineX0: specMarkerX,
                lineY0: endLabelY,
                lineX1: labelAreaWidth,
                lineY1: endLabelY
            });

        } else if (i === yLabelCount) {

            spectrogramYLabels.push({
                labelX: specLabelX,
                labelY: y,
                label: labelText,
                lineX0: specMarkerX,
                lineY0: 0.5,
                lineX1: labelAreaWidth,
                lineY1: 0.5
            });

        } else {

            const endLabelY = Math.floor(y) + 0.5;

            spectrogramYLabels.push({
                labelX: specLabelX,
                labelY: y,
                label: labelText,
                lineX0: specMarkerX,
                lineY0: endLabelY,
                lineX1: labelAreaWidth,
                lineY1: endLabelY
            });

        }

    }

    // Draw y axis labels for waveform

    const waveformMaxPercentage = 100.0;

    const waveformCanvasH = waveformH;
    const waveformCanvasHCentre = waveformCanvasH / 2.0;

    const yLabelIncrementWaveformPercentage = 20;

    const yLabelPositionIncrementWaveformPercentage = (yLabelIncrementWaveformPercentage / waveformMaxPercentage) * waveformCanvasH / 2;

    const waveformLabelTexts = [];
    const waveformLabelYPositions = [];

    let waveformLabelYOffsetPercentage = 0.0;
    let waveformLabelValuePercentage = 0.0;

    while (waveformLabelValuePercentage <= waveformMaxPercentage) {

        waveformLabelTexts.push(waveformLabelValuePercentage + '%');
        waveformLabelYPositions.push(waveformCanvasHCentre - waveformLabelYOffsetPercentage);

        // Add mirrored label

        if (waveformLabelValuePercentage > 0.0) {

            waveformLabelTexts.unshift(waveformLabelValuePercentage + '%');
            waveformLabelYPositions.unshift(waveformCanvasHCentre + waveformLabelYOffsetPercentage);

        }

        waveformLabelValuePercentage += yLabelIncrementWaveformPercentage;
        waveformLabelYOffsetPercentage += yLabelPositionIncrementWaveformPercentage;

    }

    const wavLabelX = labelAreaWidth - 7;
    const wavMarkerX = labelAreaWidth - yMarkerLength;

    for (let i = 0; i < waveformLabelTexts.length; i++) {

        const markerY = waveformLabelYPositions[i];

        // Nudge markers slightly onto canvas so they're not cut off and align with 0.5

        let lineY = markerY;

        if (lineY === 0) {

            lineY = lineY + 0.5;

        } else if (lineY === waveformCanvasH) {

            lineY = lineY - 0.5;

        } else {

            lineY = Math.floor(lineY) + 0.5;

        }

        waveformYLabels.push({
            labelX: wavLabelX,
            labelY: markerY,
            label: waveformLabelTexts[i],
            lineX0: wavMarkerX,
            lineY0: lineY,
            lineX1: labelAreaWidth,
            lineY1: lineY
        });

    }

    // Draw x axis labels

    let label = 0;

    // Get the label increment amount and label decimal precision

    const increments = {
        60: 15,
        20: 4,
        10: 2,
        5: 1,
        1: 0.2
    };

    const xLabelIncrementSecs = increments[displayWidth];

    const xLabelIncrementSamples = xLabelIncrementSecs * sampleRate;

    // So the centre of the text can be the label location, there's a small amount of padding around the label canvas
    const xLabelPadding = labelAreaWidth;

    const sampleCount = displayWidth * sampleRate;

    while (label <= sampleCount) {

        // Convert the time to a pixel value, then take into account the label width and the padding to position correctly

        const x = samplesToPixels(label, sampleCount);

        if (x < 0) {

            label += xLabelIncrementSamples;
            continue;

        }

        if (x > waveformCanvas.width) {

            break;

        }

        let labelX = x;
        let tickX = x + xLabelPadding;

        const xLabelEdgeOffset = 2;

        labelX = (labelX === 0) ? labelX + xLabelEdgeOffset : labelX;
        labelX = (labelX === waveformCanvas.width) ? labelX - xLabelEdgeOffset : labelX;

        labelX += xLabelPadding;

        const labelText = label / sampleRate;

        // Ticks must be offset to 0.5, end tick must align with end of plot

        tickX = (tickX >= waveformCanvas.width) ? tickX - 0.5 : tickX;
        tickX = Math.floor(tickX) + 0.5;

        xLabels.push({
            labelX,
            labelY: 12,
            label: labelText,
            lineX0: tickX,
            lineY0: 0,
            lineX1: tickX,
            lineY1: xMarkerLength
        });

        label += xLabelIncrementSamples;

    }

}

exports.getCanvas = (displayWidth, sampleRate, title) => {

    // Draw to export canvas

    const ctx = exportCanvas.getContext('2d');

    // Fill background

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);

    const plotSpacing = h - (topSpacing + waveformCanvas.height + spectrogramCanvas.height + xAxisH + edgeSpacingH);

    ctx.drawImage(waveformCanvas, yAxisW, topSpacing);
    ctx.drawImage(spectrogramCanvas, yAxisW, topSpacing + waveformCanvas.height + plotSpacing);

    // Give plots a border

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    ctx.rect(yAxisW + 0.5, topSpacing + 0.5, waveformCanvas.width - 1, waveformCanvas.height - 1);

    ctx.rect(yAxisW + 0.5, topSpacing + waveformCanvas.height + plotSpacing + 0.5, spectrogramCanvas.width - 1, spectrogramCanvas.height - 1);
    ctx.stroke();

    // Add x axis labels

    prepareAxisLabels(sampleRate, displayWidth);

    ctx.strokeStyle = 'black';

    // Y axis labels give an offset to the plots on the site

    const xOffset = 45;

    const yOffset0 = topSpacing + waveformH;
    const yOffset1 = topSpacing + waveformH + plotSpacing + spectrogramH;

    ctx.font = '10px Helvetica';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < xLabels.length; i++) {

        let tickX = xLabels[i].lineX0 + yAxisW - xOffset;
        tickX = tickX - (tickX % 1) + 0.5;

        ctx.beginPath();
        ctx.moveTo(tickX, yOffset0);
        ctx.lineTo(tickX, yOffset0 + 5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tickX, yOffset1);
        ctx.lineTo(tickX, yOffset1 + 5);
        ctx.stroke();

        const labelX = xLabels[i].labelX + yAxisW - xOffset;
        const labelText = xLabels[i].label;

        ctx.fillText(labelText, labelX, yOffset1 + 7);

    }

    // Add waveform canvas y axis labels

    ctx.strokeStyle = 'black';

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < waveformYLabels.length; i++) {

        let y = waveformYLabels[i].lineY0;
        y = y - (y % 1) + 0.5;
        y += topSpacing;

        const labelText = waveformYLabels[i].label;

        ctx.beginPath();
        ctx.moveTo(yAxisW, y);
        ctx.lineTo(yAxisW - 5, y);
        ctx.stroke();

        ctx.fillText(labelText, yAxisW - 7, y);

    }

    // Add spectrogram canvas y axis labels

    ctx.textBaseline = 'middle';

    for (let i = 0; i < spectrogramYLabels.length; i++) {

        let y = spectrogramYLabels[i].lineY0;
        y = y - (y % 1) + 0.5;
        y += topSpacing + waveformH + plotSpacing;

        const labelText = spectrogramYLabels[i].label;

        ctx.beginPath();
        ctx.moveTo(yAxisW, y);
        ctx.lineTo(yAxisW - 5, y);
        ctx.stroke();

        ctx.fillText(labelText, yAxisW - 7, y);

    }

    // Add titles

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.fillText('Time (s)', yAxisW + (waveformW / 2), topSpacing + waveformH + plotSpacing + spectrogramH + xAxisMarkerH);

    ctx.save();
    ctx.translate(edgeSpacingW, topSpacing + (waveformH / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Amplitude', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(edgeSpacingW, topSpacing + waveformH + plotSpacing + (spectrogramH / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Frequency', 0, 0);
    ctx.restore();

    ctx.font = '13px Helvetica';
    ctx.fillText(title, yAxisW + (waveformW / 2), edgeSpacingH + 8);

    return exportCanvas;

};

// Main exported update function

exports.prepare = (audioBuffer, stftBuffer, index, count, displayWidth, sampleRate, lowAmpColourScaleEnabled) => {

    const displayWidthSamples = displayWidth * sampleRate;

    resetWaveform();
    resetSpectrogram();
    resetExportCanvas();

    let numberOfSamples = count;

    numberOfSamples = Math.min(count, displayWidthSamples);

    for (let i = 0; i < stftArray.length; i += 1) stftArray[i] = 0;

    positionInColumn = 0;

    const offset = (audioBuffer.length + index - numberOfSamples) % audioBuffer.length;

    // Calculate step size based on samples per column

    const stepSize = pixelWidth / displayWidthSamples;

    // Calculate expected number of columns

    const expectedNumberOfColumns = Math.floor(positionInColumn + numberOfSamples * stepSize);

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

                drawWaveformColumn(expectedNumberOfColumns - numberOfColumns);

                drawSpectrogramColumn(expectedNumberOfColumns - numberOfColumns, lowAmpColourScaleEnabled);

                numberOfColumns += 1;

                positionInColumn -= 1;

                newColumn = true;

            }

        }

    }

    // Check for missing column due to rounding errors

    if (numberOfColumns < expectedNumberOfColumns) {

        drawWaveformColumn(expectedNumberOfColumns - numberOfColumns);

        drawSpectrogramColumn(expectedNumberOfColumns - numberOfColumns, lowAmpColourScaleEnabled);

        positionInColumn -= 1;

        newColumn = true;

    }

    // If less data than the display width has been collected, draw a baseline through the centre

    if (numberOfSamples !== displayWidthSamples) {

        const row = Math.round(waveformPixelHeight / 2);
        const r = row * pixelWidth;

        for (let col = 0; col < pixelWidth; col++) {

            waveformPixels[r + col] = constants.PIXEL_COLOUR;

        }

    }

    // Update the image

    waveformCtx.putImageData(waveformImageData, 0, 0);

    spectrogramCtx.putImageData(spectrogramImageData, 0, 0);

};

exports.savePDF = (displayWidth, sampleRate, fileName, exportPath) => {

    prepareAxisLabels(sampleRate, displayWidth);

    const plotSpacing = h - (topSpacing + waveformCanvas.height + spectrogramCanvas.height + xAxisH + edgeSpacingH);

    // Create document

    // eslint-disable-next-line new-cap
    const pdfDoc = new jsPDF.jsPDF({
        orientation: 'landscape',
        hotfixes: ['px_scaling'],
        unit: 'px',
        format: [w, h]
    });

    customFont.addFont(pdfDoc);
    pdfDoc.setFont('FreeSans', 'normal');

    // Draw plots to canvas

    pdfDoc.addImage(waveformCanvas, 'PNG', yAxisW, topSpacing);
    pdfDoc.addImage(spectrogramCanvas, 'PNG', yAxisW, topSpacing + waveformCanvas.height + plotSpacing);

    // Give plots a border

    pdfDoc.setDrawColor('#000000');

    pdfDoc.rect(yAxisW, topSpacing, waveformCanvas.width, waveformCanvas.height);
    pdfDoc.rect(yAxisW, topSpacing + waveformCanvas.height + plotSpacing, spectrogramCanvas.width, spectrogramCanvas.height);

    // Add x axis labels

    pdfDoc.setDrawColor('#000000');

    const xOffset = 45;
    const yOffset0 = topSpacing + waveformCanvas.height;
    const yOffset1 = topSpacing + waveformCanvas.height + plotSpacing + spectrogramCanvas.height;

    pdfDoc.setFontSize(7);
    pdfDoc.setTextColor('#000000');

    for (let i = 0; i < xLabels.length; i++) {

        let tickX = parseFloat(xLabels[i].lineX0) + yAxisW - xOffset;

        tickX = (i === 0) ? tickX - 0.5 : tickX;
        tickX = (i === xLabels.length - 1) ? tickX + 0.5 : tickX;

        pdfDoc.line(tickX, yOffset0, tickX, yOffset0 + 5);
        pdfDoc.line(tickX, yOffset1, tickX, yOffset1 + 5);

        const labelText = xLabels[i].label.toString();
        const labelX = parseFloat(xLabels[i].labelX) + yAxisW - xOffset;

        let labelAnchor = 'center';
        labelAnchor = (i === 0) ? 'left' : 'center';
        labelAnchor = (i === xLabels.length - 1) ? 'right' : 'center';

        pdfDoc.text(labelText, labelX, yOffset1 + 15, {align: labelAnchor});

    }

    // Add waveform y axis labels

    for (let i = 0; i < waveformYLabels.length; i++) {

        let y = parseFloat(waveformYLabels[i].lineY0);
        const labelText = waveformYLabels[i].label.toString();

        y += topSpacing;

        y = (i === waveformYLabels.length - 1) ? y - 0.5 : y;
        y = (i === 0) ? y + 0.5 : y;

        pdfDoc.line(yAxisW, y, yAxisW - 5, y);

        pdfDoc.text(labelText, yAxisW - 7, y, {align: 'right', baseline: 'middle'});

    }

    // Add spectrogram y axis labels

    for (let i = 0; i < spectrogramYLabels.length; i++) {

        let y = parseFloat(spectrogramYLabels[i].lineY0);
        y += topSpacing + waveformCanvas.height + plotSpacing;

        const labelText = spectrogramYLabels[i].label.toString();

        y = (i === 0) ? y + 0.5 : y;
        y = (i === spectrogramYLabels.length - 1) ? y - 0.5 : y;

        pdfDoc.line(yAxisW, y, yAxisW - 5, y);

        pdfDoc.text(labelText, yAxisW - 7, y, {align: 'right', baseline: 'middle'});

    }

    // Add titles

    pdfDoc.text('Time (s)', yAxisW + (waveformCanvas.width / 2), topSpacing + waveformCanvas.height + plotSpacing + spectrogramCanvas.height + xAxisMarkerH, {align: 'center', baseline: 'top'});

    // jsPDF breaks if you try to centre align rotated text, so you have to hard code an offset
    const textOffsetY = 20;

    pdfDoc.text('Amplitude', edgeSpacingW + 5, topSpacing + (waveformCanvas.height / 2) + textOffsetY, null, 90);

    pdfDoc.text('Frequency', edgeSpacingW + 5, topSpacing + waveformCanvas.height + plotSpacing + (spectrogramCanvas.height / 2) + 25, null, 90);

    pdfDoc.setFontSize(11);
    pdfDoc.text(fileName + '.WAV', yAxisW + (waveformCanvas.width / 2), edgeSpacingH + 2, {align: 'center', baseline: 'top'});

    pdfDoc.save(exportPath);

};
