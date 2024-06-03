/****************************************************************************
 * backstage.c
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

#include <stdio.h>
#include <node_api.h>

#ifdef __APPLE__
    #define MA_NO_RUNTIME_LINKING
#endif

#define MINIAUDIO_IMPLEMENTATION

#include "stft.h"
#include "xtime.h"
#include "macros.h"
#include "threads.h"
#include "wavFile.h"
#include "autosave.h"
#include "miniaudio.h"
#include "simulator.h"
#include "heterodyne.h"

/* Callback constants */

#define CALLBACKS_PER_SECOND                100

/* Capture constants */

#define NUMBER_OF_VALID_SAMPLE_RATES        8
#define MAXIMUM_RECORD_DURATION             60
#define DEFAULT_SAMPLE_RATE                 48000
#define MAXIMUM_SAMPLE_RATE                 384000

#define AUDIO_BUFFER_SIZE                   (1 << 25)
#define CAPTURE_BUFFER_SIZE                 (MAXIMUM_RECORD_DURATION * MAXIMUM_SAMPLE_RATE)

/* Buffer constants */

#define FILE_TIME_BUFFER                    1024
#define DEVICE_NAME_SIZE                    1024
#define FILEPATH_SIZE                       8192
#define FILENAME_SIZE                       8192

/* Unit conversion constants */

#define HERTZ_IN_KILOHERTZ                  1000

#define SECONDS_IN_MINUTE                   60
#define MINUTES_IN_HOUR                     60
#define MILLISECONDS_IN_SECOND              1000
#define MICROSECONDS_IN_SECOND              1000000

/* STFT constants */

#define STFT_INPUT_SAMPLES                  512
#define NUMBER_OF_BYTES_IN_FLOAT32          4
#define STFT_INPUT_OUTPUT_RATIO             2

/* Frame timer constants */

#define TIME_MISMATCH_LIMIT                 2000

/* Device check constant */

#define DEVICE_STOP_START_TIMEOUT           2.0
#define DEVICE_CHANGE_INTERVAL              1.0
#define DEVICE_CHECK_INTERVAL               (MICROSECONDS_IN_SECOND / 4)

/* Monitor constants */

#define PLAYBACK_SAMPLE_RATE                48000

#if IS_WINDOWS
    #define MAXIMUM_PLAYBACK_LAG            (CALLBACKS_PER_SECOND / 2)
    #define TARGET_PLAYBACK_LAG             (CALLBACKS_PER_SECOND / 5)
    #define TARGET_MINIMUM_PLAYBACK_LAG     (CALLBACKS_PER_SECOND / 10)
#else
    #define MAXIMUM_PLAYBACK_LAG            (CALLBACKS_PER_SECOND / 4)
    #define TARGET_PLAYBACK_LAG             (CALLBACKS_PER_SECOND / 10)
    #define TARGET_MINIMUM_PLAYBACK_LAG     (CALLBACKS_PER_SECOND / 20)
#endif

#define MINIMUM_PLAYBACK_LAG                2

#define MONITOR_OFF                         0
#define MONITOR_PLAYTHROUGH                 1
#define MONITOR_HETERODYNE                  2

/* Autosave constants */

#define AUTOSAVE_EVENT_QUEUE_SIZE           16

#define DEVICE_SHUTDOWN_TIMEOUT             2.0

/* Audio buffer variables */

static int16_t *audioBuffer;

static int64_t audioBufferStartTime;

static int32_t audioBufferIndex;

static int32_t audioBufferWriteIndex;

static int64_t audioBufferSampleCount;

static pthread_mutex_t audioBufferMutex;

/* Working STFT buffer */

static float* stftBuffer;

/* Capture buffer variables */

static char captureBufferDeviceCommentName[DEVICE_NAME_SIZE];

static int16_t captureBuffer[CAPTURE_BUFFER_SIZE];

static int64_t captureBufferSampleCount;

static int32_t captureBufferWriteIndex;

static int32_t captureBufferSampleRate;

static int64_t captureBufferStartTime;

static int32_t captureBufferLength;

static int32_t captureBufferLocalTimeOffset;

static napi_threadsafe_function captureBufferThreadSafeCallback;

static pthread_t captureBufferThread;

static bool captureBufferSuccess;

/* Playback variables */

static pthread_t startPlaybackThread;

static pthread_t stopPlaybackThread;

/* Simulation variables */

static int32_t simulationIndex;

static bool shouldStopSimulation;

static bool shouldStartSimulation;

static pthread_t simulationThread;

static bool simulationRunning;

static pthread_mutex_t simulationRunningMutex;

static int16_t simulationBuffer[MAXIMUM_SAMPLE_RATE / CALLBACKS_PER_SECOND];

/* Frontend state variables */

static double timeDeviceStarted;

static bool heterodyneEnabled;

static bool monitorEnabled;

static bool frontEndPaused;

static ma_timer timer;

/* File destination variables */

static bool fileDestinationSet;

static pthread_mutex_t fileDestinationMutex;

static char fileDestination[FILEPATH_SIZE];

/* Local time variable */

static bool useLocalTime = true;

static pthread_mutex_t localTimeMutex;

/* Background thread variables */

static pthread_t backgroundThread;

static pthread_mutex_t backgroundMutex;

static double backgroundDeviceCheckTime;

static pthread_mutex_t backgroundDeviceCheckMutex;

static bool backgroundDeviceCheckFoundAudioMoth;

static bool backgroundDeviceCheckFoundOldAudioMoth;

/* Autosave capture variables */

static int32_t autosaveDuration;

static int64_t autosaveStartTime;

static int64_t autosaveSampleCount;

static int64_t autosaveStartSampleCount;

/* Autosave file variables */

static time_t autosaveFileStartTime;

static int32_t autosaveFileStartIndex;

static int64_t autosaveFileStartCount;

static int32_t autosaveFileSampleRate;

/* Autosave state variables */

static bool autosaveShutdownCompleted;

static pthread_mutex_t autosaveMutex;

static int64_t autosaveTargetCount = INT64_MAX;

static bool autosaveWaitingForStartEvent = true;

static char autosaveInputDeviceCommentName[DEVICE_NAME_SIZE];

static napi_threadsafe_function autosaveThreadSafeCallback;

/* Playback start variables */

static int32_t playbackReadIndex = 0;

static int32_t playbackBufferCount = 1;

static int32_t minimumPlaybackBufferLag = INT32_MAX;

static pthread_mutex_t playbackMutex;

/* Miniaudio contexts */

static ma_context playbackContext;

static ma_context deviceCheckContext;

/* Stop and start variable */

static bool stopped;

static bool started;

static pthread_mutex_t stopStartMutex;

/* State variables */

static bool usingAudioMoth;

static ma_device captureDevice;

static ma_device playbackDevice;

static ma_device_id audioMothDeviceID;

static bool shouldSetRedrawFlag = true;

static bool requestedSampleRateChanged = false;

static int32_t requestedMaximumDefaultSampleRate;

static bool maximumDefaultSampleRateChanged = false;

/* Sample rate variables */

static int32_t currentSampleRate;

static int32_t audioMothSampleRate;

static int32_t requestedSampleRate = DEFAULT_SAMPLE_RATE;

static int32_t maximumDefaultSampleRate = DEFAULT_SAMPLE_RATE;

static int32_t validSampleRates[NUMBER_OF_VALID_SAMPLE_RATES] = {8000, 16000, 32000, 48000, 96000, 192000, 250000, 384000};

/* Input device variables */

static int32_t inputDeviceSampleRate;

static char inputDeviceName[DEVICE_NAME_SIZE];

static char inputDeviceCommentName[DEVICE_NAME_SIZE];

/* NAPI variables */

static napi_value napi_value_null;

static napi_value napi_value_true;

static napi_value napi_value_false;

static napi_value napi_value_undefined;

static napi_value napi_audioArrayBuffer;

static napi_value napi_audioTypedArray;

static napi_value napi_stftArrayBuffer;

static napi_value napi_stftTypedArray;

/* Structure for device check */

typedef struct {
    bool audioMothFound;
    bool oldAudioMothFound;
} device_check_t;

/* Structure for device enumeration */

typedef struct {
    bool updateAudioMothSettings;
    device_check_t device_check;
} enumerate_devices_t;

/* Callbacks to handle capture and playback of audio samples */

void capture_notification_callback(const ma_device_notification *pNotification) {

    if (pNotification->type == ma_device_notification_type_started) { }

    if (pNotification->type == ma_device_notification_type_stopped) {
        
        pthread_mutex_lock(&stopStartMutex);
        
        stopped = true;

        pthread_mutex_unlock(&stopStartMutex);

    }

    if (pNotification->type == ma_device_notification_type_rerouted) { }

    if (pNotification->type == ma_device_notification_type_interruption_began) { }

    if (pNotification->type == ma_device_notification_type_interruption_ended) { }

}

