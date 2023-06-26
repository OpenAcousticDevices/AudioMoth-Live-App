/****************************************************************************
 * heterodyne.c
 * openacousticdevices.info
 * February 2023
 *****************************************************************************/

#include <math.h>
#include <stdint.h>
#include <stdlib.h>

#include "biquad.h"
#include "heterodyne.h"

/* Maths constants */

#ifndef M_PI
#define M_PI            3.14159265358979323846
#endif

/* Low pass filter constant */

#define LOW_PASS_FILTER_FREQUENCY       5000
#define LOW_PASS_FILTER_BANDWIDTH       1.0

/* Global state variable */

static BQ_filterCoefficients_t lowPassFilterCoefficients;

static BQ_filter_t lowPassFilter;

static double waveX = 1.0;
static double waveY = 0.0;

static double dX;
static double dY;

/* Public functions */

void Heterodyne_initialise(int32_t sampleRate, int32_t frequency) {

    Heterodyne_updateFrequencies(sampleRate, frequency);

    Biquad_designLowPassFilter(&lowPassFilterCoefficients, sampleRate, LOW_PASS_FILTER_FREQUENCY, LOW_PASS_FILTER_BANDWIDTH);

    Biquad_initialise(&lowPassFilter);
    
}

void Heterodyne_updateFrequencies(int32_t sampleRate, int32_t frequency) {

    Biquad_designLowPassFilter(&lowPassFilterCoefficients, sampleRate, LOW_PASS_FILTER_FREQUENCY, LOW_PASS_FILTER_BANDWIDTH);

    double angle = 2.0 * M_PI * (double)frequency / (double)sampleRate;
    
    dX = cos(angle);
    dY = sin(angle);

}

double Heterodyne_nextOutput(double sample) {

    double newX = dX * waveX - dY * waveY;
    double newY = dX * waveY + dY * waveX;

    waveX = newX;
    waveY = newY;

    double mixerOutput = sample * waveX;

    double output = Biquad_applyFilter(mixerOutput, &lowPassFilter, &lowPassFilterCoefficients);

    return output;

}

void Heterodyne_normalise(void) {

    double correction = 1.0 - (waveX * waveX + waveY * waveY - 1.0) / 2.0;

    waveX *= correction;
    waveY *= correction;

}




