import { CDIScaleLabel, FmsEvents } from '@microsoft/msfs-garminsdk'
import {
    EventBus,
    EventSubscriber,
    MappedSubject,
    MappedSubscribable,
    Subscribable,
} from '@microsoft/msfs-sdk'

import {
    NavRadioIndex,
    NavSource,
    NavSourceLabel,
    resolveNavCourse,
    resolveNavSourceLabel,
} from '../common/Nav'
import { SubscriptionCollection } from '../common/Reactive'
import { VerticalDeviationMode } from '../common/VerticalDeviationIndicator'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import { G5NavdataEvents } from './GpsPhaseSource'

export interface CDISubjects {
    cdiSource: Subscribable<number>
    cdiDeviation: Subscribable<number>
    cdiVisible: Subscribable<boolean>
}

/**
 * Vertical-deviation guidance shown beside the altimeter. Altitude/baro/vertical-speed
 * are consumed directly from the EventBus by `AltimeterComponent`; only the vertical
 * deviation is threaded through as props.
 */
export interface AltimeterSubjects {
    verticalDeviationMode: Subscribable<VerticalDeviationMode>
    verticalDeviationValue: Subscribable<number>
}

interface VerticalGuidance {
    readonly mode: VerticalDeviationMode
    readonly deviation: number
}

const NEEDLE_FULL_SCALE_DEFLECTION = 127

const VNAV_FULL_SCALE_DEVIATION_METERS = 304.8

const NO_GUIDANCE: VerticalGuidance = { mode: 'None', deviation: 0 }

/** Published while the selected source has no course to show. */
const NO_COURSE = NaN

export class NavSourceDataProvider {
    private readonly subscriptions = new SubscriptionCollection()

    readonly activeSource: MappedSubscribable<NavSource>
    readonly navSourceLabel: MappedSubscribable<NavSourceLabel>
    /** Course selected on the active nav source, or `NaN` while that source is not receivable. */
    readonly selectedCourse: MappedSubscribable<number>
    readonly verticalDeviationMode: MappedSubscribable<VerticalDeviationMode>
    readonly verticalDeviationValue: MappedSubscribable<number>

    private readonly cdiSource: MappedSubscribable<number>
    private readonly cdiDeviation: MappedSubscribable<number>
    private readonly cdiVisible: MappedSubscribable<boolean>

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
        const subs = this.subscriptions
        const g5 = bus.getSubscriber<G5CustomEvents>()
        const nav = bus.getSubscriber<G5NavEvents>()

        const gpsDrivesNav1 = subs.consume(g5.on('gps_drives_nav1'), false)
        const navSelected = subs.consume(g5.on('nav_selected'), 0)

        const apprHold = subs.consume(nav.on('ap_appr_hold'), false)
        const approachType = subs.consume(nav.on('ap_approach_type'), 0)
        const cdiNeedleValid = subs.consume(nav.on('hsi_cdi_needle_valid'), false)
        const nav1HasNav = subs.consume(nav.on('nav1_has_nav'), false)
        const nav2HasNav = subs.consume(nav.on('nav2_has_nav'), false)
        const nav1Cdi = subs.consume(nav.on('nav1_cdi'), 0)
        const nav2Cdi = subs.consume(nav.on('nav2_cdi'), 0)
        const gpsWpNextId = subs.consume(nav.on('gps_wp_next_id'), '')
        const gpsWpCrossTrack = subs.consume(nav.on('gps_wp_cross_track'), 0)
        const gpsHasGlidepath = subs.consume(nav.on('gps_has_glidepath'), false)
        const gpsVerticalError = subs.consume(nav.on('gps_vertical_error'), 0)
        const gpsGsiScaling = subs.consume(nav.on('gps_gsi_scaling'), 0)
        const nav1HasGlideslope = subs.consume(nav.on('nav1_has_glideslope'), false)
        const nav2HasGlideslope = subs.consume(nav.on('nav2_has_glideslope'), false)
        const nav1Gsi = subs.consume(nav.on('nav1_gsi'), 0)
        const nav2Gsi = subs.consume(nav.on('nav2_gsi'), 0)
        const tacanDriven = subs.consume(nav.on('tacan_drives_nav1'), false)
        const nav1HasLoc = subs.consume(nav.on('nav1_has_loc'), false)
        const nav2HasLoc = subs.consume(nav.on('nav2_has_loc'), false)

        const approachSupportsGp = subs.consume(
            bus.getSubscriber<FmsEvents>().on('approach_supports_gp'),
            false
        )

        // The resolved Garmin GPS CDI-scaling phase label, published by NavdataStack.
        const cdiScaleLabel = subs.consume(
            bus.getSubscriber<G5NavdataEvents>().on('g5_cdi_scale_label'),
            CDIScaleLabel.Enroute
        )