void playback_data_callback(ma_device *pDevice, void *pOutput, const void *pInput, ma_uint32 frameCount) {

    int16_t *outputBuffer = (int16_t*)pOutput;

    /* Static playback variables */

    static double playbackPosition = 0;

    static double playbackNextSample = 0;

    static double playbackCurrentSample = 0;

    static bool playbackBufferWaiting = false;

    /* Calculate the buffer lag */

    int32_t sampleLag = (AUDIO_BUFFER_SIZE + audioBufferWriteIndex - playbackReadIndex) % AUDIO_BUFFER_SIZE;

    int32_t bufferLag = sampleLag * CALLBACKS_PER_SECOND / currentSampleRate;

    /* Check minimum buffer lag */

    if (bufferLag > MAXIMUM_PLAYBACK_LAG) {
       
        playbackReadIndex = audioBufferWriteIndex;

        playbackBufferWaiting = true;

        sampleLag = 0;

        bufferLag = 0;

    }

    /* Update shared global variables */

    bool starvation = sampleLag < (int32_t)frameCount;

    pthread_mutex_lock(&playbackMutex);

    minimumPlaybackBufferLag = MIN(bufferLag, minimumPlaybackBufferLag);

    playbackBufferCount += playbackBufferWaiting == false && (bufferLag < MINIMUM_PLAYBACK_LAG || starvation) ? 2 : 0;

    pthread_mutex_unlock(&playbackMutex);

    /* Provide samples to playback device */

    if (playbackBufferWaiting || starvation) {

        for (ma_uint32 i = 0; i < frameCount; i += 1) outputBuffer[i] = 0;

    } else {

        if (heterodyneEnabled) Heterodyne_normalise();

        int32_t sampleRateDivider = MAXIMUM_SAMPLE_RATE / PLAYBACK_SAMPLE_RATE;

        double step = (double)currentSampleRate / (double)MAXIMUM_SAMPLE_RATE;

        for (ma_uint32 i = 0; i < frameCount; i += 1) {

            double playbackAccumulator = 0;

            for (int32_t j = 0; j < sampleRateDivider; j += 1) {

                double sample = playbackCurrentSample + playbackPosition * (playbackNextSample - playbackCurrentSample);

                playbackAccumulator += heterodyneEnabled ? Heterodyne_nextOutput(sample) : sample;

                playbackPosition += step;

                if (playbackPosition >= 1.0) {

                    playbackCurrentSample = playbackNextSample;

                    playbackNextSample = audioBuffer[playbackReadIndex];

                    playbackReadIndex = (playbackReadIndex + 1) % AUDIO_BUFFER_SIZE;

                    playbackPosition -= 1.0;

                }

            }

            double sample = MAX(INT16_MIN, MIN(INT16_MAX, round(playbackAccumulator / (double)sampleRateDivider)));

            outputBuffer[i] = (int16_t)sample;

        }

    }

    if (bufferLag > TARGET_PLAYBACK_LAG) playbackBufferWaiting = false;

}

void capture_data_callback(ma_device *pDevice, void *pOutput, const void *pInput, ma_uint32 frameCount) {

    int64_t startTime = 0;

    int32_t increment = 0;

    int16_t *inputBuffer = (int16_t*)pInput;

    int32_t sampleRateDivider = (int32_t)ceil(inputDeviceSampleRate / currentSampleRate);

    int32_t interpolationSampleRate = sampleRateDivider * currentSampleRate;

    double step = (double)inputDeviceSampleRate / (double)interpolationSampleRate;

    /* Static resample variables */

    static int32_t resampleCounter = 0;

    static double resamplePosition = 0;

    static double resampleNextSample = 0;

    static double resampleAccumulator = 0;

    static double resampleCurrentSample = 0;

    /* Check for restart */

    pthread_mutex_lock(&stopStartMutex);

    bool restart = started == false;

    pthread_mutex_unlock(&stopStartMutex);

    if (restart) {

        /* Get start time */

        startTime = Time_getMillisecondUTC();

        /* Reset resampler */

        resampleCounter = 0;

        resamplePosition = 0;

        resampleNextSample = 0;

        resampleAccumulator = 0;

        resampleCurrentSample = 0;

    }

    /* Process samples */

    for (ma_uint32 i = 0; i < frameCount; i += 1) {

        resampleCurrentSample = resampleNextSample;

        resampleNextSample = inputBuffer[i];

        while (resamplePosition < 1.0) {

            resampleAccumulator += resampleCurrentSample + resamplePosition * (resampleNextSample - resampleCurrentSample);

            resampleCounter += 1;

            if (resampleCounter == sampleRateDivider) {

                double sample = MAX(INT16_MIN, MIN(INT16_MAX, round(resampleAccumulator / (double)sampleRateDivider)));

                audioBuffer[audioBufferIndex] = (int16_t)sample;

                if (audioBufferIndex % STFT_INPUT_SAMPLES == STFT_INPUT_SAMPLES - 1) {

                    int32_t startIndex = audioBufferIndex - STFT_INPUT_SAMPLES + 1;

                    STFT_transform(audioBuffer, startIndex, stftBuffer, startIndex / STFT_INPUT_OUTPUT_RATIO);

                    increment += STFT_INPUT_SAMPLES;

                }

                audioBufferIndex = (audioBufferIndex + 1) % AUDIO_BUFFER_SIZE;

                resampleAccumulator = 0;

                resampleCounter = 0;

            }

            resamplePosition += step;

        }

        resamplePosition -= 1.0;
    
    }   

    pthread_mutex_lock(&audioBufferMutex);

    audioBufferWriteIndex = (audioBufferWriteIndex + increment) % AUDIO_BUFFER_SIZE;

    if (restart) {
        
        autosaveStartTime = startTime;

        audioBufferStartTime = startTime;

        autosaveStartSampleCount = autosaveSampleCount;

    }

    audioBufferSampleCount += increment;

    autosaveSampleCount += increment;

    pthread_mutex_unlock(&audioBufferMutex);

    if (restart) {

        pthread_mutex_lock(&stopStartMutex);

        started = true;

        pthread_mutex_unlock(&stopStartMutex);

    }

}

/* Functions to check for AudioMoth */

ma_bool32 enumerate_devices_callback(ma_context *pContext, ma_device_type deviceType, const ma_device_info* deviceInfo, void *pUserData) {

    enumerate_devices_t *enumerateDevices = (enumerate_devices_t*)pUserData;

    if (strstr(deviceInfo->name, "F32x USBXpress Device")) enumerateDevices->device_check.oldAudioMothFound = true;

    if (strstr(deviceInfo->name, "AudioMoth")) {

        if (strstr(deviceInfo->name, "kHz AudioMoth") == NULL) enumerateDevices->device_check.oldAudioMothFound = true;

        enumerateDevices->device_check.audioMothFound = true;

        if (enumerateDevices->updateAudioMothSettings) { 

            memcpy(&audioMothDeviceID, &(deviceInfo->id), sizeof(ma_device_id));

            char *digit = strstr(deviceInfo->name, "kHz") - 1;

            if (digit == NULL) {

                audioMothSampleRate = MAXIMUM_SAMPLE_RATE;

            } else {

                int32_t multiplier = 1000;

                audioMothSampleRate = 0;

                do {

                    audioMothSampleRate += multiplier * (*digit - '0');

                    multiplier *= 10;

                    digit -= 1;

                } while (*digit >= '0' && *digit <= '9');

            }

        }

        return MA_FALSE;

    }

    return MA_TRUE;

}

static device_check_t checkForAudioMoth(ma_context *context, bool updateAudioMothSettings) {

    enumerate_devices_t info = {
        .updateAudioMothSettings = updateAudioMothSettings,
        .device_check.oldAudioMothFound = false,
        .device_check.audioMothFound = false
    };

    ma_result result = ma_context_enumerate_devices(context, enumerate_devices_callback, (void*)&info);

    if (result != MA_SUCCESS) {

        device_check_t device_check = {
            .oldAudioMothFound = false,
            .audioMothFound = false
        };

        return device_check;

    }

    return info.device_check;
    
}

/* Thread functions to start and stop capture device */

