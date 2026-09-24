const DOTS_PER_SIDE = 2
const FULL_SCALE_DOTS = 2.5

export const DEVIATION_DOT_FRACTIONS: readonly number[] = Array.from(
    { length: DOTS_PER_SIDE * 2 + 1 },
    (_, index) => index - DOTS_PER_SIDE
)
    .filter(dot => dot !== 0)
    .map(dot => dot / FULL_SCALE_DOTS)

export const scaleDeflection = (fullScaleFraction: number, fullScaleDeflection: number): number =>
    Math.min(Math.max(fullScaleFraction, -1), 1) * fullScaleDeflection
