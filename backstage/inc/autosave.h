/****************************************************************************
 * autosave.h
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#ifndef __AUTOSAVE_H
#define __AUTOSAVE_H

#include <stdint.h>
#include <stdbool.h>

#define DEVICE_NAME_SIZE    1024

typedef enum {AS_START, AS_RESTART, AS_STOP, AS_SHUTDOWN} AS_event_type_t;

typedef struct {
    AS_event_type_t type;
    int32_t sampleRate;
    int32_t currentIndex;
    int64_t currentCount;
    int64_t startTime;
    int64_t startCount;
    char inputDeviceCommentName[DEVICE_NAME_SIZE];
} AS_event_t;

bool Autosave_initialise(int32_t number);

bool Autosave_hasEvents(void);

bool Autosave_getFirstEvent(AS_event_t *event);

bool Autosave_addEvent(AS_event_t *event);

#endif /* __AUTOSAVE_H */