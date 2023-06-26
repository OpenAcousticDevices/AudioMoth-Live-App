/****************************************************************************
 * threads.c
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#if defined(_WIN32) || defined(_WIN64)

    #include "threads.h"

    typedef struct {
        void *(*start_routine)(void *);
        void *start_arg;
    } win_thread_start_t;

    static DWORD WINAPI win_thread_start(void *arg) {

        win_thread_start_t *data       = arg;
        void *(*start_routine)(void *) = data->start_routine;
        void *start_arg                = data->start_arg;

        free(data);

        start_routine(start_arg);

        return 0; 

    }

    int pthread_create(pthread_t *thread, pthread_attr_t *attr, void *(*start_routine)(void *), void *arg) {

        win_thread_start_t *data;

        if (thread == NULL || start_routine == NULL) return 1;

        data = malloc(sizeof(*data));
        data->start_routine = start_routine;
        data->start_arg     = arg;

        *thread = CreateThread(NULL, 0, win_thread_start, data, 0, NULL);
        
        if (*thread == NULL) return 1;

        return 0;

    }

    int pthread_join(pthread_t thread, void **value_ptr) {

        WaitForSingleObject(thread, INFINITE);

        CloseHandle(thread);

        return 0;

    }

    int pthread_detach(pthread_t thread) {

        CloseHandle(thread);

        return 0;

    }

    void usleep(__int64 usec) {

        HANDLE timer; 
        LARGE_INTEGER ft; 

        ft.QuadPart = -(10*usec);

        timer = CreateWaitableTimer(NULL, TRUE, NULL); 
        SetWaitableTimer(timer, &ft, 0, NULL, NULL, 0); 
        WaitForSingleObject(timer, INFINITE); 
        CloseHandle(timer); 

    }

    int pthread_mutex_init(pthread_mutex_t *mutex, pthread_mutexattr_t *attr) {

        if (mutex == NULL) return 1;

        InitializeCriticalSection(mutex);

        return 0;

    }

    int pthread_mutex_destroy(pthread_mutex_t *mutex) {

        if (mutex == NULL) return 1;

        DeleteCriticalSection(mutex);
        
        return 0;

    }

    int pthread_mutex_lock(pthread_mutex_t *mutex) {

        if (mutex == NULL) return 1;

        EnterCriticalSection(mutex);
        
        return 0;

    }

    int pthread_mutex_unlock(pthread_mutex_t *mutex) {

        if (mutex == NULL) return 1;

        LeaveCriticalSection(mutex);
        
        return 0;

    }

#endif
