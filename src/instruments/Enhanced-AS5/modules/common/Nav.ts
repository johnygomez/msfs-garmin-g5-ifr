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

/** Index of one of the two nav radios, as used in the `navN_*` event topics. */
export type NavRadioIndex = 1 | 2

export function resolveNavRadioIndex(navSelected: number): NavRadioIndex {
    return navSelected === 2 ? 2 : 1
}

export function resolveNavRadioSource(navSelected: number): NavSource {
    return resolveNavRadioIndex(navSelected) === 2 ? NavSource.Nav2 : NavSource.Nav1
}

export function resolveNavSourceLabel(
    source: NavSource,
    tacan: boolean,
    loc1: boolean,
    loc2: boolean
): NavSourceLabel {
    if (source === NavSource.GPS) return 'GPS'
    if (source === NavSource.Adf) return 'ADF'
    if (source === NavSource.None) return ''
    if (tacan) return source === NavSource.Nav1 ? 'TCN1' : 'TCN2'
    return source === NavSource.Nav1 ? (loc1 ? 'LOC1' : 'VOR1') : loc2 ? 'LOC2' : 'VOR2'
}

/**
 * The course a nav radio is tuned to: the TACAN OBS while TACAN drives the radio, the
 * localizer front course once an ILS is received, and the selected OBS radial otherwise.
 */
export function resolveNavCourse(
    tacan: boolean,
    hasLoc: boolean,
    localizer: number,
    obs: number,
    tacanObs: number
): number {
    if (tacan) return tacanObs
    return hasLoc ? localizer : obs
}
