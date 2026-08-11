import { CDIScaleLabel } from '@microsoft/msfs-garminsdk'
import { SimVarValueType } from '@microsoft/msfs-sdk'

/** Bus topic carrying the resolved GPS CDI-scaling phase label for the G5 displays. */
export interface G5NavdataEvents {
    g5_cdi_scale_label: CDIScaleLabel
}

const SCALE_LABEL_BY_MAX_NM: readonly [number, CDIScaleLabel][] = [
    [0.35, CDIScaleLabel.LNav],
    [1.3, CDIScaleLabel.Terminal],
    [2.5, CDIScaleLabel.Enroute],
]

/**
 * Derives the CDI-scaling phase from the sim's generic GPS SimVars — the universal source every
 * navigator populates. It always yields a correct lateral scale, but the sim exposes no RNAV
 * service level, so an active approach is reported as LPV (with glidepath) or LNAV (without).
 */
export function deriveCdiScaleLabelFromSimVars(
    isActiveWaypoint: boolean,
    isApproachActive: boolean,
    hasGlidepath: boolean,
    cdiScalingNm: number
): CDIScaleLabel {
    if (!isActiveWaypoint) {
        return CDIScaleLabel.Enroute
    }

    if (isApproachActive) {
        return hasGlidepath ? CDIScaleLabel.LPV : CDIScaleLabel.LNav
    }

    if (cdiScalingNm <= 0) {
        return CDIScaleLabel.Enroute
    }

    return SCALE_LABEL_BY_MAX_NM.find(([max]) => cdiScalingNm <= max)?.[1] ?? CDIScaleLabel.Oceanic
}

const IFD_CDI_SCALE_LABEL_LVAR = (index: number) => `L:1:WT_IFD_${index}_CDI_SCALE_LABEL`

const IFD_CDI_SCALE_LVAR = (index: number) => `L:1:WT_IFD_${index}_CDI_SCALE`

const IFD_INDICES = [1, 2, 3, 4] as const

/**
 * Reads the RNAV service level from a recognised GTN mod's own LVars, or `null` when none is
 * installed so the caller falls back to the next source.
 */
export function readVendorCdiScaleLabel(): CDIScaleLabel | null {
    for (const index of IFD_INDICES) {
        const scaleNm = SimVar.GetSimVarValue(IFD_CDI_SCALE_LVAR(index), SimVarValueType.NM)
        if (scaleNm <= 0) continue

        const label = SimVar.GetSimVarValue(IFD_CDI_SCALE_LABEL_LVAR(index), SimVarValueType.Number)
        switch (label) {
            case 0:
                return CDIScaleLabel.Oceanic
            case 1:
                return CDIScaleLabel.Enroute
            case 2:
                return CDIScaleLabel.Terminal
            case 3:
                return SimVar.GetSimVarValue('GPS HAS GLIDEPATH', SimVarValueType.Bool) !== 0
                    ? CDIScaleLabel.LPV
                    : CDIScaleLabel.LNav
        }
    }
    return null
}