static bool startMicrophone(ma_context *context, bool usingAudioMoth) {

    /* Initialise capture device */

    ma_device_config captureDeviceConfig = ma_device_config_init(ma_device_type_capture);

    captureDeviceConfig.capture.pDeviceID = usingAudioMoth ? &audioMothDeviceID : NULL;
    captureDeviceConfig.capture.format = ma_format_s16;
    captureDeviceConfig.capture.channels = 1;
    captureDeviceConfig.capture.shareMode  = ma_share_mode_shared;

    inputDeviceSampleRate = usingAudioMoth ? audioMothSampleRate : maximumDefaultSampleRate;

    sprintf(inputDeviceName, usingAudioMoth ? "%dkHz AudioMoth USB Microphone" : "%dkHz Default Input", inputDeviceSampleRate / HERTZ_IN_KILOHERTZ);

    sprintf(inputDeviceCommentName, usingAudioMoth ? "a %dkHz AudioMoth USB Microphone" : "the %dkHz default input", inputDeviceSampleRate / HERTZ_IN_KILOHERTZ);

    currentSampleRate = MIN(requestedSampleRate, inputDeviceSampleRate);

    requestedSampleRate = currentSampleRate;

    captureDeviceConfig.sampleRate = inputDeviceSampleRate;
    captureDeviceConfig.periodSizeInFrames = inputDeviceSampleRate / CALLBACKS_PER_SECOND;
    captureDeviceConfig.dataCallback = capture_data_callback;
    captureDeviceConfig.notificationCallback = capture_notification_callback;

    ma_result result = ma_device_init(context, &captureDeviceConfig, &captureDevice);

    if (result != MA_SUCCESS) return false;

    /* Start the capture device */

    result = ma_device_start(&captureDevice);

    if (result != MA_SUCCESS) return false;

    return true;

}

void stopMicrophone(void) {

    ma_device_stop(&captureDevice);

    ma_device_uninit(&captureDevice);
        
    memset(&captureDevice, 0, sizeof(ma_device));

}

/* Static thread functions to start and stop playback device */

static void *startPlaybackThreadBody(void *ptr) {

    /* Initialise playback device */

    ma_device_config playbackDeviceConfig = ma_device_config_init(ma_device_type_playback);

    playbackDeviceConfig.playback.pDeviceID = NULL;
    playbackDeviceConfig.playback.format = ma_format_s16;
    playbackDeviceConfig.playback.channels = 1;

    playbackDeviceConfig.sampleRate = PLAYBACK_SAMPLE_RATE;
    playbackDeviceConfig.periodSizeInFrames = PLAYBACK_SAMPLE_RATE / CALLBACKS_PER_SECOND;
    playbackDeviceConfig.dataCallback = playback_data_callback;
    playbackDeviceConfig.notificationCallback = NULL;

    ma_result result = ma_device_init(&playbackContext, &playbackDeviceConfig, &playbackDevice);

    if (result != MA_SUCCESS) {
        
        puts("[BACKSTAGE] Failed to initialise playback device");

        return NULL;

    }

    /* Start the playback device */

    result = ma_device_start(&playbackDevice);

    if (result != MA_SUCCESS) puts("[BACKSTAGE] Failed to start playback device");

    return NULL;

}

static void *stopPlaybackThreadBody(void *ptr) {

    ma_device_stop(&playbackDevice);

    ma_device_uninit(&playbackDevice);
        
    memset(&playbackDevice, 0, sizeof(ma_device));

    return NULL;
    
}

/* Thread safe callback function */

static void threadSafeNullCallback(napi_env env, napi_value callback, void *context, void *data) {

    NAPI_CALL(env, "Failed to call function", napi_call_function(env, napi_value_undefined, callback, 1, &napi_value_null, NULL))

}

static void threadSafeBooleanCallback(napi_env env, napi_value callback, void *context, void *data) {
 
    bool *result = (bool*)data;

    NAPI_CALL(env, "Failed to call function", napi_call_function(env, napi_value_undefined, callback, 1, *result ? &napi_value_true : &napi_value_false, NULL))

}

/* Simulation thread */

static void *simulationThreadBody(void *ptr) {

    int32_t counter = 0;

    int32_t bufferLag = TARGET_MINIMUM_PLAYBACK_LAG;

    while (true) {

        /* Prepare data and call audio capture function */

        int32_t frameCount = inputDeviceSampleRate / CALLBACKS_PER_SECOND;

        pthread_mutex_lock(&playbackMutex);

        int32_t iterations = playbackBufferCount;

        playbackBufferCount = 1;

        pthread_mutex_unlock(&playbackMutex);

        for (int32_t j = 0; j < iterations; j += 1) {

            for (int32_t i = 0; i < frameCount; i += 1) simulationBuffer[i] = Simulator_nextSample();

            capture_data_callback(NULL, NULL, (void*)simulationBuffer, frameCount);

        }

        /* Check flag */

        pthread_mutex_lock(&simulationRunningMutex);

        bool running = simulationRunning;

        pthread_mutex_unlock(&simulationRunningMutex);

        if (running == false) break;

        /* Check the minimum buffer lag */

        counter += 1;

        if (counter == CALLBACKS_PER_SECOND) {

            pthread_mutex_lock(&playbackMutex);

            bufferLag = minimumPlaybackBufferLag;

            minimumPlaybackBufferLag = INT32_MAX;

            pthread_mutex_unlock(&playbackMutex);

            counter = 0;

        }

        /* Calculate delay period to wait for next update */

        uint32_t interval;

        uint32_t microseconds = Time_getMicroseconds();

        if (bufferLag < MAXIMUM_PLAYBACK_LAG) {

            interval = MICROSECONDS_IN_SECOND / (CALLBACKS_PER_SECOND + TARGET_MINIMUM_PLAYBACK_LAG - bufferLag);

        } else {

            interval = MICROSECONDS_IN_SECOND / CALLBACKS_PER_SECOND;

        }

        uint32_t delay = interval - microseconds % interval;

        usleep(delay);

    }

    pthread_mutex_lock(&stopStartMutex);

    stopped = true;

    pthread_mutex_unlock(&stopStartMutex);

    return NULL;
    
}

/* Static capture functions */

static void captureAudioBuffer(int32_t duration) {

    /* Read local time offset */

    pthread_mutex_lock(&localTimeMutex);

    captureBufferLocalTimeOffset = useLocalTime ? Time_getLocalTimeOffset() : 0;

    pthread_mutex_unlock(&localTimeMutex);

    /* Capture current parameters */

    pthread_mutex_lock(&audioBufferMutex);

    captureBufferWriteIndex = audioBufferWriteIndex;

    captureBufferSampleCount = audioBufferSampleCount;

    captureBufferStartTime = audioBufferStartTime + captureBufferLocalTimeOffset * MILLISECONDS_IN_SECOND;
    
    pthread_mutex_unlock(&audioBufferMutex);   

    captureBufferSampleRate = currentSampleRate;

    strncpy(captureBufferDeviceCommentName, inputDeviceCommentName, DEVICE_NAME_SIZE);

    /* Calculate the capture duration and the start time */

    int64_t requestedDurationInSamples = duration * captureBufferSampleRate;

    int64_t capturedDurationInSamples = MIN(requestedDurationInSamples, captureBufferSampleCount);

    captureBufferStartTime += ROUNDED_DIV(captureBufferSampleCount * MILLISECONDS_IN_SECOND, (int64_t)captureBufferSampleRate);

    captureBufferStartTime -= ROUNDED_DIV(capturedDurationInSamples * MILLISECONDS_IN_SECOND, (int64_t)captureBufferSampleRate);

    captureBufferLength = (int32_t)capturedDurationInSamples;

    /* Copy the data into the capture buffer */

    int32_t offset = captureBufferLength - captureBufferWriteIndex;

    if (offset < 0) {

        memcpy(captureBuffer, audioBuffer - offset, captureBufferLength * NUMBER_OF_BYTES_IN_SAMPLE);

    } else {

        int32_t remainder = captureBufferLength - offset;

        memcpy(captureBuffer, audioBuffer + AUDIO_BUFFER_SIZE - offset, offset * NUMBER_OF_BYTES_IN_SAMPLE);

        memcpy(captureBuffer + offset, audioBuffer, remainder * NUMBER_OF_BYTES_IN_SAMPLE);

    }

}

static void *captureBufferThreadBody(void *ptr) {

    static WAV_header_t captureHeader;

    static char captureFilename[FILENAME_SIZE];

    static char captureBufferFileDestination[FILEPATH_SIZE];

    int32_t time = captureBufferStartTime / MILLISECONDS_IN_SECOND;

    int32_t milliseconds = captureBufferStartTime % MILLISECONDS_IN_SECOND;

    /* Get the file destination */

    pthread_mutex_lock(&fileDestinationMutex);

    bool destinationSet = fileDestinationSet;

    memcpy(captureBufferFileDestination, fileDestination, FILEPATH_SIZE);

    pthread_mutex_unlock(&fileDestinationMutex);

    /* Write the output WAV file */

    captureBufferSuccess = false;

    if (captureBufferLength > 0 && destinationSet == true) {

        WavFile_initialiseHeader(&captureHeader);

        WavFile_setHeaderDetails(&captureHeader, captureBufferSampleRate, captureBufferLength);

        WavFile_setHeaderComment(&captureHeader, time, milliseconds, captureBufferLocalTimeOffset, captureBufferDeviceCommentName);

        WavFile_setFilename(captureFilename, time, milliseconds, captureBufferFileDestination);

        captureBufferSuccess = WavFile_writeFile(&captureHeader, captureFilename, captureBuffer, captureBufferLength, NULL, 0);

    }

    /* Initialise the callback */

    napi_acquire_threadsafe_function(captureBufferThreadSafeCallback);

    napi_call_threadsafe_function(captureBufferThreadSafeCallback, &captureBufferSuccess, napi_tsfn_nonblocking);

    napi_release_threadsafe_function(captureBufferThreadSafeCallback, napi_tsfn_release);

    return NULL;

}

