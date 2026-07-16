import { CDIScaleLabel, CdiScaleFormatter } from '@microsoft/msfs-garminsdk'
import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    Subject,
    MappedSubject,
    ConsumerSubject,
    Subscription,
    EventBus,
    AhrsEvents,
} from '@microsoft/msfs-sdk'
import { SimVarValueType } from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'
import { G5NavEvents } from './G5NavPublisher'
import { G5NavdataEvents } from './GpsPhaseSource'

export enum HSIndicatorDisplayType {
    GlassCockpit = 0,
    HUD = 1,
    HUD_Simplified = 2,
}

export interface HSIComponentProps extends ComponentProps {
    bus: EventBus
    noCenterText: boolean
    noBackground: boolean
    noAffectSimRadioNav: boolean
    displayStyle: HSIndicatorDisplayType
    onApi?: (instance: HSIComponent) => void
    /** External SVG element for GSI chevron bug (NAV1). */
    chevronBug2?: SVGElement
    /** External SVG element for GSI diamond bug. */
    diamondBug2?: SVGElement
    /** External SVG element for GSI hollow diamond bug (NAV1/NAV2). */
    hollowDiamondBug2?: SVGElement
    heading?: Subject<number>
}

export class HSIComponent extends DisplayComponent<HSIComponentProps> {
    // ---- Refs (only needed for programmatic access from outside) ----
    private readonly rootRef = FSComponent.createRef<SVGSVGElement>()
    private readonly rotatingRoseRef = FSComponent.createRef<SVGGElement>()

    // ---- ConsumerSubjects: auto-updating values from the EventBus ----
    private readonly magneticHeading: ConsumerSubject<number>
    private readonly apHeadingBug: ConsumerSubject<number>
    private readonly trackAngleDeg: ConsumerSubject<number>

    private readonly gpsActiveWaypoint: ConsumerSubject<boolean>
    private readonly gpsWpDesiredTrack: ConsumerSubject<number>
    private readonly gpsWpCrossTrack: ConsumerSubject<number>
    private readonly gpsCdiScaling: ConsumerSubject<number>
    private readonly hsiCdiNeedle: ConsumerSubject<number>
    private readonly hsiCdiNeedleValid: ConsumerSubject<boolean>
    private readonly hsiGsiNeedle: ConsumerSubject<number>
    private readonly navSelected: ConsumerSubject<number>
    private readonly nav1Gsi: ConsumerSubject<number>
    private readonly nav2Gsi: ConsumerSubject<number>

    // ---- Internal state Subjects (set by update() / onEvent()) ----
    private readonly navSource = Subject.create('GPS')
    private readonly displayedCourse = Subject.create(0)
    private readonly cdiNeedleVisible = Subject.create(false)
    private readonly toFromState = Subject.create(0) // 0=none, 1=to, 2=from
    private readonly toVisible = Subject.create('none')
    private readonly fromVisible = Subject.create('none')
    private readonly flightPhaseText = Subject.create('ENR')
    private readonly flightPhaseVisible = Subject.create('visible')
    private readonly xtkVisible = Subject.create('hidden')
    private readonly xtkText = Subject.create('XTK 0.00NM')
    private readonly hsiCdiNeedlePos = Subject.create(0)
    private readonly gsiNeedlePos = Subject.create(0)
    private readonly hollowDiamondPos = Subject.create(0)

    // Bearing 1
    private readonly bearing1Angle = Subject.create(NaN)
    private readonly bearing1Vis = Subject.create('hidden')
    private readonly bearing1Source = Subject.create('')
    private readonly bearing1Ident = Subject.create('')
    private readonly bearing1Dist = Subject.create('')

    // Bearing 2
    private readonly bearing2Angle = Subject.create(NaN)
    private readonly bearing2Vis = Subject.create('hidden')
    private readonly bearing2Source = Subject.create('')
    private readonly bearing2Ident = Subject.create('')
    private readonly bearing2Dist = Subject.create('')

    // DME
    private readonly dmeVisible = Subject.create('none')
    private readonly dmeSourceDisplay = Subject.create('NAV1')
    private readonly dmeIdentDisplay = Subject.create('')
    private readonly dmeDistDisplay = Subject.create('')

    // Inner circle (derived)
    private readonly innerCircleVisible = Subject.create('none')

    // ---- MappedSubjects: declarative bindings for JSX attributes ----
    // Initialized in constructor after ConsumerSubjects are created.

    private readonly roseTransform: MappedSubject<[number], string>
    private readonly headingBugTransform: MappedSubject<[number], string>
    private readonly headingValueText: MappedSubject<[number], string>
    private readonly bearingTextValue: MappedSubject<[number], string>
    private readonly courseGroupTransform: MappedSubject<[number], string>
    private readonly courseValueText: MappedSubject<[number], string>
    private readonly cdiTransform: MappedSubject<[number], string>
    private readonly cdiDisplay: MappedSubject<[boolean], string>
    private readonly trackTransform: MappedSubject<[number], string>
    private readonly navFill: MappedSubject<[string], string>
    private readonly navFillOpacity: MappedSubject<[string], string>
    private readonly navStroke: MappedSubject<[string], string>
    private readonly bearing1Transform: MappedSubject<[number], string>
    private readonly bearing2Transform: MappedSubject<[number], string>

    // ---- Legacy public fields (kept for external code compatibility) ----
    chevronBug2: any
    diamondBug2: any
    hollowDiamondBug2: any

