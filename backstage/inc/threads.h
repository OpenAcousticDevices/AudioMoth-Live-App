/****************************************************************************
 * threads.h
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#ifndef __THREADS_H
#define __THREADS_H

#if defined(_WIN32) || defined(_WIN64)

    #include <stdlib.h>
    #include <windows.h>

    typedef CRITICAL_SECTION pthread_mutex_t;
    typedef void pthread_attr_t;
    typedef void pthread_mutexattr_t;
    typedef HANDLE pthread_t;

    int pthread_create(pthread_t *thread, pthread_attr_t *attr, void *(*start_routine)(void *), void *arg);
    int pthread_join(pthread_t thread, void **value_ptr);
    int pthread_detach(pthread_t);

    void usleep(__int64 usec);

    int pthread_mutex_init(pthread_mutex_t *mutex, pthread_mutexattr_t *attr);
    int pthread_mutex_destroy(pthread_mutex_t *mutex);
    int pthread_mutex_lock(pthread_mutex_t *mutex);
    int pthread_mutex_unlock(pthread_mutex_t *mutex);

#else

    #include <pthread.h>
    
#endif

#endif /* __THREADS_H */