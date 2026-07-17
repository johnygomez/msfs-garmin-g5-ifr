import { CDIScaleLabel } from '@microsoft/msfs-garminsdk'
import {
    ConsumerSubject,
    EventBus,
    MappedSubject,
    MappedSubscribable,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { VerticalDeviationMode } from '../common/VerticalDeviationIndicator'
import { AltimeterSubjects } from '../pfd/AltimeterKnob'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import { G5NavdataEvents } from './GpsPhaseSource'

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

    private readonly gpsHasGlidepath: ConsumerSubject<boolean>
    private readonly gpsVerticalError: ConsumerSubject<number>
    private readonly gpsGsiScaling: ConsumerSubject<number>
    private readonly nav1HasGlideslope: ConsumerSubject<boolean>
    private readonly nav2HasGlideslope: ConsumerSubject<boolean>
    private readonly nav1Gsi: ConsumerSubject<number>
    private readonly nav2Gsi: ConsumerSubject<number>

    readonly activeSource: MappedSubject<[boolean, number], NavSource>
    readonly verticalDeviationMode: MappedSubscribable<VerticalDeviationMode>
    readonly verticalDeviationValue: MappedSubscribable<number>

    private readonly cdiSource: MappedSubscribable<number>
    private readonly cdiDeviation: MappedSubject<[NavSource, number, number, number], number>
    private readonly cdiVisible: MappedSubject<[NavSource, boolean, boolean, string], boolean>
    private readonly verticalGuidance: MappedSubject<any, VerticalGuidance>

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
        this.gpsHasGlidepath = ConsumerSubject.create(navSub.on('gps_has_glidepath'), false)
        this.gpsVerticalError = ConsumerSubject.create(navSub.on('gps_vertical_error'), 0)
        this.gpsGsiScaling = ConsumerSubject.create(navSub.on('gps_gsi_scaling'), 0)
        this.nav1HasGlideslope = ConsumerSubject.create(navSub.on('nav1_has_glideslope'), false)
        this.nav2HasGlideslope = ConsumerSubject.create(navSub.on('nav2_has_glideslope'), false)
        this.nav1Gsi = ConsumerSubject.create(navSub.on('nav1_gsi'), 0)
        this.nav2Gsi = ConsumerSubject.create(navSub.on('nav2_gsi'), 0)

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

        this.verticalGuidance = MappedSubject.create(
            ([
                source,
                scaleLabel,
                hasGlidepath,
                verticalError,
                gsiScaling,
                nav1HasGS,
                nav2HasGS,
                nav1Gsi,
                nav2Gsi,
            ]) => {
                if (source === 'GPS') {
                    if (!hasGlidepath && verticalError === 0) return NO_GUIDANCE
                    const isApproach = gsiScaling > 0 && scaleLabel !== CDIScaleLabel.LNavPlusV
                    const mode: VerticalDeviationMode = isApproach ? 'GP' : 'VNAV'
                    const fullScale = isApproach ? gsiScaling : VNAV_FULL_SCALE_DEVIATION_METERS
                    return {
                        mode,
                        deviation: verticalError / fullScale,
                    }
                }
                if (source === 'NAV1' && nav1HasGS) {
                    return {
                        mode: 'GS' as const,
                        deviation: nav1Gsi / NEEDLE_FULL_SCALE_DEFLECTION,
                    }
                }
                if (source === 'NAV2' && nav2HasGS) {
                    return {
                        mode: 'GS' as const,
                        deviation: nav2Gsi / NEEDLE_FULL_SCALE_DEFLECTION,
                    }
                }
                return NO_GUIDANCE
            },
            this.activeSource,
            this.cdiScaleLabel,
            this.gpsHasGlidepath,
            this.gpsVerticalError,
            this.gpsGsiScaling,
            this.nav1HasGlideslope,
            this.nav2HasGlideslope,
            this.nav1Gsi,
            this.nav2Gsi
        ).pause()

        this.verticalDeviationMode = this.verticalGuidance.map(g => g.mode)
        this.verticalDeviationValue = this.verticalGuidance.map(g => g.deviation)
    }

    resume(): void {
        this.activeSource.resume()
        this.verticalGuidance.resume()
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
        this.gpsHasGlidepath.destroy()
        this.gpsVerticalError.destroy()
        this.gpsGsiScaling.destroy()
        this.nav1HasGlideslope.destroy()
        this.nav2HasGlideslope.destroy()
        this.nav1Gsi.destroy()
        this.nav2Gsi.destroy()
        this.cdiSource.destroy()
        this.cdiDeviation.destroy()
        this.cdiVisible.destroy()
        this.activeSource.destroy()
        this.verticalGuidance.destroy()
    }
}
