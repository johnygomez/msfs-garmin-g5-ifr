import { CDIScaleLabel } from '@microsoft/msfs-garminsdk'
import {
    ConsumerSubject,
    EventBus,
    MappedSubject,
    MappedSubscribable,
    SimVarValueType,
    Subject,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { AltimeterSubjects } from './CommonPFD_MFD'
import { G5CustomEvents } from './G5CustomPublisher'
import { G5NavEvents } from './G5NavPublisher'
import { G5NavdataEvents } from './GpsPhaseSource'
import { VerticalDeviationMode } from './VerticalDeviationIndicator'

export type NavSource = 'GPS' | 'NAV1' | 'NAV2'

export interface CDISubjects {
    cdiSource: Subscribable<number>
    cdiDeviation: Subscribable<number>
    cdiVisible: Subscribable<boolean>
}

interface VerticalGuidance {
    readonly mode: VerticalDeviationMode
    readonly deviation: number
}

const NEEDLE_FULL_SCALE_DEFLECTION = 127

const VNAV_FULL_SCALE_DEVIATION_METERS = 304.8

const NO_GUIDANCE: VerticalGuidance = { mode: 'None', deviation: 0 }

export class NavSourceDataProvider {
    private readonly gpsDrivesNav1: ConsumerSubject<boolean>
    private readonly navSelected: ConsumerSubject<number>
    /** The resolved Garmin GPS CDI-scaling phase label, published by NavdataStack. */
    readonly cdiScaleLabel: ConsumerSubject<CDIScaleLabel>

    private readonly nav1HasNav: ConsumerSubject<boolean>
    private readonly nav2HasNav: ConsumerSubject<boolean>
    private readonly nav1Cdi: ConsumerSubject<number>
    private readonly nav2Cdi: ConsumerSubject<number>
    private readonly gpsWpNextId: ConsumerSubject<string>
    private readonly gpsWpCrossTrack: ConsumerSubject<number>

    readonly activeSource: MappedSubject<[boolean, number], NavSource>
    readonly verticalDeviationMode = Subject.create<VerticalDeviationMode>('None')
    readonly verticalDeviationValue = Subject.create(0)

    private readonly cdiSource: MappedSubscribable<number>
    private readonly cdiDeviation: MappedSubject<[NavSource, number, number, number], number>
    private readonly cdiVisible: MappedSubject<[NavSource, boolean, boolean, string], boolean>

    get cdiSubjects(): CDISubjects {
        return {
            cdiSource: this.cdiSource,
            cdiDeviation: this.cdiDeviation,
            cdiVisible: this.cdiVisible,
        }
    }

    get altimeterSubjects(): AltimeterSubjects {
        return {
            verticalDeviationMode: this.verticalDeviationMode,
            verticalDeviationValue: this.verticalDeviationValue,
        }
    }

    constructor(bus: EventBus) {
        const g5Sub = bus.getSubscriber<G5CustomEvents>()
        this.gpsDrivesNav1 = ConsumerSubject.create(g5Sub.on('gps_drives_nav1'), false)
        this.navSelected = ConsumerSubject.create(g5Sub.on('nav_selected'), 0)

        const navSub = bus.getSubscriber<G5NavEvents>()
        this.nav1HasNav = ConsumerSubject.create(navSub.on('nav1_has_nav'), false)
        this.nav2HasNav = ConsumerSubject.create(navSub.on('nav2_has_nav'), false)
        this.nav1Cdi = ConsumerSubject.create(navSub.on('nav1_cdi'), 0)
        this.nav2Cdi = ConsumerSubject.create(navSub.on('nav2_cdi'), 0)
        this.gpsWpNextId = ConsumerSubject.create(navSub.on('gps_wp_next_id'), '')
        this.gpsWpCrossTrack = ConsumerSubject.create(navSub.on('gps_wp_cross_track'), 0)

        const navdataSub = bus.getSubscriber<G5NavdataEvents>()
        this.cdiScaleLabel = ConsumerSubject.create(
            navdataSub.on('g5_cdi_scale_label'),
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

        this.cdiSource = this.activeSource.map(source =>
            source === 'NAV1' ? 1 : source === 'NAV2' ? 2 : 3
        )

        this.cdiDeviation = MappedSubject.create(
            ([source, nav1Cdi, nav2Cdi, crossTrack]) => {
                switch (source) {
                    case 'NAV1':
                        return nav1Cdi / NEEDLE_FULL_SCALE_DEFLECTION
                    case 'NAV2':
                        return nav2Cdi / NEEDLE_FULL_SCALE_DEFLECTION
                    default:
                        return crossTrack
                }
            },
            this.activeSource,
            this.nav1Cdi,
            this.nav2Cdi,
            this.gpsWpCrossTrack
        )

        this.cdiVisible = MappedSubject.create(
            ([source, nav1HasNav, nav2HasNav, gpsWpId]) => {
                switch (source) {
                    case 'NAV1':
                        return nav1HasNav
                    case 'NAV2':
                        return nav2HasNav
                    default:
                        return gpsWpId !== ''
                }
            },
            this.activeSource,
            this.nav1HasNav,
            this.nav2HasNav,
            this.gpsWpNextId
        )
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
        this.nav1HasNav.destroy()
        this.nav2HasNav.destroy()
        this.nav1Cdi.destroy()
        this.nav2Cdi.destroy()
        this.gpsWpNextId.destroy()
        this.gpsWpCrossTrack.destroy()
        this.cdiSource.destroy()
        this.cdiDeviation.destroy()
        this.cdiVisible.destroy()
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
        return { mode: 'GS', deviation: raw / NEEDLE_FULL_SCALE_DEFLECTION }
    }

    private navRadioIndex(source: NavSource): 1 | 2 {
        return source === 'NAV2' ? 2 : 1
    }
}