    crosstrackFullError = 2
    isDmeDisplayed = false
    isBearing1Displayed = false
    isBearing2Displayed = false
    crossTrackCurrent = 0
    crossTrackGoal = 0
    sourceIsGps = true
    curDeviation = 0

    private readonly cdiScaleLabel: ConsumerSubject<CDIScaleLabel>
    private readonly formatPhase = CdiScaleFormatter.create(false)

    // Private state-machine variables
    private logic_dmeSource = 1
    private logic_cdiSource = 3
    private logic_brg1Source = 0
    private logic_brg2Source = 0
    private logic_navSelected = 0
    private _lastAPPRHold = false

    // GPS outlier-filtering frame buffers
    private gpsNextWpIdValidFrames: any[] = []
    private gpsNextWpDesiredTrkFrames: any[] = []
    private gpsNextWpXTrkFrames: any[] = []
    private gpsNextWpIdValid = false

    // Subscriptions bag
    private readonly subs: Subscription[] = []

    // ---- Constructor ----
    constructor(props: HSIComponentProps) {
        super(props)

        // Wire ConsumerSubjects to the event bus
        const sub = props.bus.getSubscriber<AhrsEvents & G5CustomEvents & G5NavEvents>()
        this.magneticHeading = ConsumerSubject.create(sub.on('actual_hdg_deg').withPrecision(1), 0)
        this.apHeadingBug = ConsumerSubject.create(
            sub.on('ap_heading_selected').withPrecision(1),
            0
        )
        this.trackAngleDeg = ConsumerSubject.create(
            sub.on('track_angle_magnetic').withPrecision(1),
            0
        )

        this.gpsActiveWaypoint = ConsumerSubject.create(sub.on('gps_active_waypoint'), false)
        this.gpsWpDesiredTrack = ConsumerSubject.create(sub.on('gps_wp_desired_track'), 0)
        this.gpsWpCrossTrack = ConsumerSubject.create(sub.on('gps_wp_cross_track'), 0)
        this.gpsCdiScaling = ConsumerSubject.create(sub.on('gps_cdi_scaling'), 0)
        this.hsiCdiNeedle = ConsumerSubject.create(sub.on('hsi_cdi_needle'), 0)
        this.hsiCdiNeedleValid = ConsumerSubject.create(sub.on('hsi_cdi_needle_valid'), false)
        this.hsiGsiNeedle = ConsumerSubject.create(sub.on('hsi_gsi_needle'), 0)
        this.navSelected = ConsumerSubject.create(sub.on('nav_selected'), 0)
        this.nav1Gsi = ConsumerSubject.create(sub.on('nav1_gsi'), 0)
        this.nav2Gsi = ConsumerSubject.create(sub.on('nav2_gsi'), 0)

        const navSub = props.bus.getSubscriber<G5NavdataEvents>()
        this.cdiScaleLabel = ConsumerSubject.create(
            navSub.on('g5_cdi_scale_label'),
            CDIScaleLabel.Enroute
        )

        // Copy external bug references
        this.chevronBug2 = props.chevronBug2 || null
        this.diamondBug2 = props.diamondBug2 || null
        this.hollowDiamondBug2 = props.hollowDiamondBug2 || null

        // ---- Initialize MappedSubjects (after ConsumerSubjects are created) ----
        this.roseTransform = MappedSubject.create(
            ([hdg]) => `rotate(${-hdg}, 50, 50)`,
            this.magneticHeading
        )
        // Use the parent-provided Subject prop — it is set every frame by
        // AS5_MFD_HSI.onUpdate() and is more reliable than the bus ConsumerSubject.
        const headingSource = props.heading ?? this.apHeadingBug
        this.headingBugTransform = MappedSubject.create(
            ([hdg]) => `rotate(${hdg}, 50, 50)`,
            headingSource
        )
        this.headingValueText = MappedSubject.create(([hdg]) => {
            const h = Math.round(hdg)
            const val = h === 0 ? 360 : h
            const s = String(val)
            return '000'.slice(s.length) + s + '°'
        }, headingSource)
        this.bearingTextValue = MappedSubject.create(([hdg]) => {
            const h = Math.round(hdg)
            const val = h === 0 ? 360 : h
            const s = String(val)
            return '000'.slice(s.length) + s + '°'
        }, this.magneticHeading)
        this.courseGroupTransform = MappedSubject.create(
            ([crs]) => `rotate(${crs}, 50, 50)`,
            this.displayedCourse
        )
        this.courseValueText = MappedSubject.create(([crs]) => {
            const c = Math.round(crs)
            const val = c === 0 ? 360 : c
            const s = String(val)
            return '000'.slice(s.length) + s + '°'
        }, this.displayedCourse)
        this.cdiTransform = MappedSubject.create(
            ([px]) => `translate(${px}, 0)`,
            this.hsiCdiNeedlePos
        )
        this.cdiDisplay = MappedSubject.create(
            ([vis]) => (vis ? '' : 'none'),
            this.cdiNeedleVisible
        )
        this.trackTransform = MappedSubject.create(
            ([trk]) => `rotate(${trk}, 50, 50)`,
            this.trackAngleDeg
        )
        this.navFill = MappedSubject.create(
            ([src]) => (src === 'GPS' ? 'magenta' : 'lime'),
            this.navSource
        )
        this.navFillOpacity = MappedSubject.create(
            ([src]) => (src.endsWith('2') ? '0' : '1'),
            this.navSource
        )
        this.navStroke = MappedSubject.create(
            ([src]) => (src.endsWith('2') ? 'lime' : ''),
            this.navSource
        )
        this.bearing1Transform = MappedSubject.create(
            ([ang]) => `rotate(${ang}, 50, 50)`,
            this.bearing1Angle
        )
        this.bearing2Transform = MappedSubject.create(
            ([ang]) => `rotate(${ang}, 50, 50)`,
            this.bearing2Angle
        )

        // ---- Reactively update external bug transforms ----
        this.subs.push(
            this.gsiNeedlePos.sub(pos => {
                if (this.chevronBug2) {
                    this.chevronBug2.setAttribute('transform', `translate(0, ${pos})`)
                }
                if (this.diamondBug2) {
                    this.diamondBug2.setAttribute('transform', `translate(0, ${pos})`)
                }
            }, true)
        )
        this.subs.push(
            this.hollowDiamondPos.sub(pos => {
                if (this.hollowDiamondBug2) {
                    this.hollowDiamondBug2.setAttribute('transform', `translate(0, ${pos})`)
                }
            }, true)
        )

        // ---- Derived visibility Subjects ----
        // Inner circle visible when either bearing is shown
        this.subs.push(this.bearing1Vis.sub(_ => this.updateInnerCircle()))
        this.subs.push(this.bearing2Vis.sub(_ => this.updateInnerCircle()))
    }

