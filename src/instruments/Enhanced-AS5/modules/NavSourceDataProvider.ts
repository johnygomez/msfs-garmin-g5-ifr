import { CDIScaleLabel } from '@microsoft/msfs-garminsdk'
import {
    ConsumerSubject,
    EventBus,
    MappedSubject,
    SimVarValueType,
    Subject,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'
import { G5NavdataEvents } from './GpsPhaseSource'
import { VerticalDeviationMode } from './VerticalDeviationIndicator'

export type NavSource = 'GPS' | 'NAV1' | 'NAV2'

interface VerticalGuidance {
    readonly mode: VerticalDeviationMode
    readonly deviation: number
}

const GSI_FULL_SCALE_DEFLECTION = 127

const VNAV_FULL_SCALE_DEVIATION_METERS = 304.8

const NO_GUIDANCE: VerticalGuidance = { mode: 'None', deviation: 0 }

export class NavSourceDataProvider {
    private readonly gpsDrivesNav1: ConsumerSubject<boolean>
    private readonly navSelected: ConsumerSubject<number>
    /** The resolved Garmin GPS CDI-scaling phase label, published by NavdataStack. */
    readonly cdiScaleLabel: ConsumerSubject<CDIScaleLabel>

    readonly activeSource: MappedSubject<[boolean, number], NavSource>
    readonly verticalDeviationMode = Subject.create<VerticalDeviationMode>('None')
    readonly verticalDeviationValue = Subject.create(0)

    constructor(bus: EventBus) {
        const g5Sub = bus.getSubscriber<G5CustomEvents>()
        this.gpsDrivesNav1 = ConsumerSubject.create(g5Sub.on('gps_drives_nav1'), false)
        this.navSelected = ConsumerSubject.create(g5Sub.on('nav_selected'), 0)

        const navSub = bus.getSubscriber<G5NavdataEvents>()
        this.cdiScaleLabel = ConsumerSubject.create(
            navSub.on('g5_cdi_scale_label'),
            CDIScaleLabel.Enroute
        )

        this.activeSource = MappedSubject.create(
            ([gpsDrives, navSel]) => {
                if (gpsDrives) return 'GPS'
                if (navSel === 1) return 'NAV1'
                if (navSel === 2) return 'NAV2'
                return 'GPS'
            },
            this.gpsDrivesNav1,
            this.navSelected
        ).pause()
    }

    onUpdate(): void {
        const guidance = this.resolveVerticalGuidance(this.activeSource.get())
        this.verticalDeviationMode.set(guidance.mode)
        this.verticalDeviationValue.set(guidance.deviation)
    }

    resume(): void {
        this.activeSource.resume()
    }

    destroy(): void {
        this.gpsDrivesNav1.destroy()
        this.navSelected.destroy()
        this.cdiScaleLabel.destroy()
        this.activeSource.destroy()
    }

    private resolveVerticalGuidance(source: NavSource): VerticalGuidance {
        return this.glideslope(source) ?? this.gpsVerticalGuidance(source) ?? NO_GUIDANCE
    }

    private gpsVerticalGuidance(source: NavSource): VerticalGuidance | null {
        if (source !== 'GPS') return null

        const hasGlidepath = !!SimVar.GetSimVarValue('GPS HAS GLIDEPATH', SimVarValueType.Bool)
        const errorMeters = SimVar.GetSimVarValue('GPS VERTICAL ERROR', SimVarValueType.Meters)
        if (!hasGlidepath && errorMeters === 0) return null

        // GPS GSI SCALING is nonzero only on an approach glidepath; advisory LNAV+V is VNAV.
        const gsiScaling = SimVar.GetSimVarValue('GPS GSI SCALING', SimVarValueType.Meters)
        const isApproachGlidepath = gsiScaling > 0

        const label = this.cdiScaleLabel.get()
        const mode = isApproachGlidepath && label !== CDIScaleLabel.LNavPlusV ? 'GP' : 'VNAV'

        const fullScale = isApproachGlidepath ? gsiScaling : VNAV_FULL_SCALE_DEVIATION_METERS
        return { mode, deviation: errorMeters / fullScale }
    }

    private glideslope(source: NavSource): VerticalGuidance | null {
        if (source !== 'NAV1' && source !== 'NAV2') return null
        const idx = this.navRadioIndex(source)
        if (!SimVar.GetSimVarValue(`NAV HAS GLIDE SLOPE:${idx}`, SimVarValueType.Bool)) return null

        const raw = SimVar.GetSimVarValue(`NAV GSI:${idx}`, SimVarValueType.Number)
        return { mode: 'GS', deviation: raw / GSI_FULL_SCALE_DEFLECTION }
    }

    private navRadioIndex(source: NavSource): 1 | 2 {
        return source === 'NAV2' ? 2 : 1
    }
}
