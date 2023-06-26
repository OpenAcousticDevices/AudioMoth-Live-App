/****************************************************************************
 * wavFile.h
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

#ifndef __WAV_FILE_H
#define __WAV_FILE_H

#include <stdint.h>
#include <stdbool.h>

#define RIFF_ID_LENGTH                          4
#define LENGTH_OF_ARTIST                        32
#define LENGTH_OF_COMMENT                       384
#define NUMBER_OF_BYTES_IN_SAMPLE               2

#pragma pack(push, 1)

typedef struct {
    char id[RIFF_ID_LENGTH];
    uint32_t size;
} chunk_t;

typedef struct {
    chunk_t icmt;
    char comment[LENGTH_OF_COMMENT];
} icmt_t;

typedef struct {
    chunk_t iart;
    char artist[LENGTH_OF_ARTIST];
} iart_t;

typedef struct {
    uint16_t format;
    uint16_t numberOfChannels;
    uint32_t samplesPerSecond;
    uint32_t bytesPerSecond;
    uint16_t bytesPerCapture;
    uint16_t bitsPerSample;
} wavFormat_t;

typedef struct {
    chunk_t riff;
    char format[RIFF_ID_LENGTH];
    chunk_t fmt;
    wavFormat_t wavFormat;
    chunk_t list;
    char info[RIFF_ID_LENGTH];
    icmt_t icmt;
    iart_t iart;
    chunk_t data;
} WAV_header_t;

#pragma pack(pop)

void WavFile_initialiseHeader(WAV_header_t *header);

void WavFile_setHeaderDetails(WAV_header_t *header, uint32_t sampleRate, uint32_t numberOfSamples);

void WavFile_setHeaderComment(WAV_header_t *header, int32_t currentTime, int32_t milliseconds, int32_t timeOffset, char *deviceName);

void WavFile_setFilename(char *filename, int32_t currentTime,int32_t milliseconds, char *fileDestination);

bool WavFile_writeFile(WAV_header_t *header, char *filename, int16_t *buffer1, int32_t numberOfSamples1, int16_t *buffer2, int32_t numberOfSamples2);

bool WavFile_appendFile(char *filename, int16_t *buffer1, int32_t numberOfSamples1, int16_t *buffer2, int32_t numberOfSamples2);

#endif /* __WAV_FILE_H */