/* Background and autosave functions */

static void addAutosaveEvent(AS_event_type_t eventType) {

    AS_event_t event;

    event.type = eventType;

    event.sampleRate = currentSampleRate;

    pthread_mutex_lock(&audioBufferMutex);

    event.currentCount = autosaveSampleCount;
    event.currentIndex = audioBufferWriteIndex;
 
    event.startTime = autosaveStartTime;
    event.startCount = autosaveStartSampleCount;

    pthread_mutex_unlock(&audioBufferMutex);

    memcpy(event.inputDeviceCommentName, inputDeviceCommentName, DEVICE_NAME_SIZE);

    Autosave_addEvent(&event);

}

/* Private function */

static void formatFileTime(char *buffer, time_t start, time_t stop, int32_t timeOffset) {

    struct tm time;

    time_t rawTime = start + timeOffset;

    Time_gmTime(&rawTime, &time);

    buffer += sprintf(buffer, "%02d:%02d:%02d to ", time.tm_hour, time.tm_min, time.tm_sec);

    rawTime = stop + timeOffset;

    Time_gmTime(&rawTime, &time);

    buffer += sprintf(buffer, "%02d:%02d:%02d (UTC", time.tm_hour, time.tm_min, time.tm_sec);

    int32_t timeOffsetMinutes = timeOffset / SECONDS_IN_MINUTE;

    int32_t timezoneHours = timeOffsetMinutes / MINUTES_IN_HOUR;

    int32_t timezoneMinutes = timeOffsetMinutes % MINUTES_IN_HOUR;

    if (timezoneHours < 0) {

        buffer += sprintf(buffer, "%d", timezoneHours);

    } else if (timezoneHours > 0) {

        buffer += sprintf(buffer, "+%d", timezoneHours);

    } else {

        if (timezoneMinutes < 0) buffer += sprintf(buffer, "-0");

        if (timezoneMinutes > 0) buffer += sprintf(buffer, "+0");

    }

    if (timezoneMinutes < 0) buffer += sprintf(buffer, ":%02d", -timezoneMinutes);

    if (timezoneMinutes > 0) buffer += sprintf(buffer, ":%02d", timezoneMinutes);

    sprintf(buffer, ")");

}

static bool writeAutosaveFile(int32_t duration) {

    bool success = false;

    static WAV_header_t autosaveHeader;

    static int32_t previousLocalTimeOffset = 0;

    static int32_t autosavePreviousDuration = 0;

    static char autosaveFilename[FILENAME_SIZE];

    static time_t autosaveFilePreviousStopTime = 0;

    static char autosaveFileDestination[FILEPATH_SIZE];
    
    static char autosavePreviousFileDestination[FILEPATH_SIZE];

    if (duration == 0) return true;

    /* Get the file destination */

    pthread_mutex_lock(&fileDestinationMutex);

    bool destinationSet = fileDestinationSet;

    memcpy(autosaveFileDestination, fileDestination, FILEPATH_SIZE);

    pthread_mutex_unlock(&fileDestinationMutex);

    if (destinationSet == false) return false;

    /* Read local time offset */

    pthread_mutex_lock(&localTimeMutex);

    int32_t localTimeOffset = useLocalTime ? Time_getLocalTimeOffset() : 0;

    pthread_mutex_unlock(&localTimeMutex);

    /* Get current autosave duration */

    pthread_mutex_lock(&autosaveMutex);

    if (autosaveDuration > 0) autosavePreviousDuration = autosaveDuration;

    pthread_mutex_unlock(&autosaveMutex);

    /* Determine whether file should be appended */

    struct tm timeStart;

    time_t rawTimeStart = autosaveFileStartTime;

    Time_gmTime(&rawTimeStart, &timeStart);
    
    bool append = localTimeOffset == previousLocalTimeOffset;

    append &= strcmp(autosaveFileDestination, autosavePreviousFileDestination) == 0;
    
    append &= autosaveFileStartTime == autosaveFilePreviousStopTime;

    append &= timeStart.tm_sec == 0 && timeStart.tm_min % autosavePreviousDuration > 0;

    memcpy(autosavePreviousFileDestination, autosaveFileDestination, FILEPATH_SIZE);

    autosaveFilePreviousStopTime = autosaveFileStartTime + duration;

    previousLocalTimeOffset = localTimeOffset;

    /* Write the output WAV file */

    int32_t numberOfSamples = duration * autosaveFileSampleRate;

    int32_t overlap = autosaveFileStartIndex + numberOfSamples - AUDIO_BUFFER_SIZE;

    if (append == true) {

        if (overlap < 0) {

            success = WavFile_appendFile(autosaveFilename, audioBuffer + autosaveFileStartIndex, numberOfSamples, NULL, 0);

        } else {

            success = WavFile_appendFile(autosaveFilename, audioBuffer + autosaveFileStartIndex, numberOfSamples - overlap, audioBuffer, overlap);

        }

    }

    if (append == false || success == false) {

        WavFile_initialiseHeader(&autosaveHeader);

        WavFile_setHeaderDetails(&autosaveHeader, autosaveFileSampleRate, numberOfSamples);

        WavFile_setHeaderComment(&autosaveHeader, (int32_t)autosaveFileStartTime + localTimeOffset, -1, localTimeOffset, autosaveInputDeviceCommentName);

        WavFile_setFilename(autosaveFilename, (int32_t)autosaveFileStartTime + localTimeOffset, -1, autosaveFileDestination);

        if (overlap < 0) {

            success = WavFile_writeFile(&autosaveHeader, autosaveFilename, audioBuffer + autosaveFileStartIndex, numberOfSamples, NULL, 0);

        } else {

            success = WavFile_writeFile(&autosaveHeader, autosaveFilename, audioBuffer + autosaveFileStartIndex, numberOfSamples - overlap, audioBuffer, overlap);

        }

    }

    /* Log output file */

    static char buffer[FILE_TIME_BUFFER];

    formatFileTime(buffer, autosaveFileStartTime, autosaveFilePreviousStopTime, localTimeOffset);

    printf("[AUTOSAVE] %s\n", buffer);

    /* Return status */

    return success;

}

static bool makeMinuteTransitionRecording() {

    /* Generate partial recording */

    int64_t sampleCountDifference = autosaveTargetCount - autosaveFileStartCount;

    int32_t duration = (int32_t)(sampleCountDifference / autosaveFileSampleRate);

    bool success = writeAutosaveFile(duration);

    /* Update for next minute transition */

    autosaveFileStartTime += duration;

    autosaveFileStartIndex = (autosaveFileStartIndex + sampleCountDifference) % AUDIO_BUFFER_SIZE;

    autosaveFileStartCount = autosaveTargetCount;

    autosaveTargetCount = autosaveFileStartCount + SECONDS_IN_MINUTE * autosaveFileSampleRate;

    return success;

}

static void updateForMillisecondOffset(int32_t milliseconds) {

    /* Update count, index and time for millisecond offset */

    if (milliseconds > 0) {
        
        int32_t millisecondOffset = MILLISECONDS_IN_SECOND - milliseconds;

        int32_t sampleOffset = ROUNDED_DIV(autosaveFileSampleRate * millisecondOffset, MILLISECONDS_IN_SECOND);

        autosaveFileStartCount += sampleOffset;

        autosaveFileStartIndex = (autosaveFileStartIndex + sampleOffset) % AUDIO_BUFFER_SIZE;

        autosaveFileStartTime += 1;

    }

    /* Calculate target sample count for the next minute transition */

    struct tm time;

    time_t rawTime = autosaveFileStartTime;

    Time_gmTime(&rawTime, &time);

    autosaveTargetCount = autosaveFileStartCount + (SECONDS_IN_MINUTE - time.tm_sec) * autosaveFileSampleRate;

}