        this.activeSource = subs.track(
            MappedSubject.create(
                ([gpsDrives, apprActive, apprType, navSel]) => {
                    const navCoupled =
                        !gpsDrives || (apprActive && apprType !== ApproachType.APPROACH_TYPE_RNAV)
                    if (navCoupled && navSel !== 0) {
                        if (navSel === 1) return NavSource.Nav1
                        if (navSel === 2) return NavSource.Nav2
                    }
                    return NavSource.GPS
                },
                gpsDrivesNav1,
                apprHold,
                approachType,
                navSelected
            )
        )

        this.navSourceLabel = subs.track(
            MappedSubject.create(
                params => resolveNavSourceLabel(...params),
                this.activeSource,
                tacanDriven,
                nav1HasLoc,
                nav2HasLoc
            )
        )

        this.selectedCourse = subs.track(
            MappedSubject.create(
                ([source, hasNav1, hasNav2, course1, course2]) => {
                    switch (source) {
                        case NavSource.Nav1:
                            return hasNav1 ? course1 : NO_COURSE
                        case NavSource.Nav2:
                            return hasNav2 ? course2 : NO_COURSE
                        default:
                            return NO_COURSE
                    }
                },
                this.activeSource,
                nav1HasNav,
                nav2HasNav,
                this.navCourse(nav, 1, tacanDriven, nav1HasLoc),
                this.navCourse(nav, 2, tacanDriven, nav2HasLoc)
            )
        )

        this.cdiSource = subs.track(
            this.activeSource.map(source =>
                source === NavSource.Nav1 ? 1 : source === NavSource.Nav2 ? 2 : 3
            )
        )

        this.cdiDeviation = subs.track(
            MappedSubject.create(
                ([source, cdi1, cdi2, crossTrack]) => {
                    switch (source) {
                        case NavSource.Nav1:
                            return cdi1 / NEEDLE_FULL_SCALE_DEFLECTION
                        case NavSource.Nav2:
                            return cdi2 / NEEDLE_FULL_SCALE_DEFLECTION
                        default:
                            return crossTrack
                    }
                },
                this.activeSource,
                nav1Cdi,
                nav2Cdi,
                gpsWpCrossTrack
            )
        )

        this.cdiVisible = subs.track(
            MappedSubject.create(
                ([source, hasNav1, hasNav2, gpsWpId, needleValid]) => {
                    switch (source) {
                        case NavSource.Nav1:
                            return hasNav1
                        case NavSource.Nav2:
                            return hasNav2
                        case NavSource.GPS:
                            return needleValid
                        default:
                            return gpsWpId !== ''
                    }
                },
                this.activeSource,
                nav1HasNav,
                nav2HasNav,
                gpsWpNextId,
                cdiNeedleValid
            )
        )

        const verticalGuidance = subs.track(
            MappedSubject.create(
                ([
                    source,
                    scaleLabel,
                    hasGlidepath,
                    verticalError,
                    gsiScaling,
                    nav1HasGs,
                    nav2HasGs,
                    gsi1,
                    gsi2,
                    approachSupportsGp,
                ]): VerticalGuidance => {
                    if (source === NavSource.GPS) {
                        if (!hasGlidepath && !approachSupportsGp) return NO_GUIDANCE
                        const isApproach = gsiScaling > 0 && scaleLabel !== CDIScaleLabel.LNavPlusV
                        const fullScale = isApproach ? gsiScaling : VNAV_FULL_SCALE_DEVIATION_METERS
                        return {
                            mode: isApproach ? 'GP' : 'VNAV',
                            deviation: verticalError / fullScale,
                        }
                    }
                    if (source === NavSource.Nav1 && nav1HasGs) {
                        return { mode: 'GS', deviation: gsi1 / NEEDLE_FULL_SCALE_DEFLECTION }
                    }
                    if (source === NavSource.Nav2 && nav2HasGs) {
                        return { mode: 'GS', deviation: gsi2 / NEEDLE_FULL_SCALE_DEFLECTION }
                    }
                    return NO_GUIDANCE
                },
                this.activeSource,
                cdiScaleLabel,
                gpsHasGlidepath,
                gpsVerticalError,
                gpsGsiScaling,
                nav1HasGlideslope,
                nav2HasGlideslope,
                nav1Gsi,
                nav2Gsi,
                approachSupportsGp
            )
        )

        this.verticalDeviationMode = subs.track(verticalGuidance.map(guidance => guidance.mode))
        this.verticalDeviationValue = subs.track(
            verticalGuidance.map(guidance => guidance.deviation)
        )
    }

    resume(): void {
        this.subscriptions.resume()
    }

    destroy(): void {
        this.subscriptions.destroy()
    }

    private navCourse(
        nav: EventSubscriber<G5NavEvents>,
        index: NavRadioIndex,
        tacanDriven: Subscribable<boolean>,
        hasLoc: Subscribable<boolean>
    ): MappedSubscribable<number> {
        const subs = this.subscriptions
        return subs.track(
            MappedSubject.create(
                params => resolveNavCourse(...params),
                tacanDriven,
                hasLoc,
                subs.consume(nav.on(`nav${index}_localizer`), 0),
                subs.consume(nav.on(`nav${index}_obs`), 0),
                subs.consume(nav.on(`nav${index}_tacan_obs`), 0)
            )
        )
    }
}
