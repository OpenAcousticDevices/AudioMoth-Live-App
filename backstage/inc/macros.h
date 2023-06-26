/****************************************************************************
 * macros.h
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

#ifndef __MACROS_H
#define __MACROS_H

#if defined(_WIN32) || defined(_WIN64)
    #define IS_WINDOWS true
#else
    #define IS_WINDOWS false
#endif

#define ABS(x)                  (((x) < 0) ? -(x) : (x))

#define MIN(a, b)               ((a) < (b) ? (a) : (b))

#define MAX(a, b)               ((a) > (b) ? (a) : (b))

#define ROUNDED_DIV(a, b)       (((a) + ((b)/2)) / (b))

#define MA_CALL(env, message, call)                             \
    {                                                           \
      ma_result miniaudio_result = (call);                      \
      if (miniaudio_result != MA_SUCCESS) {                     \
          napi_throw_error((env), NULL, (message));             \
      }                                                         \
    }

#define NAPI_CALL(env, message, call)                           \
    {                                                           \
      napi_status status = (call);                              \
      if (status != napi_ok) {                                  \
          napi_throw_error((env), NULL, (message));             \
      }                                                         \
    }

#define NAPI_EXPORT_FUNCTION(func)                                                              \
    {                                                                                           \
        napi_value fn;                                                                          \
        napi_status status = napi_create_function(env, NULL, 0, func, NULL, &fn);               \
        if (status != napi_ok) napi_throw_error(env, NULL, "Unable to wrap native function");   \
        status = napi_set_named_property(env, exports, #func, fn);                              \
        if (status != napi_ok) napi_throw_error(env, NULL, "Unable to populate exports");       \
    }                                                                           

#endif /* __MACROS_H */