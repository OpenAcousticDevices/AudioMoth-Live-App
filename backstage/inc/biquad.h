/****************************************************************************
 * biquad.h
 * openacousticdevices.info
 * May 2020
 *****************************************************************************/

#ifndef __BIQUAD_H
#define __BIQUAD_H

#include <stdint.h>

typedef struct {
    double xv[3];
    double yv[3];
} BQ_filter_t;

typedef struct {
    double B0_A0;
    double B1_A0;
    double B2_A0;
    double A1_A0;
    double A2_A0;
} BQ_filterCoefficients_t;

/* Public functions */

void Biquad_designLowPassFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency, double bandwidth);

void Biquad_designHighPassFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency, double bandwidth);

void Biquad_designBandPassFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency1, uint32_t frequency2);

void Biquad_designNotchFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency1, uint32_t frequency2);

void Biquad_initialise(BQ_filter_t *filter);

double Biquad_applyFilter(double sample, BQ_filter_t *filter, BQ_filterCoefficients_t *filterCoefficients);

#endif /* __BIQUAD_H */
