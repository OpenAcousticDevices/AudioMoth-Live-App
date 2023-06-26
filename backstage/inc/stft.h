/****************************************************************************
 * stft.h
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/

#ifndef __STFT_H
#define __STFT_H

#include <stdint.h>
#include <stdbool.h>

void STFT_initialise(void);

void STFT_transform(int16_t *audio, int32_t audioOffset, float *stft, int32_t stftOffset);

#endif /* __STFT_H */