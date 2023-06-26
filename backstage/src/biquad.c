/****************************************************************************
 * biquad.c
 * openacousticdevices.info
 * May 2020
 *****************************************************************************/

#include <math.h>

#include "biquad.h"

/* Maths constants */

#ifndef M_PI
#define M_PI            3.14159265358979323846
#endif

#ifndef M_TWOPI
#define M_TWOPI         (2.0 * M_PI)
#endif

/* Private functions to determine initial parameters and set final coefficients */

static inline void determineParametersFromFrequencyAndBandwidth(uint32_t frequency, double bandwidth, uint32_t sampleRate, double *omega, double *alpha) {

    *omega = 2.0 * M_PI * (double)frequency / (double)sampleRate;

    *alpha = sin(*omega) * sinhf(logf(2) / 2.0 * bandwidth * *omega / sin(*omega));

}

static inline void determineParametersFromFrequencies(uint32_t frequency1, uint32_t frequency2, uint32_t sampleRate, double *omega, double *alpha) {

    double frequency = ((double)frequency1 + (double)frequency2) / 2.0;

    double Q = frequency / ((double)frequency2 - (double)frequency1);

    *omega = 2.0 * M_PI * (double)frequency / (double)sampleRate;

    *alpha = sin(*omega) / 2.0 / Q;

}

static inline void setFilterCoefficients(BQ_filterCoefficients_t *coefficients, double b0, double b1, double b2, double a0, double a1, double a2) {

    coefficients->A1_A0 = a1 / a0;
    coefficients->A2_A0 = a2 / a0;
    coefficients->B0_A0 = b0 / a0;
    coefficients->B1_A0 = b1 / a0;
    coefficients->B2_A0 = b2 / a0;

}

/* Public functions to create filters */

void Biquad_designLowPassFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency, double bandwidth) {

    double omega, alpha;

    determineParametersFromFrequencyAndBandwidth(frequency, bandwidth, sampleRate, &omega, &alpha);

    double b0 = (1.0 - cos(omega)) / 2.0;
    double b1 = 1.0 - cos(omega);
    double b2 = (1.0 - cos(omega)) / 2.0;

    double a0 = 1.0 + alpha;
    double a1 = -2.0 * cos(omega);
    double a2 = 1.0 - alpha;

    setFilterCoefficients(coefficients, b0, b1, b2, a0, a1, a2);

}

void Biquad_designHighPassFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency, double bandwidth) {

    double omega, alpha;

    determineParametersFromFrequencyAndBandwidth(frequency, bandwidth, sampleRate, &omega, &alpha);

    double b0 = (1.0 + cos(omega)) / 2.0;
    double b1 = -(1.0 + cos(omega));
    double b2 = (1.0 + cos(omega)) / 2.0;

    double a0 = 1.0 + alpha;
    double a1 = -2.0 * cos(omega);
    double a2 = 1.0 - alpha;

    setFilterCoefficients(coefficients, b0, b1, b2, a0, a1, a2);

}

void Biquad_designBandPassFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency1, uint32_t frequency2) {

    double omega, alpha;

    determineParametersFromFrequencies(frequency1, frequency2, sampleRate, &omega, &alpha);

    double b0 = alpha;
    double b1 = 0.0;
    double b2 = -alpha;

    double a0 = 1.0 + alpha;
    double a1 = -2.0 * cos(omega);
    double a2 = 1.0 - alpha;

    setFilterCoefficients(coefficients, b0, b1, b2, a0, a1, a2);

}

void Biquad_designNotchFilter(BQ_filterCoefficients_t *coefficients, uint32_t sampleRate, uint32_t frequency1, uint32_t frequency2) {

    double omega, alpha;

    determineParametersFromFrequencies(frequency1, frequency2, sampleRate, &omega, &alpha);

    double b0 = 1.0;
    double b1 = -2.0 * cos(omega);
    double b2 = 1.0;

    double a0 = 1.0 + alpha;
    double a1 = -2.0 * cos(omega);
    double a2 = 1.0 - alpha;

    setFilterCoefficients(coefficients, b0, b1, b2, a0, a1, a2);

}

/* Public functions to initialise and apply filters */

void Biquad_initialise(BQ_filter_t *filter) {

    for (int i = 0; i < 3; i += 1) {
        filter->xv[i] = 0;
        filter->yv[i] = 0;
    }

}

double Biquad_applyFilter(double sample, BQ_filter_t *filter, BQ_filterCoefficients_t *filterCoefficients) {

    for (int i = 0; i < 2; i += 1) {
        filter->xv[i] = filter->xv[i+1];
        filter->yv[i] = filter->yv[i+1];
    }

    filter->xv[2] = sample;

    filter->yv[2] = filterCoefficients->B0_A0 * filter->xv[2] + filterCoefficients->B1_A0 * filter->xv[1] + filterCoefficients->B2_A0 * filter->xv[0] - filterCoefficients->A1_A0 * filter->yv[1] - filterCoefficients->A2_A0 * filter->yv[0];

    return filter->yv[2];

}
