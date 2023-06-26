/****************************************************************************
 * constants.js
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

// Byte constants

exports.BYTES_IN_FLOAT64 = 8;
exports.BYTES_IN_UINT32 = 4;

// Colour constants

exports.STATIC_COLOUR_MIN = 2.0;
exports.STATIC_COLOUR_MAX = 15.0;

exports.LOW_AMP_COLOUR_MIN = -3.0;
exports.LOW_AMP_COLOUR_MAX = 12.0;

exports.PIXEL_COLOUR = (255 << 24) | (153 << 16) | (77 << 8) | 0;
exports.PIXEL_COLOUR_NIGHT = (220 << 24) | (250 << 16) | (170 << 8) | 0;

// STFT constants

const STFT_INPUT_SAMPLES = 512;
const STFT_OUTPUT_SAMPLES = 256;

exports.STFT_INPUT_SAMPLES = STFT_INPUT_SAMPLES;
exports.STFT_OUTPUT_SAMPLES = STFT_OUTPUT_SAMPLES;
exports.STFT_INPUT_OUTPUT_RATIO = STFT_INPUT_SAMPLES / STFT_OUTPUT_SAMPLES;

// Waveform constants

exports.INT16_MIN = -32768;
exports.INT16_MAX = 32767;

// Export types

exports.EXPORT_PNG = 0;
exports.EXPORT_JPG = 1;
exports.EXPORT_PDF = 2;
