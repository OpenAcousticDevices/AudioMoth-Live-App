const backstage = require('./build/Release/backstage');

/**
 * Initialise backstage
 * @returns {Int16Array} audioBuffer - Typed array containing audio samples
 * @returns {Float64Array} stftBuffer - Typed array containing STFT results
 * @returns {boolean} success - Did the initialisation succeed
 */
exports.initialise = backstage.initialise;

/**
 * @param {number} sampleRate The sample rate in Hertz
 */
exports.changeSampleRate = backstage.changeSampleRate;

/**
 * @param {boolean} checkDevices Whether to check for microhones on this frame
 * @returns {boolean} redrawRequired - Should plot(s) be redrawn with all data
 * @returns {boolean} usingAudioMoth - Whether the current device an AudioMoth USB Microphone.
 * @returns {boolean} oldAudioMothFound - Whether an old AudioMoth USB Microphone was found.
 * @returns {number} maximumSampleRate - Max supported sample rate
 * @returns {number} currentSampleRate - Sample rate of data collection
 * @returns {number} audioTime - Local time in milliseconds of the last sample
 * @returns {number} audioIndex - Index of the next sample to be collected
 * @returns {number} audioCount - How many samples have been collected last start
 */
exports.getFrame = backstage.getFrame;

/**
 * Clears the audio buffer
 */
exports.clear = backstage.clear;

/**
 * Capture audio to WAV file
 * @param {number} duration How many seconds to capture
 * @param {function} callback Function that receives boolean indicating success or failure
 */
exports.capture = backstage.capture;

/**
 * Inform backstage that frontend has paused
 * @param {boolean} enable Whether to enable or disable pause
 * @param {number} displayWidth The current display width
 * @returns {number} audioTime - Timestamp of the buffer at this point
 * @returns {number} audioIndex - Index of the next sample to be collected
 * @returns {number} audioCount - How many samples have been collected last start
 */
exports.setPause = backstage.setPause;

/**
 * Set the destination folder for WAV files
 * @param {string} destination The folder where capture and autosave WAV files will be saved
 */
exports.setFileDestination = backstage.setFileDestination;

/**
 * Set the callback for receiving failure alerts for auto saved WAV files
 * @param {function} callback Callback is called when a autosave error occurs
 */
exports.setAutoSaveCallback = backstage.setAutoSaveCallback;

/**
 * Set the maximum duration of auto saved WAV files
 * @param {number} duration How many minutes to make each autosave file
 */
exports.setAutoSave = backstage.setAutoSave;

/**
 * Get information on the examples supported by the simulator
 * @returns {array} descriptions Description of each example
 */
exports.getSimulationInfo = backstage.getSimulationInfo;

/**
 * Set simulation mode
 * @param {boolean} enable Whether simulation is enabled
 * @param {number} index Which simulation to enable
 * @returns {boolean} Success or failure
 */
exports.setSimulation = backstage.setSimulation;

/**
 * Set monitor output mode
 * @param {number} mode Which mode to use (MONITOR_OFF, MONITOR_PLAYTHROUGH, MONITOR_HETERODYNE)
 * @param {number} frequency Mixing frequency for heterodyne output
 */
exports.setMonitor = backstage.setMonitor;

exports.MONITOR_OFF = 0;
exports.MONITOR_PLAYTHROUGH = 1;
exports.MONITOR_HETERODYNE = 2;

/**
 * Set 384kHz sampling for default input
 * @param {boolean} enable Whether to use 384kHz sampling
 */
exports.setHighDefaultSampleRate = backstage.setHighDefaultSampleRate;

/**
 * Set 384kHz sampling for default input
 * @param {boolean} enable Whether to use local time
 */
exports.setLocalTime = backstage.setLocalTime;

/**
 * Shutdown
 */
exports.forceAutoSaveToStop = backstage.forceAutoSaveToStop;
