export const BEARING_POINTERS = ['NONE', 'GPS', 'VLOC1', 'VLOC2', 'ADF'] as const
export type BearingPointerValue = (typeof BEARING_POINTERS)[number]
