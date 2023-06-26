/****************************************************************************
 * xtime.h
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#ifndef __XTIME_H
#define __XTIME_H

#include <time.h>
#include <stdint.h>

uint32_t Time_getMicroseconds(void);

int64_t Time_getMillisecondUTC(void);

void Time_gmTime(const time_t *timer, struct tm *buf);

int32_t Time_getLocalTimeOffset(void);

#endif /* __XTIME_H */