static void *backgroundThreadBody(void *ptr) {

    static AS_event_t event;

    puts("[BACKGROUND] Started");
    
    while (true) {

        /* Check for AudioMoth */

        pthread_mutex_lock(&backgroundDeviceCheckMutex);

        device_check_t device_check = checkForAudioMoth(&deviceCheckContext, false);

        bool audioMothFound = device_check.audioMothFound;

        bool oldAudioMothFound = device_check.oldAudioMothFound;

        pthread_mutex_unlock(&backgroundDeviceCheckMutex);

        pthread_mutex_lock(&backgroundMutex);

        if (backgroundDeviceCheckFoundAudioMoth != audioMothFound) puts(audioMothFound ? "[BACKGROUND] AudioMoth connected" : "[BACKGROUND] AudioMoth disconnected");

        backgroundDeviceCheckTime = ma_timer_get_time_in_seconds(&timer);

        backgroundDeviceCheckFoundAudioMoth = audioMothFound;

        backgroundDeviceCheckFoundOldAudioMoth = oldAudioMothFound;

        pthread_mutex_unlock(&backgroundMutex);

        /* Get current sample count and autosave duration */

        pthread_mutex_lock(&audioBufferMutex);

        int64_t currentSampleCount = autosaveSampleCount;

        pthread_mutex_unlock(&audioBufferMutex);

        /* Process autosave events */

        bool success = true;

        while (Autosave_hasEvents()) {

            /* Copy and remove first event */

            Autosave_getFirstEvent(&event);

            /* Process event */

            if (autosaveWaitingForStartEvent && event.type == AS_START) {

                puts("[AUTOSAVE] Start");

                /* Set sample rate and device */

                autosaveFileSampleRate = event.sampleRate;

                memcpy(autosaveInputDeviceCommentName, event.inputDeviceCommentName, DEVICE_NAME_SIZE);

                /* Adjust start time to match current count and index */

                int64_t countDifference = event.currentCount - event.startCount;

                int64_t updatedStartTime = event.startTime + ROUNDED_DIV(countDifference * MILLISECONDS_IN_SECOND, autosaveFileSampleRate);

                int32_t milliseconds = updatedStartTime % MILLISECONDS_IN_SECOND;

                autosaveFileStartTime = updatedStartTime / MILLISECONDS_IN_SECOND;

                autosaveFileStartCount = event.currentCount;

                autosaveFileStartIndex = event.currentIndex;

                /* Update start time, count and index for millisecond offset */

                updateForMillisecondOffset(milliseconds); 

                /* Reset flag */
                
                autosaveWaitingForStartEvent = false;

            }

            if (currentSampleCount >= autosaveTargetCount && autosaveTargetCount < event.currentCount) {

                success &= makeMinuteTransitionRecording();

            }

            if (event.type == AS_RESTART) {

                /* Write samples since last start to file */

                int32_t duration = (int32_t)(event.startCount - autosaveFileStartCount) / autosaveFileSampleRate;

                success &= writeAutosaveFile(duration);

                /* Set sample rate and device */

                autosaveFileSampleRate = event.sampleRate;

                memcpy(autosaveInputDeviceCommentName, event.inputDeviceCommentName, DEVICE_NAME_SIZE);

                /* Adjust current index to match start time and count */

                int32_t milliseconds = event.startTime % MILLISECONDS_IN_SECOND;

                autosaveFileStartTime = event.startTime / MILLISECONDS_IN_SECOND;

                autosaveFileStartCount = event.startCount;

                int64_t countDifference = (event.currentCount - event.startCount);

                autosaveFileStartIndex = (AUDIO_BUFFER_SIZE + event.currentIndex - countDifference) % AUDIO_BUFFER_SIZE;

                /* Update start time, count and index for millisecond offset */

                updateForMillisecondOffset(milliseconds);

            }

            if (event.type == AS_STOP) {

                puts("[AUTOSAVE] Stop");

                /* Write samples since last start to file */

                int32_t duration = (int32_t)(event.currentCount - autosaveFileStartCount) / autosaveFileSampleRate;

                success &= writeAutosaveFile(duration);

                /* Reset flags */

                autosaveWaitingForStartEvent = true;

                autosaveTargetCount = INT64_MAX;

            }

            if (event.type == AS_SHUTDOWN) {

                puts("[AUTOSAVE] Shutdown starting");

                if (autosaveWaitingForStartEvent == false) {

                    /* Write samples since last start to file */

                    int32_t duration = (int32_t)(event.currentCount - autosaveFileStartCount) / autosaveFileSampleRate;

                    writeAutosaveFile(duration);

                }

                pthread_mutex_lock(&autosaveMutex);

                autosaveShutdownCompleted = true;

                pthread_mutex_unlock(&autosaveMutex);

                /* Reset flags */

                autosaveWaitingForStartEvent = true;

                autosaveTargetCount = INT64_MAX;

            }

        }

        if (currentSampleCount >= autosaveTargetCount) {

            success &= makeMinuteTransitionRecording();

        }

        /* Thread safe callback */

        if (success == false) {

            puts("[AUTOSAVE] Could not write WAV file");

            napi_acquire_threadsafe_function(autosaveThreadSafeCallback);

            napi_call_threadsafe_function(autosaveThreadSafeCallback, NULL, napi_tsfn_nonblocking);

            napi_release_threadsafe_function(autosaveThreadSafeCallback, napi_tsfn_release);

        }

        /* Calculate delay period to wait for next update */

        uint32_t microseconds = Time_getMicroseconds();

        uint32_t delay = DEVICE_CHECK_INTERVAL - microseconds % DEVICE_CHECK_INTERVAL;

        usleep(delay);

    }

    return NULL;

}

/* Exported functions */

napi_value initialise(napi_env env, napi_callback_info info) {

    bool success = true;

    puts("[BACKSTAGE] initialise");

    /* Initialise timers */

    ma_timer_init(&timer);

    /* Initialise the contexts */

    ma_result result = ma_context_init(NULL, 0, NULL, &deviceCheckContext);

    if (result != MA_SUCCESS) {
        
        puts("[BACKSTAGE] Could not initialise device check context");

        success = false;

    }

    result = ma_context_init(NULL, 0, NULL, &playbackContext);

    if (result != MA_SUCCESS) {
        
        puts("[BACKSTAGE] Could not initialise playback context");

        success = false;

    }

    /* Initialise autosave queue */

    bool initialised = Autosave_initialise(AUTOSAVE_EVENT_QUEUE_SIZE);

    if (initialised == false) {
        
        puts("[BACKSTAGE] Could not initialise autosave queue");

        success = false;

    }

    /* Initialise STFT */

    STFT_initialise();

    /* Initialise the heterodyne mixer */

    Heterodyne_initialise(MAXIMUM_SAMPLE_RATE, 45000); 

    /* Initialise mutexes */

    pthread_mutex_init(&playbackMutex, NULL);

    pthread_mutex_init(&autosaveMutex, NULL);

    pthread_mutex_init(&localTimeMutex, NULL);

    pthread_mutex_init(&stopStartMutex, NULL);

    pthread_mutex_init(&backgroundMutex, NULL);

    pthread_mutex_init(&audioBufferMutex, NULL);

    pthread_mutex_init(&fileDestinationMutex, NULL);

    pthread_mutex_init(&simulationRunningMutex, NULL);

    pthread_mutex_init(&backgroundDeviceCheckMutex, NULL);

    /* Generate the NAPI components */

    NAPI_CALL(env, "Failed to create true value", napi_get_null(env, &napi_value_null))

    NAPI_CALL(env, "Failed to create true value", napi_get_boolean(env, true, &napi_value_true))

    NAPI_CALL(env, "Failed to create false value", napi_get_boolean(env, false, &napi_value_false))

    NAPI_CALL(env, "Failed to create undefined value", napi_get_undefined(env, &napi_value_undefined))

    NAPI_CALL(env, "Failed to array buffer value", napi_create_arraybuffer(env, NUMBER_OF_BYTES_IN_SAMPLE * AUDIO_BUFFER_SIZE, (void**)&audioBuffer, &napi_audioArrayBuffer))

    NAPI_CALL(env, "Failed to typed array value", napi_create_typedarray(env, napi_int16_array, AUDIO_BUFFER_SIZE, napi_audioArrayBuffer, 0, &napi_audioTypedArray))

    NAPI_CALL(env, "Failed to array buffer value", napi_create_arraybuffer(env, NUMBER_OF_BYTES_IN_FLOAT32 * AUDIO_BUFFER_SIZE / STFT_INPUT_OUTPUT_RATIO, (void**)&stftBuffer, &napi_stftArrayBuffer))

    NAPI_CALL(env, "Failed to typed array value", napi_create_typedarray(env, napi_float32_array, AUDIO_BUFFER_SIZE / STFT_INPUT_OUTPUT_RATIO, napi_stftArrayBuffer, 0, &napi_stftTypedArray))

    /* Start the background thread */

    pthread_create(&backgroundThread, NULL, backgroundThreadBody, NULL);

    /* Reset the start flag */

    pthread_mutex_lock(&stopStartMutex);

    started = false;

    pthread_mutex_unlock(&stopStartMutex);
        
    /* Start device */

    pthread_mutex_lock(&backgroundDeviceCheckMutex);

    device_check_t device_check = checkForAudioMoth(&deviceCheckContext, true);

    usingAudioMoth = device_check.audioMothFound;

    bool startedMicrophone = startMicrophone(&deviceCheckContext, usingAudioMoth);

    pthread_mutex_unlock(&backgroundDeviceCheckMutex);

    puts(usingAudioMoth ? "[BACKSTAGE] Started AudioMoth" : "[BACKSTAGE] Started default device");

    if (startedMicrophone == false) {
        
        puts("[BACKSTAGE] Failed to start capture");

        success = false;

    }

    /* Wait for device to start */

    bool threadStarted = false;

    double startTime = ma_timer_get_time_in_seconds(&timer);

    while (threadStarted == false) {

        double currentTime = ma_timer_get_time_in_seconds(&timer);

        if (currentTime - startTime > DEVICE_STOP_START_TIMEOUT) {

            puts("[BACKSTAGE] Timed out waiting for device to start");

            break;

        }

        pthread_mutex_lock(&stopStartMutex);

        threadStarted = started;

        pthread_mutex_unlock(&stopStartMutex);

    }

    success &= threadStarted;

    /* Return typed array */

    napi_value jsObj;

    NAPI_CALL(env, "Failed to create object", napi_create_object(env, &jsObj));

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "success", success ? napi_value_true : napi_value_false));

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "audioBuffer", napi_audioTypedArray));

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "stftBuffer", napi_stftTypedArray));

    return jsObj;

}

