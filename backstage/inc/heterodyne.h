/****************************************************************************
 * heterodyne.h
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#ifndef __HETERO_H
#define __HETERO_H

#include <stdint.h>

void Heterodyne_initialise(int32_t sampleRate, int32_t frequency);

void Heterodyne_updateFrequencies(int32_t sampleRate, int32_t frequency);

double Heterodyne_nextOutput(double sample);

void Heterodyne_normalise(void);

#endif /* __HETERO_H */