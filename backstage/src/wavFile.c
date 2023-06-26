/****************************************************************************
 * wavFile.c
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

#include <time.h>
#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

#include "xtime.h"
#include "wavFile.h"

#if defined(_WIN32) || defined(_WIN64)
    #include <io.h>
    #define F_OK 0
    #define access _access
#else
    #include <unistd.h>   
#endif

/* Useful time constants */

#define MILLISECONDS_IN_SECOND                  1000

#define SECONDS_IN_MINUTE                       60
#define SECONDS_IN_HOUR                         (60 * SECONDS_IN_MINUTE)
#define SECONDS_IN_DAY                          (24 * SECONDS_IN_HOUR)

#define MINUTES_IN_HOUR                         60

/* Time format constants */

#define YEAR_OFFSET                             1900
#define MONTH_OFFSET                            1

/* WAV header constants */

#define PCM_FORMAT                              1
#define NUMBER_OF_CHANNELS                      1
#define NUMBER_OF_BITS_IN_INT16                 16

/* Cross platform macros */

#if defined(_WIN32) || defined(_WIN64)
    #define FILE_SEPARATOR "\\"
#else
    #define FILE_SEPARATOR "/"
#endif

/* Default file header */

static WAV_header_t defaultHeader = {
    .riff = {.id = "RIFF", .size = 0},
    .format = "WAVE",
    .fmt = {.id = "fmt ", .size = sizeof(wavFormat_t)},
    .wavFormat = {
        .format = PCM_FORMAT, 
        .numberOfChannels = NUMBER_OF_CHANNELS, 
        .samplesPerSecond = 0, 
        .bytesPerSecond = 0, 
        .bytesPerCapture = NUMBER_OF_BYTES_IN_SAMPLE, 
        .bitsPerSample = NUMBER_OF_BITS_IN_INT16
    },
    .list = {.id = "LIST", .size = RIFF_ID_LENGTH + sizeof(icmt_t) + sizeof(iart_t)},
    .info = "INFO",
    .icmt = {.icmt.id = "ICMT", .icmt.size = LENGTH_OF_COMMENT, .comment = ""},
    .iart = {.iart.id = "IART", .iart.size = LENGTH_OF_ARTIST, .artist = ""},
    .data = {.id = "data", .size = 0}
};

/* Functions to set WAV header details and comment */

void WavFile_initialiseHeader(WAV_header_t *header) {

    memcpy(header, &defaultHeader, sizeof(WAV_header_t));

}

void WavFile_setHeaderDetails(WAV_header_t *header, uint32_t sampleRate, uint32_t numberOfSamples) {

    header->wavFormat.samplesPerSecond = sampleRate;
    header->wavFormat.bytesPerSecond = NUMBER_OF_BYTES_IN_SAMPLE * sampleRate;
    header->data.size = NUMBER_OF_BYTES_IN_SAMPLE * numberOfSamples;
    header->riff.size = NUMBER_OF_BYTES_IN_SAMPLE * numberOfSamples + sizeof(WAV_header_t) - sizeof(chunk_t);

}

void WavFile_setHeaderComment(WAV_header_t *header, int32_t currentTime, int32_t milliseconds, int32_t timeOffset, char *deviceName) {

    struct tm time;

    time_t rawTime = currentTime;

    Time_gmTime(&rawTime, &time);

    /* Format artist field */

    char *artist = header->iart.artist;

    sprintf(artist, "AudioMoth Live");

    /* Format comment field */

    char *comment = header->icmt.comment;

    if (milliseconds < 0) {

        comment += sprintf(comment, "Recorded at %02d:%02d:%02d %02d/%02d/%04d (UTC", time.tm_hour, time.tm_min, time.tm_sec, time.tm_mday, MONTH_OFFSET + time.tm_mon, YEAR_OFFSET + time.tm_year);

    } else {

        comment += sprintf(comment, "Recorded at %02d:%02d:%02d.%03d %02d/%02d/%04d (UTC", time.tm_hour, time.tm_min, time.tm_sec, milliseconds, time.tm_mday, MONTH_OFFSET + time.tm_mon, YEAR_OFFSET + time.tm_year);

    }

    int32_t timeOffsetMinutes = timeOffset / SECONDS_IN_MINUTE;

    int32_t timezoneHours = timeOffsetMinutes / MINUTES_IN_HOUR;

    int32_t timezoneMinutes = timeOffsetMinutes % MINUTES_IN_HOUR;

    if (timezoneHours < 0) {

        comment += sprintf(comment, "%d", timezoneHours);

    } else if (timezoneHours > 0) {

        comment += sprintf(comment, "+%d", timezoneHours);

    } else {

        if (timezoneMinutes < 0) comment += sprintf(comment, "-0");

        if (timezoneMinutes > 0) comment += sprintf(comment, "+0");

    }

    if (timezoneMinutes < 0) comment += sprintf(comment, ":%02d", -timezoneMinutes);

    if (timezoneMinutes > 0) comment += sprintf(comment, ":%02d", timezoneMinutes);

    sprintf(comment, ") by %s using %s.", artist, deviceName);

}

