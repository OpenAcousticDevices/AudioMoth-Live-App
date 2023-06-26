/****************************************************************************
 * xtime.c
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/
 
#include "string.h"

#include "xtime.h"

/* Unit conversion constants */

#define NANOSECONDS_IN_MILLISECOND      1000000
#define NANOSECONDS_IN_MICROSECOND      1000
#define MILLISECONDS_IN_SECOND          1000
#define SECONDS_IN_MINUTE               60

/* Public function */

#if defined(_WIN32) || defined(_WIN64)

    #define timegm _mkgmtime

    uint32_t Time_getMicroseconds() {

        struct timespec time;
        
        timespec_get(&time, TIME_UTC);
        
        int64_t microseconds = time.tv_nsec / NANOSECONDS_IN_MICROSECOND;
        
        return (uint32_t)microseconds;

    }

    int64_t Time_getMillisecondUTC() {

        struct timespec time;

        timespec_get(&time, TIME_UTC);

        int64_t milliseconds = (int64_t)time.tv_sec * MILLISECONDS_IN_SECOND + (int64_t)time.tv_nsec / NANOSECONDS_IN_MILLISECOND;

        return milliseconds;

    }

    void Time_gmTime(const time_t *timer, struct tm *buf) {

        gmtime_s(buf, timer);

    }

#else

    uint32_t Time_getMicroseconds(void) {

        struct timespec time;

        clock_gettime(CLOCK_REALTIME, &time);

        int64_t microseconds = (int64_t)time.tv_nsec / NANOSECONDS_IN_MICROSECOND;
        
        return (uint32_t)microseconds;

    }

    int64_t Time_getMillisecondUTC(void) {

        struct timespec time;

        clock_gettime(CLOCK_REALTIME, &time);

        int64_t milliseconds = (int64_t)time.tv_sec * MILLISECONDS_IN_SECOND + (int64_t)time.tv_nsec / NANOSECONDS_IN_MILLISECOND;

        return milliseconds;

    }

    void Time_gmTime(const time_t *timer, struct tm *buf) {

        gmtime_r(timer, buf);

    }

#endif

int32_t Time_getLocalTimeOffset(void) {

    time_t t  = time (NULL);

    struct tm *locg = localtime(&t);

    struct tm locl;

    memcpy(&locl, locg, sizeof(struct tm));

    int timeOffset = (int32_t)(timegm(locg) - mktime (&locl));

    return timeOffset;

}