    // ---- Lifecycle ----
    onAfterRender(): void {
        if (this.props.onApi) {
            this.props.onApi(this)
        }
    }

    destroy(): void {
        this.subs.forEach(s => s.destroy())
        this.magneticHeading.destroy()
        this.apHeadingBug.destroy()
        this.trackAngleDeg.destroy()
        this.gpsActiveWaypoint.destroy()
        this.gpsWpDesiredTrack.destroy()
        this.gpsWpCrossTrack.destroy()
        this.gpsCdiScaling.destroy()
        this.hsiCdiNeedle.destroy()
        this.hsiCdiNeedleValid.destroy()
        this.hsiGsiNeedle.destroy()
        this.navSelected.destroy()
        this.nav1Gsi.destroy()
        this.nav2Gsi.destroy()
        this.cdiScaleLabel.destroy()
        super.destroy()
    }

    init() {
        this.logic_brg1Source = SimVar.GetSimVarValue('L:PFD_BRG1_Source', SimVarValueType.Number)
        this.logic_brg2Source = SimVar.GetSimVarValue('L:PFD_BRG2_Source', SimVarValueType.Number)
        if (this.logic_brg1Source != 0) {
            this.bearing1Vis.set('visible')
            this.isBearing1Displayed = true
        }
        if (this.logic_brg2Source != 0) {
            this.bearing2Vis.set('visible')
            this.isBearing2Displayed = true
        }
        this.updateInnerCircle()
    }

    onExit() {}