napi_value changeSampleRate(napi_env env, napi_callback_info info) {

    size_t argc = 1;
    napi_value argv[1];

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    int32_t number;

    NAPI_CALL(env, "Failed to parse number as an argument", napi_get_value_int32(env, argv[0], &number))

    printf("[BACKSTAGE] changeSampleRate - %d\n", number);

    for (uint32_t i = 0; i < NUMBER_OF_VALID_SAMPLE_RATES; i += 1) {

        if (number == validSampleRates[i] && number != requestedSampleRate) {
            
            requestedSampleRate = number;

            requestedSampleRateChanged = true;

            break;

        }

    }

    /* Return null value */

    return napi_value_null;

}

napi_value getFrame(napi_env env, napi_callback_info info) {

    /* Determine the offset and length for update and all data */

    pthread_mutex_lock(&audioBufferMutex);

    int32_t audioIndex = frontEndPaused ? captureBufferWriteIndex : audioBufferWriteIndex;

    int64_t audioCount = frontEndPaused ? captureBufferSampleCount : audioBufferSampleCount;

    int64_t unpausedAudioCount = audioBufferSampleCount;

    int64_t audioTime = audioBufferStartTime;

    pthread_mutex_unlock(&audioBufferMutex);

    /* Calculate unpaused audio time */

    int64_t unpausedAudioTime = audioTime + ROUNDED_DIV(unpausedAudioCount * MILLISECONDS_IN_SECOND, currentSampleRate);

    /* Apply time corrections */

    pthread_mutex_lock(&localTimeMutex);

    int64_t localTimeOffset = useLocalTime ? Time_getLocalTimeOffset() : 0;

    pthread_mutex_unlock(&localTimeMutex);

    audioTime += ROUNDED_DIV(audioCount * MILLISECONDS_IN_SECOND, currentSampleRate);

    audioTime += localTimeOffset * MILLISECONDS_IN_SECOND;

    /* Read the simulation state */

    pthread_mutex_lock(&simulationRunningMutex);

    bool simulationFlag = simulationRunning;

    pthread_mutex_unlock(&simulationRunningMutex);

    /* Check the audio time against the current time */

    int64_t currentTime = Time_getMillisecondUTC();

    bool timeMismatch = simulationFlag == false && ABS(currentTime - unpausedAudioTime) > TIME_MISMATCH_LIMIT;

    /* Check if the device has changed */

    bool deviceChanged = false;

    bool setOldAudioMothFoundFlag = false;

    static bool oldAudioMothFound = false;

    pthread_mutex_lock(&backgroundMutex);

    if (backgroundDeviceCheckTime - timeDeviceStarted > DEVICE_CHANGE_INTERVAL) {

        if (backgroundDeviceCheckFoundAudioMoth == true && usingAudioMoth == false) deviceChanged = true;
    
        if (backgroundDeviceCheckFoundAudioMoth == false && usingAudioMoth == true) deviceChanged = true;

        if (backgroundDeviceCheckFoundOldAudioMoth && oldAudioMothFound == false) setOldAudioMothFoundFlag = true;

        oldAudioMothFound = backgroundDeviceCheckFoundOldAudioMoth;

    }

    pthread_mutex_unlock(&backgroundMutex);

    /* Check if sample rate has changed */

    bool sampleRateChanged = false;

    if (requestedSampleRateChanged) {

        sampleRateChanged = currentSampleRate != MIN(requestedSampleRate, inputDeviceSampleRate);

        requestedSampleRateChanged = false;

    }

    /* Generate return object */

    napi_value jsObj;

    NAPI_CALL(env, "Failed to create object", napi_create_object(env, &jsObj));

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "redrawRequired", !frontEndPaused && shouldSetRedrawFlag ? napi_value_true : napi_value_false));

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "simulationRunning", simulationFlag ? napi_value_true : napi_value_false));

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "oldAudioMothFound", setOldAudioMothFoundFlag ? napi_value_true : napi_value_false));

    napi_value napi_deviceName;

    NAPI_CALL(env, "Failed to create string", napi_create_string_utf8(env, inputDeviceName, NAPI_AUTO_LENGTH, &napi_deviceName))

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "deviceName",napi_deviceName))

    napi_value napi_maximumSampleRate;

    NAPI_CALL(env, "Failed to create value", napi_create_int32(env, usingAudioMoth ? audioMothSampleRate : maximumDefaultSampleRate, &napi_maximumSampleRate))

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "maximumSampleRate", napi_maximumSampleRate))

    napi_value napi_currentSampleRate;

    NAPI_CALL(env, "Failed to create value", napi_create_int32(env, currentSampleRate, &napi_currentSampleRate))

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "currentSampleRate", napi_currentSampleRate))

    napi_value napi_audioTime;

    NAPI_CALL(env, "Failed to create value", napi_create_double(env, (double)audioTime, &napi_audioTime))

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "audioTime", napi_audioTime))

    napi_value napi_audioIndex;

    NAPI_CALL(env, "Failed to create value", napi_create_double(env, (double)audioIndex, &napi_audioIndex))

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "audioIndex", napi_audioIndex))

    napi_value napi_audioCount;

    NAPI_CALL(env, "Failed to create value", napi_create_double(env, (double)audioCount, &napi_audioCount))

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "audioCount", napi_audioCount))

    /* Actions to take this frame */

    bool shouldRestart = false;

    bool shouldStopDevice = false;

    bool shouldStartDevice = false;

    bool shouldStopSimulationThread = false;

    bool shouldStartSimulationThread = false;

    if (!frontEndPaused) shouldSetRedrawFlag = false;

    /* Determine actions to take */

    if (deviceChanged && simulationFlag == false) {

        shouldStopDevice = true;

        shouldRestart = true;

        shouldStartDevice = true;

        deviceChanged = false;

    } else if (timeMismatch || sampleRateChanged) {

        if (timeMismatch) puts("[BACKSTAGE] Restarting due to time mismatch");
        
        if (simulationFlag == false) {

            shouldStopDevice = true;

        } else {

            shouldStopSimulationThread = true;

        }
        
        shouldRestart = true;

        if (simulationFlag == false) {

            shouldStartDevice = true;

        } else {

            shouldStartSimulationThread = true;

        }
        
    } else if (maximumDefaultSampleRateChanged) {

        bool sampleRateChanged = requestedMaximumDefaultSampleRate != maximumDefaultSampleRate;

        maximumDefaultSampleRate = requestedMaximumDefaultSampleRate;

        if (usingAudioMoth == false && simulationFlag == false && sampleRateChanged) {

            shouldStopDevice = true;

            shouldRestart = true;

            shouldStartDevice = true;

        }

        maximumDefaultSampleRateChanged = false;

    } else if (shouldStartSimulation) {

        if (simulationFlag == false) {

            shouldStopDevice = true;

        } else {

            shouldStopSimulationThread = true;

        }

        shouldRestart = true;

        shouldStartSimulationThread = true;

        shouldStartSimulation = false;

    } else if (shouldStopSimulation) {

        if (simulationFlag) {

            shouldStopSimulationThread = true;

            shouldRestart = true;

            shouldStartDevice = true;

        }

        shouldStopSimulation = false;

    }

    /* Implement the actions determined above */

    if (shouldStopDevice || shouldStopSimulationThread) {

        /* Reset the stopped flag */

        pthread_mutex_lock(&stopStartMutex);

        stopped = false;

        pthread_mutex_unlock(&stopStartMutex);

        /* Stop the device or simulation */

        if (shouldStopDevice) {
            
            puts(usingAudioMoth ? "[BACKSTAGE] Stop AudioMoth" : "[BACKSTAGE] Stop default device");

            pthread_mutex_lock(&backgroundDeviceCheckMutex);

            stopMicrophone();

            pthread_mutex_unlock(&backgroundDeviceCheckMutex);

        }

        if (shouldStopSimulationThread) {

            puts("[BACKSTAGE] Stop simulation thread");

            pthread_mutex_lock(&simulationRunningMutex);

            simulationRunning = false;

            pthread_mutex_unlock(&simulationRunningMutex);

        }

        /* Wait for device to stop */

        bool threadStopped = false;

        double startTime = ma_timer_get_time_in_seconds(&timer);

        while (threadStopped == false) {

            double currentTime = ma_timer_get_time_in_seconds(&timer);

            if (currentTime - startTime > DEVICE_STOP_START_TIMEOUT) {

                if (IS_WINDOWS == false && shouldStopDevice) puts("[BACKSTAGE] Timed out waiting for device to stop");

                if (shouldStopSimulationThread) puts("[BACKSTAGE] Timed out waiting for simulation thread to stop");

                break;

            }

            pthread_mutex_lock(&stopStartMutex);

            threadStopped = stopped;

            pthread_mutex_unlock(&stopStartMutex);

        }

    }

    if (shouldRestart) {

        /* Reset buffer indices */

        pthread_mutex_lock(&audioBufferMutex);

        audioBufferSampleCount = 0;

        audioBufferIndex -= audioBufferIndex % STFT_INPUT_SAMPLES;

        pthread_mutex_unlock(&audioBufferMutex);

        /* Reset playback indices */

        pthread_mutex_lock(&playbackMutex);

        playbackBufferCount = 0;

        playbackReadIndex = audioBufferWriteIndex;

        pthread_mutex_unlock(&playbackMutex);

        /* Set redraw flags */
    
        shouldSetRedrawFlag = true;

    }

    if (shouldStartDevice || shouldStartSimulationThread) {

        /* Reset the start flag */

        pthread_mutex_lock(&stopStartMutex);

        started = false;

        pthread_mutex_unlock(&stopStartMutex);

        /* Start the device or simulation */

        if (shouldStartDevice) {

            pthread_mutex_lock(&backgroundDeviceCheckMutex);

            device_check_t device_check = checkForAudioMoth(&deviceCheckContext, true);

            usingAudioMoth = device_check.audioMothFound;
            
            startMicrophone(&deviceCheckContext, usingAudioMoth);

            pthread_mutex_unlock(&backgroundDeviceCheckMutex);

            puts(usingAudioMoth ? "[BACKSTAGE] Start AudioMoth" : "[BACKSTAGE] Start default device");

            timeDeviceStarted = ma_timer_get_time_in_seconds(&timer);

        }

        if (shouldStartSimulationThread) {

            Simulator_initialiseExample();

            inputDeviceSampleRate = Simulator_getSampleRate(simulationIndex);

            strncpy(inputDeviceName, "Simulated 384kHz AudioMoth USB Microphone", DEVICE_NAME_SIZE);

            strncpy(inputDeviceCommentName, "a simulated 384kHz AudioMoth USB Microphone", DEVICE_NAME_SIZE);

            currentSampleRate = inputDeviceSampleRate;

            puts("[BACKSTAGE] Start simulation thread");

            pthread_mutex_lock(&simulationRunningMutex);

            simulationRunning = true;

            pthread_mutex_unlock(&simulationRunningMutex);
                
            pthread_create(&simulationThread, NULL, simulationThreadBody, NULL);

        }

        /* Wait for device to start */

        bool threadStarted = false;

        double startTime = ma_timer_get_time_in_seconds(&timer);

        while (threadStarted == false) {

            double currentTime = ma_timer_get_time_in_seconds(&timer);

            if (currentTime - startTime > DEVICE_STOP_START_TIMEOUT) {

                if (shouldStartDevice) puts("[BACKSTAGE] Timed out waiting for device to start");

                if (shouldStartSimulationThread) puts("[BACKSTAGE] Timed out waiting for simulation thread to start");

                break;

            }

            pthread_mutex_lock(&stopStartMutex);

            threadStarted = started;

            pthread_mutex_unlock(&stopStartMutex);

        }

        /* Add autosave event */

        pthread_mutex_lock(&autosaveMutex);

        int32_t currentDuration = autosaveDuration;

        pthread_mutex_unlock(&autosaveMutex);

        if (threadStarted && currentDuration > 0) addAutosaveEvent(AS_RESTART);

    }

    /* Return object */

    return jsObj;

}

