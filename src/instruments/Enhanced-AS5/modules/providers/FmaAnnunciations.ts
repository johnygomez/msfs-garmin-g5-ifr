import { FmaData, FmaModeSlotActiveData } from '@microsoft/msfs-garminsdk'
import {
    APAltitudeModes,
    APLateralModes,
    APVerticalModes,
    Subject,
    Subscribable,
} from '@microsoft/msfs-sdk'

const LATERAL_LABELS: Partial<Record<APLateralModes, string>> = {
    [APLateralModes.LEVEL]: 'LVL',
    [APLateralModes.ROLL]: 'ROL',
    [APLateralModes.HEADING]: 'HDG',
    [APLateralModes.GPSS]: 'GPS',
    [APLateralModes.VOR]: 'VOR',
    [APLateralModes.LOC]: 'LOC',
    [APLateralModes.BC]: 'BC',
    [APLateralModes.TO]: 'TO',
    [APLateralModes.GA]: 'GA',
}

const VERTICAL_ACTIVE_LABELS: Partial<Record<APVerticalModes, string>> = {
    [APVerticalModes.PITCH]: 'PIT',
    [APVerticalModes.FLC]: 'IAS',
    [APVerticalModes.ALT]: 'ALT',
    [APVerticalModes.VS]: 'VS',
    [APVerticalModes.GS]: 'GS',
    [APVerticalModes.GP]: 'GP',
    [APVerticalModes.PATH]: 'VNAV',
    [APVerticalModes.TO]: 'TO',
    [APVerticalModes.GA]: 'GA',
    [APVerticalModes.LEVEL]: 'LVL',
}

const VERTICAL_ARMED_LABELS: Partial<Record<APVerticalModes, string>> = {
    [APVerticalModes.PATH]: 'VNAV',
    [APVerticalModes.FLC]: 'IAS',
}

const ALTITUDE_CAPTURE_LABELS: Record<APAltitudeModes, string> = {
    [APAltitudeModes.NONE]: 'ALT',
    [APAltitudeModes.ALTS]: 'ALTS',
    [APAltitudeModes.ALTV]: 'ALTV',
}

/** How many armed vertical annunciations the info bar has room for beside the active mode. */
const VERTICAL_ARMED_SLOTS = 2

export const lateralLabel = (mode: APLateralModes): string => LATERAL_LABELS[mode] ?? ''

export const verticalActiveLabel = (
    mode: APVerticalModes,
    altitudeCapture: APAltitudeModes
): string =>
    mode === APVerticalModes.CAP
        ? ALTITUDE_CAPTURE_LABELS[altitudeCapture]
        : (VERTICAL_ACTIVE_LABELS[mode] ?? '')

const altitudeArmedLabel = (data: Readonly<FmaData>): string | undefined => {
    if (data.altitudeCaptureArmed) {
        return ALTITUDE_CAPTURE_LABELS[data.verticalAltitudeArmed]
    }
    return data.verticalArmed === APVerticalModes.ALT
        ? ALTITUDE_CAPTURE_LABELS[APAltitudeModes.NONE]
        : undefined
}

/** Every armed vertical annunciation, most significant first. */
export const verticalArmedLabels = (data: Readonly<FmaData>): string[] => {
    const labels: string[] = []

    const approach = VERTICAL_ACTIVE_LABELS[data.verticalApproachArmed as APVerticalModes]
    if (approach !== undefined) {
        labels.push(approach)
    }

    const armed = VERTICAL_ARMED_LABELS[data.verticalArmed as APVerticalModes]
    if (armed !== undefined) {
        labels.push(armed)
    }

    const altitude = altitudeArmedLabel(data)
    if (altitude !== undefined) {
        labels.push(altitude)
    }

    return labels
}

/**
 * The armed annunciations that fit in the info bar. All three sources can be armed at once, so
 * the least significant is dropped rather than being pushed off the end unnoticed.
 */
export const displayedVerticalArmedLabels = (labels: readonly string[]): readonly string[] =>
    labels.slice(0, VERTICAL_ARMED_SLOTS)

/**
 * Holds the active mode of one `FmaModeSlot`, flagging it as captured when it was armed on the
 * previous update. Only a change of the mode itself reaches the slot, so neither an unrelated
 * update nor the flag going stale can cut the capture flash short.
 */
export class FmaModeSlotSource {
    private previousArmed: readonly string[] = []

    private readonly data = Subject.create<FmaModeSlotActiveData>(
        {
            active: '',
            armedTransition: undefined,
            secondaryArmedTransition: undefined,
            failed: undefined,
        },
        (a, b) => a.active === b.active,
        (oldValue, newValue) => {
            Object.assign(oldValue, newValue)
        }
    )

    get subject(): Subscribable<FmaModeSlotActiveData> {
        return this.data
    }

    update(active: string, armed: readonly string[]): void {
        const captured = active !== '' && this.previousArmed.includes(active)
        this.data.set({
            active,
            armedTransition: captured ? active : undefined,
            secondaryArmedTransition: undefined,
            failed: undefined,
        })
        this.previousArmed = armed.slice()
    }
}
