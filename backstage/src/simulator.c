/****************************************************************************
 * simulator.c
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#include "simulator.h"

/* WAV header constants */

#define NUMBER_OF_BYTES_IN_SAMPLE               2
#define RIFF_ID_LENGTH                          4
#define WAV_HEADER_SEARCH                       1024

/* Example file constant */

#define FILEPATH_SIZE                           8192

/* Simulation constant */

#define CALLBACKS_PER_SECOND                    100
#define MICROSECONDS_IN_SECOND                  1000000
#define MAXIMUM_SAMPLE_RATE                     384000
#define MAXIMUM_BUFFER_LENGTH                   (MAXIMUM_SAMPLE_RATE / CALLBACKS_PER_SECOND)

/* Cross platform macros */

#if defined(_WIN32) || defined(_WIN64)
    #define FILE_SEPARATOR "\\"
#else
    #define FILE_SEPARATOR "/"
#endif

/* Global variables */

static uint32_t offset;

static uint32_t length;

static uint32_t loadedLength;

static int16_t *audioData;

static int16_t *loadedAudioData;

static char buffer[RIFF_ID_LENGTH + 1];

static char filepath[FILEPATH_SIZE];

static int32_t sampleRates[NUMBER_OF_SIMULATION_EXAMPLES] = {192000};

static char *filenames[NUMBER_OF_SIMULATION_EXAMPLES] = {"BAT.WAV"};

static char *descriptions[NUMBER_OF_SIMULATION_EXAMPLES] = {"Bat - Pipistrellus pipistrellus"};

/* Public functions */

int32_t Simulator_getSampleRate(int32_t index) {

    return sampleRates[index];

}

char* Simulator_getDescription(int32_t index) {

    return descriptions[index];

}

bool Simulator_loadExample(int32_t index) {

    if (index < 0) index = 0;

    if (index > NUMBER_OF_SIMULATION_EXAMPLES - 2) index = NUMBER_OF_SIMULATION_EXAMPLES - 1;

    /* Open the file */

    static char filename[FILEPATH_SIZE];

    sprintf(filename, "%s%s%s", filepath, FILE_SEPARATOR, filenames[index]);
    
    FILE *inputFile = fopen(filename, "rb");

    if (inputFile == NULL) {

        puts("[SIMULATOR] Could not open input file");

        return false;

    }

    /* Find the data */
    
    int32_t counter = 0;

    while (counter < WAV_HEADER_SEARCH) {

        fseek(inputFile, counter, SEEK_SET);

        uint32_t numberOfBytes = fread(buffer, 1, RIFF_ID_LENGTH, inputFile);

        if (numberOfBytes != RIFF_ID_LENGTH) {

            puts("[SIMULATOR] Could read from file while finding data");

            return false;

        }

        if (strcmp(buffer, "data") == 0) break;

        counter += 1;

    }

    /* Catch error */

    if (counter == WAV_HEADER_SEARCH) {

        puts("[SIMULATOR] Could not find data");

        return false;

    }

    /* Calculate data size */

    uint32_t numberOfBytes = fread(&loadedLength, 1, sizeof(uint32_t), inputFile);

    if (numberOfBytes != sizeof(uint32_t)) {

        puts("[SIMULATOR] Could not read size of data");

        return false;

    }

    /* Allocate space for the contents */

    loadedAudioData = (int16_t*)malloc(loadedLength);

    if (loadedAudioData == NULL) {

        puts("[SIMULATOR] Could not allocate memory for data");

        return false;

    }

    loadedLength /= NUMBER_OF_BYTES_IN_SAMPLE;

    /* Read the data */

    uint32_t numberOfSamples = fread(loadedAudioData, sizeof(int16_t), loadedLength, inputFile);

    if (numberOfSamples != loadedLength) {

        puts("[SIMULATOR] Could not read data");

        return false;

    }

    /* Close file */

    fclose(inputFile);

    /* Return */

    return true;

}

void Simulator_initialiseExample() {

    if (audioData != NULL) free(audioData);

    audioData = loadedAudioData;

    length = loadedLength;

    offset = 0;

}

int16_t Simulator_nextSample() {

    if (audioData == NULL) return 0;

    int16_t sample = audioData[offset++];

    if (offset == length) offset = 0;

    return sample;

};

void Simulator_setPath(char *path) {

    strncpy(filepath, path, FILEPATH_SIZE);

}
