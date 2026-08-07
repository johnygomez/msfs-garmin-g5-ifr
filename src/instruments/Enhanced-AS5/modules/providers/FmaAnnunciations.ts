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
}

const VERTICAL_ACTIVE_LABELS: Partial<Record<APVerticalModes, string>> = {
    [APVerticalModes.PITCH]: 'PIT',
    [APVerticalModes.FLC]: 'IAS',
    [APVerticalModes.ALT]: 'ALT',
    [APVerticalModes.VS]: 'VS',
    [APVerticalModes.GS]: 'GS',
    [APVerticalModes.GP]: 'GP',
}

const ALTITUDE_CAPTURE_LABELS: Record<APAltitudeModes, string> = {
    [APAltitudeModes.NONE]: 'ALT',
    [APAltitudeModes.ALTS]: 'ALTS',
    [APAltitudeModes.ALTV]: 'ALTV',
}

export const lateralLabel = (mode: APLateralModes): string => LATERAL_LABELS[mode] ?? ''

export const verticalActiveLabel = (
    mode: APVerticalModes,
    altitudeCapture: APAltitudeModes
): string =>
    mode === APVerticalModes.CAP
        ? ALTITUDE_CAPTURE_LABELS[altitudeCapture]
        : (VERTICAL_ACTIVE_LABELS[mode] ?? '')

export const verticalArmedLabels = (data: Readonly<FmaData>): string[] => {
    const labels: string[] = []

    const approach = VERTICAL_ACTIVE_LABELS[data.verticalApproachArmed as APVerticalModes]
    if (approach !== undefined) {
        labels.push(approach)
    }

    if (data.altitudeCaptureArmed) {
        labels.push(ALTITUDE_CAPTURE_LABELS[data.verticalAltitudeArmed])
    }

    return labels
}

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
