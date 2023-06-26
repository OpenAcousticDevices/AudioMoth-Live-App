/****************************************************************************
 * autosave.c
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/
 
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "threads.h"
#include "autosave.h"

/* Global queue variables */

static int32_t readIndex;

static int32_t writeIndex;

static AS_event_t* events;

static pthread_mutex_t mutex;

static int32_t numberOfEvents;

/* Public functions */

bool Autosave_initialise(int32_t number) {

    pthread_mutex_init(&mutex, NULL);

    pthread_mutex_lock(&mutex);
    
    events = (AS_event_t*)calloc(number, sizeof(AS_event_t));

    numberOfEvents = number;

    writeIndex = 0;

    readIndex = 0;

    pthread_mutex_unlock(&mutex);

    return events != NULL;

}

bool Autosave_hasEvents(void) {

    pthread_mutex_lock(&mutex);

    bool hasEvents = readIndex != writeIndex;

    pthread_mutex_unlock(&mutex);

    return hasEvents;
    
}

bool Autosave_getFirstEvent(AS_event_t *event) {

    pthread_mutex_lock(&mutex);

    bool contents = readIndex != writeIndex;

    if (contents) {
        
        memcpy(event, events + readIndex, sizeof(AS_event_t));

        readIndex = (readIndex + 1) % numberOfEvents;
    }

    pthread_mutex_unlock(&mutex);

    return contents;

}

bool Autosave_addEvent(AS_event_t *event) {

    pthread_mutex_lock(&mutex);

    if ((writeIndex + 1) % numberOfEvents == readIndex) {

        AS_event_t *newEvents = (AS_event_t*)calloc(2 * numberOfEvents, sizeof(AS_event_t));

        if (newEvents == NULL) {
            
            pthread_mutex_unlock(&mutex);

            return false;

        }
        
        memcpy(newEvents, events + readIndex, (numberOfEvents - readIndex) * sizeof(AS_event_t));

        if (writeIndex < readIndex) {

            memcpy(newEvents + numberOfEvents - readIndex, events, (writeIndex + 1) * sizeof(AS_event_t));

            writeIndex = numberOfEvents - 1;

            readIndex = 0;

        }

        free(events);

        events = newEvents;

        numberOfEvents *= 2;

    }

    memcpy(events + writeIndex, event, sizeof(AS_event_t));

    writeIndex = (writeIndex + 1) % numberOfEvents;

    pthread_mutex_unlock(&mutex);

    return true;

}
