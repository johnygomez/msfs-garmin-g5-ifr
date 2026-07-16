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
export function deriveCdiScaleLabelFromSimVars(): CDIScaleLabel {
    if (!SimVar.GetSimVarValue('GPS IS ACTIVE WAY POINT', SimVarValueType.Bool)) {
        return CDIScaleLabel.Enroute
    }

    if (SimVar.GetSimVarValue('GPS IS APPROACH ACTIVE', SimVarValueType.Bool)) {
        return SimVar.GetSimVarValue('GPS HAS GLIDEPATH', SimVarValueType.Bool)
            ? CDIScaleLabel.LPV
            : CDIScaleLabel.LNav
    }

    const scaleNm = SimVar.GetSimVarValue('GPS CDI SCALING', SimVarValueType.NM)
    return SCALE_LABEL_BY_MAX_NM.find(([max]) => scaleNm <= max)?.[1] ?? CDIScaleLabel.Oceanic
}

/**
 * Reads the RNAV service level from a recognised GTN mod's own LVars, or `null` when none is
 * installed so the caller falls back to the next source. Vendor mappings are added here once
 * verified in-sim.
 */
export function readVendorCdiScaleLabel(): CDIScaleLabel | null {
    return null
}