napi_value clear(napi_env env, napi_callback_info info) {

    puts("[BACKSTAGE] clear");

    /* Reset buffer indices */

    pthread_mutex_lock(&audioBufferMutex);

    int64_t milliseconds = ROUNDED_DIV(audioBufferSampleCount * MILLISECONDS_IN_SECOND, (int64_t)currentSampleRate);

    audioBufferStartTime += milliseconds;

    audioBufferSampleCount = 0;
   
    pthread_mutex_unlock(&audioBufferMutex);

    /* Set the reset flag */

    shouldSetRedrawFlag = true;
 
    /* Return null value */

    return napi_value_null;
    
}

napi_value capture(napi_env env, napi_callback_info info) {

    size_t argc = 2;
    napi_value argv[2];

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    int32_t duration;

    NAPI_CALL(env, "Failed to parse number as an argument", napi_get_value_int32(env, argv[0], &duration))

    printf("[BACKSTAGE] capture - %d\n", duration);

    /* Generate callback function */

    napi_value callback = argv[1];

    napi_value work_name;

    NAPI_CALL(env, "Failed to create string", napi_create_string_utf8(env, "Capture Callback", NAPI_AUTO_LENGTH, &work_name))

    NAPI_CALL(env, "Failed to create threadsafe function", napi_create_threadsafe_function(env, callback, NULL, work_name, 0, 1, NULL, NULL, NULL, threadSafeBooleanCallback, &captureBufferThreadSafeCallback))

    /* Start thread */

    if (!frontEndPaused) {

        duration = MAX(0, MIN(MAXIMUM_RECORD_DURATION, duration));
        
        captureAudioBuffer(duration);

    }

    pthread_create(&captureBufferThread, NULL, captureBufferThreadBody, NULL);
   
    /* Return null value */

    return napi_value_null;
    
}

napi_value setPause(napi_env env, napi_callback_info info) {

    size_t argc = 2;
    napi_value argv[2];

    bool enable;

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    NAPI_CALL(env, "Failed to parse boolean as an argument", napi_get_value_bool(env, argv[0], &enable))

    int32_t duration;

    NAPI_CALL(env, "Failed to parse number as an argument", napi_get_value_int32(env, argv[1], &duration))

    printf("[BACKSTAGE] setPause - %s, %d\n", enable ? "true" : "false", duration);

    if (enable && !frontEndPaused) {

        duration = MAX(0, MIN(MAXIMUM_RECORD_DURATION, duration));

        captureAudioBuffer(duration);

        frontEndPaused = true;

    }

    if (!enable && frontEndPaused) {

        frontEndPaused = false;

        shouldSetRedrawFlag = true;

    }

    /* Generate return object */

    napi_value jsObj;

    NAPI_CALL(env, "Failed to create object", napi_create_object(env, &jsObj));

    if (frontEndPaused) {

        napi_value napi_audioStartTime;

        NAPI_CALL(env, "Failed to create value", napi_create_double(env, (double)captureBufferStartTime, &napi_audioStartTime))

        NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "audioStartTime", napi_audioStartTime))

        napi_value napi_audioIndex;

        double audioIndex = captureBufferWriteIndex;
    
        NAPI_CALL(env, "Failed to create value", napi_create_double(env, audioIndex, &napi_audioIndex))

        NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "audioIndex", napi_audioIndex))

        napi_value napi_audioCount;

        double audioCount = captureBufferSampleCount;

        NAPI_CALL(env, "Failed to create value", napi_create_double(env, audioCount, &napi_audioCount))

        NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "audioCount", napi_audioCount))

    }

    /* Return object */

    return jsObj;
    
}

napi_value setFileDestination(napi_env env, napi_callback_info info) {

    size_t argc = 1;
    napi_value argv[1];

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    size_t length;

    static char buffer[FILEPATH_SIZE];

    NAPI_CALL(env, "Failed to parse string as an argument", napi_get_value_string_utf8(env, argv[0], buffer, FILEPATH_SIZE, &length))

    printf("[BACKSTAGE] setFileDestination - %s\n", buffer);

    pthread_mutex_lock(&fileDestinationMutex);

    memcpy(fileDestination, buffer, FILEPATH_SIZE);

    fileDestinationSet = true;

    pthread_mutex_unlock(&fileDestinationMutex);

    /* Return null value */

    return napi_value_null;
    
}