    // ---- Event handling ----
    onEvent(_event: any) {
        switch (_event) {
            case 'CRS_INC':
                if (!this.props.noAffectSimRadioNav) {
                    if (this.logic_cdiSource == 1) {
                        SimVar.SetSimVarValue('K:VOR1_OBI_INC', SimVarValueType.Number, 0)
                    } else if (this.logic_cdiSource == 2) {
                        SimVar.SetSimVarValue('K:VOR2_OBI_INC', SimVarValueType.Number, 0)
                    } else if (SimVar.GetSimVarValue('GPS OBS ACTIVE', SimVarValueType.Bool)) {
                        SimVar.SetSimVarValue('K:GPS_OBS_INC', SimVarValueType.Number, 0)
                    }
                }
                break
            case 'CRS_DEC':
                if (!this.props.noAffectSimRadioNav) {
                    if (this.logic_cdiSource == 1) {
                        SimVar.SetSimVarValue('K:VOR1_OBI_DEC', SimVarValueType.Number, 0)
                    } else if (this.logic_cdiSource == 2) {
                        SimVar.SetSimVarValue('K:VOR2_OBI_DEC', SimVarValueType.Number, 0)
                    } else if (SimVar.GetSimVarValue('GPS OBS ACTIVE', SimVarValueType.Bool)) {
                        SimVar.SetSimVarValue('K:GPS_OBS_DEC', SimVarValueType.Number, 0)
                    }
                }
                break
            case 'CRS_PUSH':
                if (!this.props.noAffectSimRadioNav) {
                    if (this.logic_cdiSource == 1) {
                        SimVar.SetSimVarValue(
                            'K:VOR1_SET',
                            SimVarValueType.Number,
                            (180 + SimVar.GetSimVarValue('NAV RADIAL:1', SimVarValueType.Degree)) %
                                360
                        )
                    } else if (this.logic_cdiSource == 2) {
                        SimVar.SetSimVarValue(
                            'K:VOR2_SET',
                            SimVarValueType.Number,
                            (180 + SimVar.GetSimVarValue('NAV RADIAL:2', SimVarValueType.Degree)) %
                                360
                        )
                    }
                }
                break
            case 'SoftKeys_PFD_DME':
                this.isDmeDisplayed = !this.isDmeDisplayed
                if (!this.props.noAffectSimRadioNav) {
                    SimVar.SetSimVarValue(
                        'L:PFD_DME_Displayed',
                        SimVarValueType.Number,
                        this.isDmeDisplayed ? 1 : 0
                    )
                }
                this.dmeVisible.set(this.isDmeDisplayed ? 'inherit' : 'none')
                break
            case 'SoftKeys_PFD_BRG1':
            case 'BRG1Switch':
                this.logic_brg1Source =
                    (SimVar.GetSimVarValue('L:PFD_BRG1_Source', SimVarValueType.Number) + 1) % 5
                if (!this.props.noAffectSimRadioNav) {
                    SimVar.SetSimVarValue(
                        'L:PFD_BRG1_Source',
                        SimVarValueType.Number,
                        this.logic_brg1Source
                    )
                }
                this.isBearing1Displayed = this.logic_brg1Source != 0
                this.bearing1Vis.set(this.isBearing1Displayed ? 'visible' : 'hidden')
                this.updateInnerCircle()
                break
            case 'SoftKeys_PFD_BRG2':
            case 'BRG2Switch':
                this.logic_brg2Source =
                    (SimVar.GetSimVarValue('L:PFD_BRG2_Source', SimVarValueType.Number) + 1) % 5
                if (!this.props.noAffectSimRadioNav) {
                    SimVar.SetSimVarValue(
                        'L:PFD_BRG2_Source',
                        SimVarValueType.Number,
                        this.logic_brg2Source
                    )
                }
                this.isBearing2Displayed = this.logic_brg2Source != 0
                this.bearing2Vis.set(this.isBearing2Displayed ? 'visible' : 'hidden')
                this.updateInnerCircle()
                break
            case 'SoftKey_CDI':
            case 'NavSourceSwitch':
                this.logic_cdiSource = (this.logic_cdiSource % 3) + 1
                const isGPSDrived = SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)
                if (
                    this.logic_cdiSource == 2 &&
                    !SimVar.GetSimVarValue('NAV AVAILABLE:2', SimVarValueType.Bool)
                ) {
                    this.logic_cdiSource = 3
                }
                if (!this.props.noAffectSimRadioNav) {
                    if ((this.logic_cdiSource == 3) != isGPSDrived) {
                        SimVar.SetSimVarValue('K:TOGGLE_GPS_DRIVES_NAV1', SimVarValueType.Bool, 0)
                    }
                    if (this.logic_cdiSource != 3) {
                        ;(Simplane as any).setAutoPilotSelectedNav(this.logic_cdiSource)
                    }
                }
                break
        }
    }

    // ---- Per-frame update: read SimVars, push into reactive Subjects ----
    update(_deltaTime: number) {
        // ----- CDI source resolution -----
        this.logic_cdiSource = 3
        const isGPSDriven = SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)
        const apprHold = Simplane.getAutoPilotAPPRHold()
        const approachType = Simplane.getAutoPilotApproachType()

        if (
            !this.props.noAffectSimRadioNav &&
            apprHold &&
            approachType != ApproachType.APPROACH_TYPE_RNAV &&
            apprHold != this._lastAPPRHold
        ) {
            if (isGPSDriven) {
                SimVar.SetSimVarValue('K:TOGGLE_GPS_DRIVES_NAV1', SimVarValueType.Bool, 0)
            }
        }
        this._lastAPPRHold = apprHold

        if (!isGPSDriven || (apprHold && approachType != ApproachType.APPROACH_TYPE_RNAV)) {
            this.logic_navSelected = Simplane.getAutoPilotSelectedNav()
            if (this.logic_navSelected !== 0) {
                this.logic_cdiSource = ((this.logic_navSelected - 1) % 2) + 1
            }
        }

        // HUD styles: read bearing sources every frame
        if (
            this.props.displayStyle === HSIndicatorDisplayType.HUD ||
            this.props.displayStyle === HSIndicatorDisplayType.HUD_Simplified
        ) {
            this.logic_brg1Source = SimVar.GetSimVarValue(
                'L:PFD_BRG1_Source',
                SimVarValueType.Number
            )
            this.isBearing1Displayed = this.logic_brg1Source != 0
            this.bearing1Vis.set(this.isBearing1Displayed ? 'visible' : 'hidden')

            this.logic_brg2Source = SimVar.GetSimVarValue(
                'L:PFD_BRG2_Source',
                SimVarValueType.Number
            )
            this.isBearing2Displayed = this.logic_brg2Source != 0
            this.bearing2Vis.set(this.isBearing2Displayed ? 'visible' : 'hidden')
        }
        this.updateInnerCircle()

        // ----- CDI display logic (per nav source) -----
        switch (this.logic_cdiSource) {
            case 1:
                this.updateNavCDI(1)
                this.updateHSIDeviation()
                break
            case 2:
                this.updateNavCDI(2)
                break
            case 3:
                this.updateGPSCDI()
                break
        }

        // ----- Bearing 1 -----
        this.logic_brg1Source = SimVar.GetSimVarValue('L:PFD_BRG1_Source', SimVarValueType.Number)
        this.updateBearing(
            1,
            this.logic_brg1Source,
            this.bearing1Source,
            this.bearing1Ident,
            this.bearing1Dist,
            this.bearing1Angle
        )

        // ----- Bearing 2 -----
        this.logic_brg2Source = SimVar.GetSimVarValue('L:PFD_BRG2_Source', SimVarValueType.Number)
        this.updateBearing(
            2,
            this.logic_brg2Source,
            this.bearing2Source,
            this.bearing2Ident,
            this.bearing2Dist,
            this.bearing2Angle
        )

        // ----- DME -----
        this.logic_dmeSource = SimVar.GetSimVarValue(
            'L:Glasscockpit_DmeSource',
            SimVarValueType.Number
        )
        if (this.logic_dmeSource === 0) {
            SimVar.SetSimVarValue('L:Glasscockpit_DmeSource', SimVarValueType.Number, 1)
            this.logic_dmeSource = 1
        }
        if (this.logic_dmeSource == 1 || this.logic_dmeSource == 2) {
            this.dmeSourceDisplay.set('NAV' + this.logic_dmeSource)
            if (
                Simplane.getNavSignal(this.logic_dmeSource) > 0 &&
                Simplane.getNavHasDme(this.logic_dmeSource)
            ) {
                this.dmeIdentDisplay.set(
                    fastToFixed(Simplane.getNavActFreq(this.logic_dmeSource), 2)
                )
                const dmeDist = Simplane.getNavDme(this.logic_dmeSource)
                this.dmeDistDisplay.set(isNaN(dmeDist) ? '' : String(dmeDist))
            } else {
                this.dmeIdentDisplay.set('')
                this.dmeDistDisplay.set('')
            }
        }

        // ----- CDI needle interpolation (smooth animation) -----
        const diff = this.crossTrackGoal - this.crossTrackCurrent
        let toAdd = (_deltaTime / 1000) * diff * 7.5
        if (Math.abs(toAdd) < 0.75) {
            toAdd = toAdd > 0 ? 0.75 : -0.75
        }
        if (Math.abs(diff) < 0.1 || Math.abs(toAdd) > Math.abs(diff)) {
            this.crossTrackCurrent = this.crossTrackGoal
        } else {
            this.crossTrackCurrent += toAdd
        }
    }

    // ========================================================================
    //  Internal helper methods
    // ========================================================================

    /** Set the inner-circle visibility based on bearing display state. */
    private updateInnerCircle(): void {
        const vis = this.isBearing1Displayed || this.isBearing2Displayed
        this.innerCircleVisible.set(vis ? 'inherit' : 'none')
    }

    /** Update display Subjects for a NAV (VOR/LOC/TACAN) CDI source. */
    private updateNavCDI(navIndex: number): void {
        const isTacan = Simplane.getAutopilotTacanDriven()
        const hasNav = isTacan ? Simplane.getNavHasTacan(navIndex) : Simplane.getNavHasNav(navIndex)

        this.cdiNeedleVisible.set(hasNav)

        if (isTacan) {
            this.navSource.set('TCN' + navIndex)
            this.displayedCourse.set(Simplane.getTacanObs(navIndex))
            this.toFromState.set(Simplane.getTacanToFrom(navIndex))
            const dev = Simplane.getTacanCdi(navIndex) / 127
            this.crossTrackGoal = Math.min(Math.max(dev, -1), 1) * 20
        } else {
            if (Simplane.getAutoPilotNavHasLoc(navIndex)) {
                this.navSource.set('LOC' + navIndex)
                this.displayedCourse.set(Simplane.getNavLocalizer(navIndex))
            } else {
                this.navSource.set('VOR' + navIndex)
                this.displayedCourse.set(Simplane.getNavObs(navIndex))
            }
            this.toFromState.set(Simplane.getNavToFrom(navIndex))
            const dev = Simplane.getNavCdi(navIndex) / 127
            this.crossTrackGoal = Math.min(Math.max(dev, -1), 1) * 20
        }

        this.sourceIsGps = false
        this.updateToFromVisibility()
        this.flightPhaseVisible.set('hidden')
        this.xtkVisible.set('hidden')
    }

    /** Update display Subjects for GPS CDI source. */
    private updateGPSCDI(): void {
        this.navSource.set('GPS')
        this.sourceIsGps = true

        const wpIdValid = this.gpsActiveWaypoint.get() ? 1 : 0
        const wpDesiredTrk = this.gpsWpDesiredTrack.get()
        const wpXTrk = this.gpsWpCrossTrack.get()

        this.addValueInFrames(+wpIdValid, this.gpsNextWpIdValidFrames, 20)
        this.addValueInFrames(wpDesiredTrk, this.gpsNextWpDesiredTrkFrames, 20)
        this.addValueInFrames(wpXTrk, this.gpsNextWpXTrkFrames, 20)

        if (!(Avionics.Utils as any).isValueOutlier(+wpIdValid, this.gpsNextWpIdValidFrames)) {
            this.gpsNextWpIdValid = !!wpIdValid
        }

        this.cdiNeedleVisible.set(this.hsiCdiNeedleValid.get())

        if (!(Avionics.Utils as any).isValueOutlier(wpDesiredTrk, this.gpsNextWpDesiredTrkFrames)) {
            this.displayedCourse.set(this.gpsNextWpIdValid ? wpDesiredTrk : 0)
        }
        if (!(Avionics.Utils as any).isValueOutlier(wpXTrk, this.gpsNextWpXTrkFrames)) {
            const xtk = this.gpsNextWpIdValid ? wpXTrk : 0
            // Actual CDI needle position comes from updateHSIDeviation() which reads
            // the HSI CDI NEEDLE SimVar; crossTrackGoal feeds the interpolation below.
            // Track the raw XTK for the interpolation
            this.crossTrackGoal =
                Math.min(Math.max(xtk, -this.crosstrackFullError), this.crosstrackFullError) *
                (20 / this.crosstrackFullError)
            if (Math.abs(xtk) < this.crosstrackFullError) {
                this.xtkVisible.set('hidden')
            } else {
                this.xtkVisible.set('visible')
                this.xtkText.set('XTK ' + fastToFixed(xtk, 2) + 'NM')
            }
        }

        this.toFromState.set(1)
        this.updateToFromVisibility()

        this.curDeviation = this.gpsCdiScaling.get()

        if (this.gpsActiveWaypoint.get()) {
            this.flightPhaseText.set(this.formatPhase(this.cdiScaleLabel.get()))
        } else {
            this.flightPhaseText.set('ENR')
        }
        this.flightPhaseVisible.set('visible')

        this.crosstrackFullError = this.curDeviation > 0 ? this.curDeviation : 2.0

        this.updateHSIDeviation()
    }

    /** Read HSI CDI/GSI needle SimVars and set position Subjects. */
    private updateHSIDeviation(): void {
        const hsiNeedle = this.hsiCdiNeedle.get() || 0
        const hsiPos = (hsiNeedle / 127) * 30
        this.hsiCdiNeedlePos.set(Math.min(Math.max(hsiPos, -30), 30))

        const gsiNeedle = this.hsiGsiNeedle.get() || 0
        const gsiClamped = Math.min(Math.max(gsiNeedle, -127), 127)
        const gsiPos = (gsiClamped / 127) * 35
        this.gsiNeedlePos.set(gsiPos)

        // Hollow diamond bug (other NAV's GSI)
        const navSelected = this.navSelected.get()
        if (navSelected == 1) {
            const nav1Gsi = this.nav1Gsi.get() || 0
            const nav1Clamped = Math.min(Math.max(nav1Gsi, -127), 127)
            this.hollowDiamondPos.set((nav1Clamped / 127) * 35)
        } else if (navSelected == 2) {
            const nav2Gsi = this.nav2Gsi.get() || 0
            const nav2Clamped = Math.min(Math.max(nav2Gsi, -127), 127)
            this.hollowDiamondPos.set((nav2Clamped / 127) * 35)
        }
    }

    /** Update bearing display Subjects for one bearing pointer. */
    private updateBearing(
        index: number,
        source: number,
        srcSubj: Subject<string>,
        identSubj: Subject<string>,
        distSubj: Subject<string>,
        angleSubj: Subject<number>
    ): void {
        const compass = this.magneticHeading.get()

        switch (source) {
            case 0:
                srcSubj.set('')
                identSubj.set('')
                distSubj.set('')
                angleSubj.set(NaN)
                break
            case 1:
            case 2:
                srcSubj.set('NAV' + source)
                if (Simplane.getNavHasNav(source)) {
                    const signalOk = Simplane.getNavSignal(source) > 0
                    identSubj.set(signalOk ? Simplane.getNavIdent(source) : '')
                    const hasDme = Simplane.getNavHasDme(source)
                    distSubj.set(hasDme ? String(Simplane.getNavDme(source)) : '')
                    const radial = (180 + Simplane.getNavRadial(source)) % 360
                    angleSubj.set(radial)
                } else {
                    identSubj.set('NO DATA')
                    distSubj.set('')
                    angleSubj.set(NaN)
                }
                break
            case 3:
                srcSubj.set('GPS')
                identSubj.set(Simplane.getGPSWpNextID())
                distSubj.set(String(Simplane.getNextWaypointDistance()))
                angleSubj.set(Simplane.getNextWaypointTrack())
                break
            case 4:
                srcSubj.set('ADF')
                distSubj.set('')
                if (Simplane.getAdfSignal(1) > 0) {
                    identSubj.set(fastToFixed(Simplane.getAdfActFreq(1), 1))
                    angleSubj.set((Simplane.getAdfRadial(1) + compass) % 360)
                } else {
                    identSubj.set('NO DATA')
                    angleSubj.set(NaN)
                }
                break
            default:
                angleSubj.set(NaN)
                break
        }
    }

    /** Map toFromState (0/1/2) to 'none'/'inherit' visibility values. */
    private updateToFromVisibility(): void {
        switch (this.toFromState.get()) {
            case 1:
                this.toVisible.set('inherit')
                this.fromVisible.set('none')
                break
            case 2:
                this.toVisible.set('none')
                this.fromVisible.set('inherit')
                break
            default:
                this.toVisible.set('none')
                this.fromVisible.set('none')
                break
        }
    }

    private addValueInFrames(value: any, frames: any[], maxFrames: number): void {
        if (frames != undefined) {
            frames.push(value)
            while (frames.length > maxFrames) {
                frames.shift()
            }
        }
    }

    // ---- HUD style helper (kept for external use) ----
    applyHUDStyle(_elem: Element): void {
        _elem.setAttribute('fill', 'rgb(26,29,33)')
        _elem.setAttribute('fill-opacity', '0.5')
        _elem.setAttribute('stroke', 'rgb(255, 255, 255)')
        _elem.setAttribute('stroke-width', '0.75')
        _elem.setAttribute('stroke-opacity', '0.2')
    }

    // ========================================================================
    //  Render — fully declarative JSX with Subject-driven attributes
    // ========================================================================

    render(): VNode {
        const viewBox = '-28 -15 156 116'

        return (
            <svg ref={this.rootRef} class="hsi" width="100%" height="100%" viewBox={viewBox}>
                {/* Compass lines */}
                {[-135, -90, -45, 45, 90, 135].map(angle => (
                    <rect
                        key={`compass-line-${angle}`}
                        x="49.5"
                        y="-7"
                        width="1"
                        height="6"
                        transform={`rotate(${angle} 50 50)`}
                        fill="white"
                    />
                ))}

                {/* Rotating rose group — transform is now declarative */}
                <g ref={this.rotatingRoseRef} transform={this.roseTransform}>
                    {!this.props.noBackground && (
                        <circle cx="50" cy="50" r="50" fill="#1a1d21" fill-opacity="0.25" />
                    )}

                    {/* Tick marks — 72 ticks at 5-degree intervals */}
                    {[...Array(72)].map((_, i) => {
                        const length = i % 2 == 0 ? 4 : 2
                        const angle = (i * (2 * Math.PI)) / 72
                        const rotation = (-angle / Math.PI) * 180 + 180
                        return (
                            <rect
                                key={`tick-${i}`}
                                x="49.5"
                                y={100 - length}
                                width="1"
                                height={String(length)}
                                transform={`rotate(${rotation} 50 50)`}
                                fill="white"
                            />
                        )
                    })}

                    {/* Compass labels */}
                    {['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'].map(
                        (text, i) => {
                            const angle = i * (360 / 12)
                            return (
                                <text
                                    key={`label-${i}`}
                                    x="50"
                                    y={i % 3 == 0 ? '12' : '9'}
                                    fill="white"
                                    font-size={i % 3 == 0 ? '12' : '10'}
                                    text-anchor="middle"
                                    alignment-baseline="central"
                                    transform={`rotate(${angle} 50 50)`}
                                    font-family="OpenSans-Bold"
                                >
                                    {text}
                                </text>
                            )
                        }
                    )}

                    {/* Heading bug */}
                    <polygon
                        points="46,0 47,0 50,4 53,0 54,0 54,5 46,5"
                        fill="aqua"
                        transform={this.headingBugTransform}
                    />

                    {/* Inner circle for bearing display */}
                    <circle
                        cx="50"
                        cy="50"
                        r="30"
                        stroke="white"
                        stroke-width="0.8"
                        fill-opacity="0"
                        display={this.innerCircleVisible}
                    />

                    {this.props.displayStyle != HSIndicatorDisplayType.HUD_Simplified && (
                        <>
                            {/* Current track indicator */}
                            <polygon
                                points="50,-4 52,0 50,4 48,0"
                                fill="magenta"
                                transform={this.trackTransform}
                            />

                            {/* Bearing 1 pointer */}
                            <g
                                display={this.isBearing1Displayed ? 'inherit' : 'none'}
                                transform={this.bearing1Transform}
                                visibility={this.bearing1Vis}
                            >
                                <path
                                    d="M50 96 L50 80 M50 4 L50 20 M50 8 L57 15 M50 8 L43 15"
                                    stroke="aqua"
                                    stroke-width="1"
                                    fill-opacity="0"
                                />
                            </g>

                            {/* Bearing 2 pointer */}
                            <g
                                display={this.isBearing2Displayed ? 'inherit' : 'none'}
                                transform={this.bearing2Transform}
                                visibility={this.bearing2Vis}
                            >
                                <path
                                    d="M50 96 L50 92 M47 80 L47 90 Q50 96 53 90 L53 80 M50 4 L50 8 L57 15 M50 8 L43 15 M47 11 L47 20 M53 11 L53 20"
                                    stroke="aqua"
                                    stroke-width="1"
                                    fill-opacity="0"
                                />
                            </g>

                            {/* Course group */}
                            <g transform={this.courseGroupTransform}>
                                {/* Begin arrow */}
                                <polygon
                                    points="51,96 49,96 49,75 51,75"
                                    fill={this.navFill}
                                    fill-opacity={this.navFillOpacity}
                                    stroke={this.navStroke}
                                />
                                <polygon
                                    points="46,75 54,75 50,80"
                                    fill={this.navFill}
                                    stroke="black"
                                    stroke-width="0.2"
                                    display={this.fromVisible}
                                />

                                {/* CDI needle */}
                                <polygon
                                    points="49,74.5 51,74.5 51,25.5 49,25.5"
                                    fill={this.navFill}
                                    fill-opacity={this.navFillOpacity}
                                    stroke={this.navStroke}
                                    display={this.cdiDisplay}
                                    transform={this.cdiTransform}
                                />

                                {/* End arrow + to indicator */}
                                <polygon
                                    points="51,25 49,25 49,15 45,15 50,4 55,15 51,15"
                                    fill={this.navFill}
                                    fill-opacity={this.navFillOpacity}
                                    stroke={this.navStroke}
                                />
                                <polygon
                                    points="46,25 54,25 50,20"
                                    fill={this.navFill}
                                    stroke="black"
                                    stroke-width="0.2"
                                    display={this.toVisible}
                                />

                                {/* CDI scale circles */}
                                {[-20, -10, 10, 20].map(pos => (
                                    <circle
                                        key={`cdi-dot-${pos}`}
                                        cx={String(50 + pos)}
                                        cy="50"
                                        r="2"
                                        stroke="white"
                                        stroke-width="1"
                                        fill-opacity="0"
                                    />
                                ))}
                            </g>
                        </>
                    )}
                </g>

                {/* Top triangle (fixed, does not rotate) */}
                <polygon points="46,-3 54,-3 50,3" fill="white" stroke="black" />

                {/* Plane symbol (fixed) */}
                <path
                    d="M44 50 L49 50 L49 53 L48 54 L48 55 L52 55 L52 54 L51 53 L51 50 L56 50 L56 49 L51 48 L51 46 Q50 44 49 46 L49 48 L44 49 Z"
                    fill="white"
                />

                {/* Bearing text (shows current magnetic heading at top) */}
                <rect x="35" y="-15" height="12" width="30" fill="#1a1d21" />
                <text fill="white" text-anchor="middle" x="50" y="-5" font-size="11">
                    {this.bearingTextValue}
                </text>

                {this.props.displayStyle != HSIndicatorDisplayType.HUD_Simplified && (
                    <>
                        {/* Center text: nav source, flight phase, XTK */}
                        {!this.props.noCenterText && (
                            <>
                                <rect
                                    fill="#1a1d21"
                                    fill-opacity="1"
                                    x="27"
                                    y="34.5"
                                    height="7"
                                    width="16"
                                />
                                <text
                                    fill={this.navFill}
                                    x="35"
                                    y="40"
                                    font-size="6"
                                    text-anchor="middle"
                                >
                                    {this.navSource}
                                </text>

                                <rect
                                    fill="#1a1d21"
                                    fill-opacity="1"
                                    x="56"
                                    y="34.5"
                                    height="7"
                                    width="18"
                                    visibility={this.flightPhaseVisible}
                                />
                                <text
                                    fill="magenta"
                                    x="65"
                                    y="40"
                                    font-size="6"
                                    text-anchor="middle"
                                    visibility={this.flightPhaseVisible}
                                >
                                    {this.flightPhaseText}
                                </text>

                                <rect
                                    fill="#1a1d21"
                                    fill-opacity="1"
                                    x="29"
                                    y="60.5"
                                    height="7"
                                    width="40"
                                    visibility={this.xtkVisible}
                                />
                                <text
                                    fill="magenta"
                                    x="50"
                                    y="66"
                                    font-size="6"
                                    text-anchor="middle"
                                    visibility={this.xtkVisible}
                                >
                                    {this.xtkText}
                                </text>
                            </>
                        )}

                        {/* DME group */}
                        <g display={this.dmeVisible}>
                            <path
                                d={this.getExternalTextZonePath(57, 0, -0.58, -28)}
                                fill="#1a1d21"
                            />
                            <text fill="white" x="-27" y="57" font-size="6" text-anchor="start">
                                DME
                            </text>
                            <text fill="aqua" x="-27" y="64" font-size="6" text-anchor="start">
                                {this.dmeSourceDisplay}
                            </text>
                            <text fill="aqua" x="-27" y="71" font-size="6" text-anchor="start">
                                {this.dmeIdentDisplay}
                            </text>
                            <text fill="white" x="-27" y="78" font-size="6" text-anchor="start">
                                {this.dmeDistDisplay}
                            </text>
                        </g>

                        {/* Bearing 1 fixed info panel */}
                        <g display={this.isBearing1Displayed ? 'inherit' : 'none'}>
                            <path
                                d={this.getExternalTextZonePath(57, -0.6, -1.1, -28)}
                                fill="#1a1d21"
                            />
                            <text fill="white" x="-27" y="88" font-size="6" text-anchor="start">
                                {this.bearing1Dist}
                            </text>
                            <text fill="aqua" x="-27" y="94" font-size="6" text-anchor="start">
                                {this.bearing1Ident}
                            </text>
                            <text fill="white" x="-27" y="100" font-size="6" text-anchor="left">
                                {this.bearing1Source}
                            </text>
                            {/* Bearing 1 pointer tab */}
                            <rect x="-5" y="96.875" width="15" height="0.25" fill="aqua" />
                            <rect
                                x="-3"
                                y="96.875"
                                width="4"
                                height="0.25"
                                transform="rotate(-45 -3 97)"
                                fill="aqua"
                            />
                            <rect
                                x="-3"
                                y="96.875"
                                width="4"
                                height="0.25"
                                transform="rotate(45 -3 97)"
                                fill="aqua"
                            />
                        </g>

                        {/* Bearing 2 fixed info panel */}
                        <g display={this.isBearing2Displayed ? 'inherit' : 'none'}>
                            <path
                                d={this.getExternalTextZonePath(
                                    57,
                                    Math.PI + 0.6,
                                    Math.PI + 1.1,
                                    128,
                                    true
                                )}
                                fill="#1a1d21"
                            />
                            <text fill="white" x="127" y="88" font-size="6" text-anchor="end">
                                {this.bearing2Dist}
                            </text>
                            <text fill="aqua" x="127" y="94" font-size="6" text-anchor="end">
                                {this.bearing2Ident}
                            </text>
                            <text fill="white" x="127" y="100" font-size="6" text-anchor="end">
                                {this.bearing2Source}
                            </text>
                            <path
                                d="M90 97 L92 97 M105 97 L103 97 L100 100 M103 97 L100 94 M101.5 98.5 L93 98.5 Q90 97 93 95.5 L101.5 95.5"
                                stroke="aqua"
                                stroke-width="0.5"
                                fill-opacity="0"
                            />
                        </g>
                    </>
                )}
            </svg>
        )
    }

    // ========================================================================
    //  Static SVG helpers
    // ========================================================================

    private getExternalTextZonePath(
        radius: number,
        beginAngle: number,
        endAngle: number,
        xEnd: number,
        reverse = false
    ): string {
        const beginX = 50 - radius * Math.cos(beginAngle)
        const beginY = 50 - radius * Math.sin(beginAngle)
        const endX = 50 - radius * Math.cos(endAngle)
        const endY = 50 - radius * Math.sin(endAngle)
        let path =
            'M' +
            beginX +
            ' ' +
            beginY +
            'L' +
            xEnd +
            ' ' +
            beginY +
            'L' +
            xEnd +
            ' ' +
            endY +
            'L' +
            endX +
            ' ' +
            endY
        path +=
            'A ' + radius + ' ' + radius + ' 0 0 ' + (reverse ? 0 : 1) + ' ' + beginX + ' ' + beginY
        return path
    }
}
