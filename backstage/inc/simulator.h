/****************************************************************************
 * simulator.h
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#ifndef __SIMULATOR_H
#define __SIMULATOR_H

#include <stdint.h>
#include <stdbool.h>

#define NUMBER_OF_SIMULATION_EXAMPLES   1

int32_t Simulator_getSampleRate(int32_t index);

char* Simulator_getDescription(int32_t index);

bool Simulator_loadExample(int32_t index);

void Simulator_initialiseExample();

int16_t Simulator_nextSample(void);

void Simulator_setPath(char *path);

#endif /* __SIMULATOR_H */