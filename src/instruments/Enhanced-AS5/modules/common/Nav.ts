export const BEARING_POINTERS = ['NONE', 'GPS', 'VLOC1', 'VLOC2', 'ADF'] as const
export type BearingPointerValue = (typeof BEARING_POINTERS)[number]

export type NavSourceLabel =
    | 'GPS'
    | 'VOR1'
    | 'LOC1'
    | 'TCN1'
    | 'VOR2'
    | 'LOC2'
    | 'TCN2'
    | 'ADF'
    | ''

export enum NavSource {
    GPS = 'GPS',
    Nav1 = 'NAV1',
    Nav2 = 'NAV2',
    Adf = 'ADF',
    None = '',
}

export function resolveNavSourceLabel(
    source: NavSource,
    tacan: boolean,
    loc1: boolean,
    loc2: boolean
): NavSourceLabel {
    if (source === NavSource.GPS) return 'GPS'
    if (source === NavSource.Adf) return 'ADF'
    if (source === NavSource.None) return '' as NavSourceLabel
    if (tacan) return source === NavSource.Nav1 ? 'TCN1' : 'TCN2'
    return source === NavSource.Nav1 ? (loc1 ? 'LOC1' : 'VOR1') : loc2 ? 'LOC2' : 'VOR2'
}