/* Function to generate file name */

void WavFile_setFilename(char *filename, int32_t currentTime, int32_t milliseconds, char *fileDestination) {

    struct tm time;

    time_t rawTime = currentTime;

    Time_gmTime(&rawTime, &time);

    if (milliseconds < 0) {

        sprintf(filename, "%s%s%04d%02d%02d_%02d%02d%02d.WAV", fileDestination, FILE_SEPARATOR, YEAR_OFFSET + time.tm_year, MONTH_OFFSET + time.tm_mon, time.tm_mday, time.tm_hour, time.tm_min, time.tm_sec);

    } else {
    
        sprintf(filename, "%s%s%04d%02d%02d_%02d%02d%02d_%03d.WAV", fileDestination, FILE_SEPARATOR, YEAR_OFFSET + time.tm_year, MONTH_OFFSET + time.tm_mon, time.tm_mday, time.tm_hour, time.tm_min, time.tm_sec, milliseconds);

    }

}

/* Function to write file */

bool WavFile_writeFile(WAV_header_t *header, char *filename, int16_t *buffer1, int32_t numberOfSamples1, int16_t *buffer2, int32_t numberOfSamples2) {

    FILE *outputFile = fopen(filename, "w+b");

    if (outputFile == NULL) return false;

    /* Write the header */

    int32_t length = (int32_t)fwrite(header, sizeof(WAV_header_t), 1, outputFile);

    if (length != 1) return false;

    /* Write the data */

    length = (int32_t)fwrite(buffer1, NUMBER_OF_BYTES_IN_SAMPLE, numberOfSamples1, outputFile);

    if (length != numberOfSamples1) return false;

    if (buffer2 != NULL) {

        length = (int32_t)fwrite(buffer2, NUMBER_OF_BYTES_IN_SAMPLE, numberOfSamples2, outputFile);

        if (length != numberOfSamples2) return false;

    }

    /* Close the file */

    return fclose(outputFile) == 0;

}

bool WavFile_appendFile(char *filename, int16_t *buffer1, int32_t numberOfSamples1, int16_t *buffer2, int32_t numberOfSamples2) {

    static WAV_header_t header;

    if (access(filename, F_OK) != 0) return false;

    FILE *outputFile = fopen(filename, "r+b");

    if (outputFile == NULL) return false;

    /* Write the data */

    fseek(outputFile, 0, SEEK_END);

    int32_t length = (int32_t)fwrite(buffer1, NUMBER_OF_BYTES_IN_SAMPLE, numberOfSamples1, outputFile);

    if (length != numberOfSamples1) return false;

    if (buffer2 != NULL) {

        length = (int32_t)fwrite(buffer2, NUMBER_OF_BYTES_IN_SAMPLE, numberOfSamples2, outputFile);

        if (length != numberOfSamples2) return false;

    }

    /* Rewind to the start and load the header */

    fseek(outputFile, 0, SEEK_SET);

    length = (int32_t)fread(&header, sizeof(WAV_header_t), 1, outputFile);

    if (length != 1) return false;

    /* Update the header */

    int32_t numberOfSamples = numberOfSamples1;

    if (buffer2 != NULL) numberOfSamples += numberOfSamples2;

    header.data.size += NUMBER_OF_BYTES_IN_SAMPLE * numberOfSamples;
    header.riff.size += NUMBER_OF_BYTES_IN_SAMPLE * numberOfSamples;

    /* Write the header */

    fseek(outputFile, 0, SEEK_SET);

    length = (int32_t)fwrite(&header, sizeof(WAV_header_t), 1, outputFile);

    if (length != 1) return false;

    /* Close the file */

    return fclose(outputFile) == 0;

}
