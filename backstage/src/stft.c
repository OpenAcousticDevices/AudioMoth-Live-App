/****************************************************************************
 * stft.c
 * openacousticdevices.info
 * January 2023
 *****************************************************************************/
 
#include <math.h>
#include <stdint.h>

/* Global constants */

#define SIZE                512
#define CSIZE               (SIZE << 1)

#define BITS_IN_UINT32      32

/* Trigonometry constant */

#ifndef M_PI
    #define M_PI            3.14159265358979323846264338328f
#endif

/* Global work space */

static int32_t width;

static float out[CSIZE];

static float coefficients[SIZE];

static float trigonometryTable[CSIZE];

static uint32_t bitReversalTable[SIZE / 2];

/* Radix functions */

static inline void singleRealTransform2(int16_t *audio, int32_t audioOffset, int32_t index, int32_t step, int32_t outOffset) {

    const float evenR = (float)audio[audioOffset + index] * coefficients[index];
    const float oddR = (float)audio[audioOffset + index + step] * coefficients[index + step];

    const float leftR = evenR + oddR;
    const float rightR = evenR - oddR;

    out[outOffset] = leftR;
    out[outOffset + 1] = 0;
    out[outOffset + 2] = rightR;
    out[outOffset + 3] = 0;

}

static inline void singleRealTransform4(int16_t *audio, int32_t audioOffset, int32_t index, int32_t step, int32_t outOffset) {

    const float Ar = (float)audio[audioOffset + index] * coefficients[index];
    const float Br = (float)audio[audioOffset + index + step] * coefficients[index + step];
    const float Cr = (float)audio[audioOffset + index + 2 * step] * coefficients[index + 2 * step];
    const float Dr = (float)audio[audioOffset + index + 3 * step] * coefficients[index + 3 * step];

    const float T0r = Ar + Cr;
    const float T1r = Ar - Cr;
    const float T2r = Br + Dr;
    const float T3r = Br - Dr;

    const float FAr = T0r + T2r;
    const float FBr = T1r;
    const float FBi = -T3r;
    const float FCr = T0r - T2r;
    const float FDr = T1r;
    const float FDi = T3r;

    out[outOffset] = FAr;
    out[outOffset + 1] = 0;
    out[outOffset + 2] = FBr;
    out[outOffset + 3] = FBi;
    out[outOffset + 4] = FCr;
    out[outOffset + 5] = 0;
    out[outOffset + 6] = FDr;
    out[outOffset + 7] = FDi;

}

/* Public function */

void STFT_initialise() {

    /* Generate trigonometry table */

    for (int32_t i = 0; i < CSIZE; i += 2) {

        float angle = M_PI * (float)i / (float)SIZE;

        trigonometryTable[i] = cosf(angle);

        trigonometryTable[i+1] = -sinf(angle);

    }

    /* Generate Hann window coefficients */

    for (int32_t i = 0; i < SIZE; i += 1) {

        coefficients[i] = sinf(M_PI * (float)i / ((float)SIZE - 1.0f));

    }

    /* Calculate the width */

    int32_t power = 0;

    for (int32_t t = 1; SIZE > t; t <<= 1) {

        power += 1;

    }

    width = power % 2 == 0 ? power - 1 : power;  

    /* Generate bit-reversal patterns */

    for (int32_t j = 0; j < SIZE / 2; j += 1) {

        bitReversalTable[j] = 0;

        for (int32_t shift = 0; shift < width; shift += 2) {

            int32_t revShift = width - shift - 2;

            bitReversalTable[j] |= ((j >> shift) & 3) << ((BITS_IN_UINT32 + revShift) % BITS_IN_UINT32);

        }

    }

}