napi_value setAutoSaveCallback(napi_env env, napi_callback_info info) {

    size_t argc = 1;
    napi_value argv[1];

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    puts("[BACKSTAGE] setAutoSaveCallback");

    /* Generate callback function */

    napi_value callback = argv[0];

    napi_value work_name;

    NAPI_CALL(env, "Failed to create string", napi_create_string_utf8(env, "Autosave Callback", NAPI_AUTO_LENGTH, &work_name))

    NAPI_CALL(env, "Failed to create threadsafe function", napi_create_threadsafe_function(env, callback, NULL, work_name, 0, 1, NULL, NULL, NULL, threadSafeNullCallback, &autosaveThreadSafeCallback))

    /* Return null value */

    return napi_value_null;

}

napi_value setAutoSave(napi_env env, napi_callback_info info) {

    size_t argc = 1;
    napi_value argv[1];

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    int32_t duration;

    NAPI_CALL(env, "Failed to parse number as an argument", napi_get_value_int32(env, argv[0], &duration))

    printf("[BACKSTAGE] setAutoSave - %d\n", duration);

    pthread_mutex_lock(&autosaveMutex);

    int32_t currentDuration = autosaveDuration;

    pthread_mutex_unlock(&autosaveMutex);

    if (currentDuration == 0 && duration > 0) addAutosaveEvent(AS_START);

    if (currentDuration > 0 && duration == 0) addAutosaveEvent(AS_STOP);

    if (currentDuration != duration) {

        pthread_mutex_lock(&autosaveMutex);

        autosaveDuration = duration;

        pthread_mutex_unlock(&autosaveMutex);

    }

    /* Return null value */

    return napi_value_null;
    
}

napi_value getSimulationInfo(napi_env env, napi_callback_info info) {

    size_t argc = 1;
    napi_value argv[1];

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    size_t length;

    static char buffer[FILEPATH_SIZE];

    NAPI_CALL(env, "Failed to parse string as an argument", napi_get_value_string_utf8(env, argv[0], buffer, FILEPATH_SIZE, &length))

    printf("[BACKSTAGE] getSimulationInfo - %s\n", buffer);

    napi_value jsObj;

    napi_value napi_description;

    napi_value napi_description_array;

    NAPI_CALL(env, "Failed to create object", napi_create_object(env, &jsObj))

    NAPI_CALL(env, "Failed to parse arguments", napi_create_array_with_length(env, NUMBER_OF_SIMULATION_EXAMPLES, &napi_description_array))

    NAPI_CALL(env, "Failed to set named property", napi_set_named_property(env, jsObj, "descriptions", napi_description_array))

    Simulator_setPath(buffer);

    for (int32_t i = 0; i < NUMBER_OF_SIMULATION_EXAMPLES; i += 1) {

        char *description = Simulator_getDescription(i);

        NAPI_CALL(env, "Failed to create string", napi_create_string_utf8(env, description, NAPI_AUTO_LENGTH, &napi_description))

        NAPI_CALL(env, "Failed to set array element", napi_set_element(env, napi_description_array, i, napi_description))

    }

    /* Return object */

    return jsObj;

}

napi_value setSimulation(napi_env env, napi_callback_info info) {

    size_t argc = 2;
    napi_value argv[2];

    bool enable;

    int32_t index;

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    NAPI_CALL(env, "Failed to parse boolean as an argument", napi_get_value_bool(env, argv[0], &enable))

    if (enable) NAPI_CALL(env, "Failed to parse number as an argument", napi_get_value_int32(env, argv[1], &index))

    /* Set flags */

    bool success = true;

    if (enable) {

        printf("[BACKSTAGE] setSimulation - true, %d\n", index);

        success = Simulator_loadExample(index);

        if (success) {

            shouldStartSimulation = true;

            simulationIndex = index;

        }

    } else {

        puts("[BACKSTAGE] setSimulation - false");

        shouldStopSimulation = true;

    }

    /* Return boolean value */

    return success ? napi_value_true : napi_value_false;

}

napi_value setMonitor(napi_env env, napi_callback_info info) {

    size_t argc = 2;
    napi_value argv[2];

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    int32_t mode;

    int32_t frequency;

    NAPI_CALL(env, "Failed to parse number as an argument", napi_get_value_int32(env, argv[0], &mode))

    if (mode == MONITOR_HETERODYNE) {

        NAPI_CALL(env, "Failed to parse number as an argument", napi_get_value_int32(env, argv[1], &frequency))

        printf("[BACKSTAGE] setMonitor - 2, %d\n", frequency);

    } else {

        printf("[BACKSTAGE] setMonitor - %d\n", mode);

    }

    /* Update heterodyne */

    if (mode == MONITOR_HETERODYNE) Heterodyne_updateFrequencies(MAXIMUM_SAMPLE_RATE, frequency);

    heterodyneEnabled = mode == MONITOR_HETERODYNE;

    /* Stop and start monitor */

    if (!monitorEnabled && (mode == MONITOR_PLAYTHROUGH || mode == MONITOR_HETERODYNE)) {

        playbackBufferCount = 0;

        playbackReadIndex = audioBufferWriteIndex;

        pthread_create(&startPlaybackThread, NULL, startPlaybackThreadBody, NULL);

        monitorEnabled = true;

    } else if (monitorEnabled && mode == MONITOR_OFF && monitorEnabled) {

        pthread_create(&stopPlaybackThread, NULL, stopPlaybackThreadBody, NULL);

        monitorEnabled = false;

    }

    /* Return null value */

    return napi_value_null;
    
}

napi_value setHighDefaultSampleRate(napi_env env, napi_callback_info info) {

    size_t argc = 1;
    napi_value argv[1];

    bool enable;

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    NAPI_CALL(env, "Failed to parse boolean as an argument", napi_get_value_bool(env, argv[0], &enable))

    printf("[BACKSTAGE] setHighDefaultSampleRate - %s\n", enable ? "true" : "false");

    requestedMaximumDefaultSampleRate = enable ? MAXIMUM_SAMPLE_RATE : DEFAULT_SAMPLE_RATE;

    maximumDefaultSampleRateChanged = true;

    /* Return null value */

    return napi_value_null;
    
}

napi_value setLocalTime(napi_env env, napi_callback_info info) {

    size_t argc = 1;
    napi_value argv[1];

    bool enable;

    NAPI_CALL(env, "Failed to parse arguments", napi_get_cb_info(env, info, &argc, argv, NULL, NULL))

    NAPI_CALL(env, "Failed to parse boolean as an argument", napi_get_value_bool(env, argv[0], &enable))

    printf("[BACKSTAGE] setLocalTime - %s\n", enable ? "true" : "false");

    pthread_mutex_lock(&localTimeMutex);

    useLocalTime = enable;

    pthread_mutex_unlock(&localTimeMutex);

    /* Return null value */

    return napi_value_null;
    
}

napi_value forceAutoSaveToStop(napi_env env, napi_callback_info info) {

    puts("[BACKSTAGE] forceAutoSaveToStop");

    /* Set shutdown flag */

    pthread_mutex_lock(&autosaveMutex);

    autosaveShutdownCompleted = false;

    pthread_mutex_unlock(&autosaveMutex);

    /* Send shutdown message */

    addAutosaveEvent(AS_SHUTDOWN);

    /* Wait for shutdown to complete */

    bool shutdownCompleted = false;

    double startTime = ma_timer_get_time_in_seconds(&timer);

    while (shutdownCompleted == false) {

        double currentTime = ma_timer_get_time_in_seconds(&timer);

        if (currentTime - startTime > DEVICE_SHUTDOWN_TIMEOUT) {

            puts("[BACKSTAGE] Timed out waiting for shutdown to complete");

            break;

        }

        pthread_mutex_lock(&autosaveMutex);

        shutdownCompleted = autosaveShutdownCompleted;

        pthread_mutex_unlock(&autosaveMutex);

    }

    puts("[BACKSTAGE] Autosave shutdown complete");

    /* Return null value */

    return napi_value_null;
    
}

/* Initialise exported functions */

napi_value Init(napi_env env, napi_value exports) {

    NAPI_EXPORT_FUNCTION(initialise)

    NAPI_EXPORT_FUNCTION(changeSampleRate)

    NAPI_EXPORT_FUNCTION(getFrame)

    NAPI_EXPORT_FUNCTION(clear)

    NAPI_EXPORT_FUNCTION(capture)

    NAPI_EXPORT_FUNCTION(setPause)

    NAPI_EXPORT_FUNCTION(setFileDestination)

    NAPI_EXPORT_FUNCTION(setAutoSaveCallback)

    NAPI_EXPORT_FUNCTION(setAutoSave)

    NAPI_EXPORT_FUNCTION(getSimulationInfo)

    NAPI_EXPORT_FUNCTION(setSimulation)

    NAPI_EXPORT_FUNCTION(setMonitor)

    NAPI_EXPORT_FUNCTION(setHighDefaultSampleRate)

    NAPI_EXPORT_FUNCTION(setLocalTime)

    NAPI_EXPORT_FUNCTION(forceAutoSaveToStop)

    return exports;

}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)