void STFT_transform(int16_t *audio, int32_t audioOffset, float *stft, int32_t stftOffset) {

    /* Initialise counters */

    int32_t step = 1 << width;

    int32_t len = (CSIZE / step) << 1;

    /* Call initial transform functions */

    if (len == 4) {

        for (int32_t outputOffset = 0, t = 0; outputOffset < CSIZE; outputOffset += len, t++) {

            singleRealTransform2(audio, audioOffset, bitReversalTable[t] >> 1, step >> 1, outputOffset);

        }

    } else {

        for (int32_t outputOffset = 0, t = 0; outputOffset < CSIZE; outputOffset += len, t++) {

            singleRealTransform4(audio, audioOffset, bitReversalTable[t] >> 1, step >> 1, outputOffset);

        }

    }

    /* Complete transform */

    for (step >>= 2; step >= 2; step >>= 2) {

        len = (CSIZE / step) << 1;

        const int32_t halfLen = len >> 1;
        const int32_t quarterLen = halfLen >> 1;
        const int32_t halfQuarterLen = quarterLen >> 1;

        for (int32_t outputOffset = 0; outputOffset < CSIZE; outputOffset += len) {

            for (int32_t i = 0, k = 0; i <= halfQuarterLen; i += 2, k += step) {

                const int32_t A = outputOffset + i;
                const int32_t B = A + quarterLen;
                const int32_t C = B + quarterLen;
                const int32_t D = C + quarterLen;

                const float Ar = out[A];
                const float Ai = out[A + 1];
                const float Br = out[B];
                const float Bi = out[B + 1];
                const float Cr = out[C];
                const float Ci = out[C + 1];
                const float Dr = out[D];
                const float Di = out[D + 1];

                const float MAr = Ar;
                const float MAi = Ai;

                const float tableBr = trigonometryTable[k];
                const float tableBi = trigonometryTable[k + 1];
                const float MBr = Br * tableBr - Bi * tableBi;
                const float MBi = Br * tableBi + Bi * tableBr;

                const float tableCr = trigonometryTable[2 * k];
                const float tableCi = trigonometryTable[2 * k + 1];
                const float MCr = Cr * tableCr - Ci * tableCi;
                const float MCi = Cr * tableCi + Ci * tableCr;

                const float tableDr = trigonometryTable[3 * k];
                const float tableDi = trigonometryTable[3 * k + 1];
                const float MDr = Dr * tableDr - Di * tableDi;
                const float MDi = Dr * tableDi + Di * tableDr;

                const float T0r = MAr + MCr;
                const float T0i = MAi + MCi;
                const float T1r = MAr - MCr;
                const float T1i = MAi - MCi;
                const float T2r = MBr + MDr;
                const float T2i = MBi + MDi;
                const float T3r = MBr - MDr;
                const float T3i = MBi - MDi;

                const float FAr = T0r + T2r;
                const float FAi = T0i + T2i;

                const float FBr = T1r + T3i;
                const float FBi = T1i - T3r;

                out[A] = FAr;
                out[A + 1] = FAi;
                out[B] = FBr;
                out[B + 1] = FBi;

                if (i == 0) {

                    const float FCr = T0r - T2r;
                    const float FCi = T0i - T2i;
                    out[C] = FCr;
                    out[C + 1] = FCi;

                    continue;

                }

                if (i == halfQuarterLen) continue;

                const float ST0r = T1r;
                const float ST0i = -T1i;
                const float ST1r = T0r;
                const float ST1i = -T0i;
                const float ST2r = -T3i;
                const float ST2i = -T3r;
                const float ST3r = -T2i;
                const float ST3i = -T2r;

                const float SFAr = ST0r + ST2r;
                const float SFAi = ST0i + ST2i;

                const float SFBr = ST1r + ST3i;
                const float SFBi = ST1i - ST3r;

                const int32_t SA = outputOffset + quarterLen - i;
                const int32_t SB = outputOffset + halfLen - i;

                out[SA] = SFAr;
                out[SA + 1] = SFAi;
                out[SB] = SFBr;
                out[SB + 1] = SFBi;

            }

        }

    }

    /* Calculate log magnitude for output */

    for (int32_t k = 0; k < SIZE / 2; k += 1) {

        float real = out[2 * k];
        float imag = out[2 * k + 1];

        float magnitudeSquared = 4.0f / (float)SIZE / (float)SIZE * (real * real + imag * imag);

        stft[stftOffset + k] = log2f(magnitudeSquared) / 2.0f;

    }

}