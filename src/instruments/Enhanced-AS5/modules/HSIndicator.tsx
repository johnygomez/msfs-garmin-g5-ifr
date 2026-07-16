import { CDIScaleLabel, CdiScaleFormatter } from '@microsoft/msfs-garminsdk'
import {
    AhrsEvents,
    ComponentProps,
    Consumer,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    MappedSubject,
    MappedSubscribable,
    SimVarValueType,
    Subscribable,
    Subscription,
    VNode,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'
import { G5NavEvents } from './G5NavPublisher'
import { G5NavdataEvents } from './GpsPhaseSource'
import { Colors } from './Utils'

export enum HSIndicatorDisplayType {
    GlassCockpit = 0,
    HUD = 1,
    HUD_Simplified = 2,
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max)

/** Formats a heading in degrees as a zero-padded `NNN°` string. */
function formatHeading(deg: number): string {
    const rounded = Math.round(deg)
    const value = rounded === 0 ? 360 : rounded
    return value.toString().padStart(3, '0') + '°'
}

/** Boundary of the external text zone drawn behind the corner DME/bearing panels. */
function textZonePath(beginAngle: number, endAngle: number, xEnd: number, reverse = false): string {
    const radius = 57
    const bx = 50 - radius * Math.cos(beginAngle)
    const by = 50 - radius * Math.sin(beginAngle)
    const ex = 50 - radius * Math.cos(endAngle)
    const ey = 50 - radius * Math.sin(endAngle)
    return (
        `M${bx} ${by}L${xEnd} ${by}L${xEnd} ${ey}L${ex} ${ey}` +
        `A ${radius} ${radius} 0 0 ${reverse ? 0 : 1} ${bx} ${by}`
    )
}

interface BearingReadout {
    ident: string
    dist: string
    angle: number
}

interface BearingState extends BearingReadout {
    visible: boolean
    source: string
}

const NO_BEARING: BearingState = { visible: false, source: '', ident: '', dist: '', angle: NaN }

/** Static compass card: background disc, graduation ticks, and cardinal labels. */
class CompassCard extends DisplayComponent<{ noBackground: boolean }> {
    private static readonly TICKS = Array.from({ length: 72 }, (_, i) => i)
    private static readonly LABELS = [
        'N',
        '3',
        '6',
        'E',
        '12',
        '15',
        'S',
        '21',
        '24',
        'W',
        '30',
        '33',
    ]

    public render(): VNode {
        return (
            <>
                {!this.props.noBackground && (
                    <circle cx="50" cy="50" r="50" fill={Colors.PFD_BOX_BG} fill-opacity="0.25" />
                )}
                {CompassCard.TICKS.map(i => {
                    const length = i % 2 === 0 ? 4 : 2
                    const rotation = (-i * 360) / 72 + 180
                    return (
                        <rect
                            x="49.5"
                            y={100 - length}
                            width="1"
                            height={length}
                            transform={`rotate(${rotation} 50 50)`}
                            fill={Colors.WHITE}
                        />
                    )
                })}
                {CompassCard.LABELS.map((text, i) => (
                    <text
                        x="50"
                        y={i % 3 === 0 ? '12' : '9'}
                        fill={Colors.WHITE}
                        font-size={i % 3 === 0 ? '12' : '10'}
                        text-anchor="middle"
                        alignment-baseline="central"
                        transform={`rotate(${i * 30} 50 50)`}
                        font-family="OpenSans-Bold"
                    >
                        {text}
                    </text>
                ))}
            </>
        )
    }
}

interface CoursePointerProps extends ComponentProps {
    transform: Subscribable<string>
    fill: Subscribable<string>
    fillOpacity: Subscribable<string>
    stroke: Subscribable<string>
    cdiTransform: Subscribable<string>
    cdiDisplay: Subscribable<string>
    toVisible: Subscribable<string>
    fromVisible: Subscribable<string>
}

/** The course-select arrow with its lateral-deviation (CDI) needle and TO/FROM flags. */
class CoursePointer extends DisplayComponent<CoursePointerProps> {
    public render(): VNode {
        const { fill, fillOpacity, stroke } = this.props
        return (
            <g transform={this.props.transform}>
                <polygon
                    points="51,96 49,96 49,75 51,75"
                    fill={fill}
                    fill-opacity={fillOpacity}
                    stroke={stroke}
                />
                <polygon
                    points="46,75 54,75 50,80"
                    fill={fill}
                    stroke={Colors.BLACK}
                    stroke-width="0.2"
                    display={this.props.fromVisible}
                />
                <polygon
                    points="49,74.5 51,74.5 51,25.5 49,25.5"
                    fill={fill}
                    fill-opacity={fillOpacity}
                    stroke={stroke}
                    display={this.props.cdiDisplay}
                    transform={this.props.cdiTransform}
                />
                <polygon
                    points="51,25 49,25 49,15 45,15 50,4 55,15 51,15"
                    fill={fill}
                    fill-opacity={fillOpacity}
                    stroke={stroke}
                />
                <polygon
                    points="46,25 54,25 50,20"
                    fill={fill}
                    stroke={Colors.BLACK}
                    stroke-width="0.2"
                    display={this.props.toVisible}
                />
                {[-20, -10, 10, 20].map(pos => (
                    <circle
                        cx={50 + pos}
                        cy="50"
                        r="2"
                        stroke={Colors.WHITE}
                        stroke-width="1"
                        fill-opacity="0"
                    />
                ))}
            </g>
        )
    }
}

const BEARING_POINTER_PATH: Record<1 | 2, string> = {
    1: 'M50 96 L50 80 M50 4 L50 20 M50 8 L57 15 M50 8 L43 15',
    2: 'M50 96 L50 92 M47 80 L47 90 Q50 96 53 90 L53 80 M50 4 L50 8 L57 15 M50 8 L43 15 M47 11 L47 20 M53 11 L53 20',
}

interface BearingPointerProps extends ComponentProps {
    state: Subscribable<BearingState>
    variant: 1 | 2
}

/** The rotating bearing pointer that overlays the compass rose. */
class BearingPointer extends DisplayComponent<BearingPointerProps> {
    private readonly display = this.props.state.map(s => (s.visible ? 'inherit' : 'none'))
    private readonly transform = this.props.state.map(s => `rotate(${s.angle}, 50, 50)`)

    public render(): VNode {
        return (
            <g display={this.display} transform={this.transform}>
                <path
                    d={BEARING_POINTER_PATH[this.props.variant]}
                    stroke={Colors.CYAN}
                    stroke-width="1"
                    fill-opacity="0"
                />
            </g>
        )
    }

    public destroy(): void {
        this.display.destroy()
        this.transform.destroy()
        super.destroy()
    }
}

interface BearingInfoPanelProps extends ComponentProps {
    state: Subscribable<BearingState>
    side: 'left' | 'right'
}

/** The fixed corner panel listing a bearing pointer's source, ident, and distance. */
class BearingInfoPanel extends DisplayComponent<BearingInfoPanelProps> {
    private readonly display = this.props.state.map(s => (s.visible ? 'inherit' : 'none'))
    private readonly dist = this.props.state.map(s => s.dist)
    private readonly ident = this.props.state.map(s => s.ident)
    private readonly source = this.props.state.map(s => s.source)

    public render(): VNode {
        return this.props.side === 'left' ? this.renderLeft() : this.renderRight()
    }

    private renderLeft(): VNode {
        return (
            <g display={this.display}>
                <path d={textZonePath(-0.6, -1.1, -28)} fill={Colors.PFD_BOX_BG} />
                <text fill={Colors.WHITE} x="-27" y="88" font-size="6" text-anchor="start">
                    {this.dist}
                </text>
                <text fill={Colors.CYAN} x="-27" y="94" font-size="6" text-anchor="start">
                    {this.ident}
                </text>
                <text fill={Colors.WHITE} x="-27" y="100" font-size="6" text-anchor="start">
                    {this.source}
                </text>
                <rect x="-5" y="96.875" width="15" height="0.25" fill={Colors.CYAN} />
                <rect
                    x="-3"
                    y="96.875"
                    width="4"
                    height="0.25"
                    transform="rotate(-45 -3 97)"
                    fill={Colors.CYAN}
                />
                <rect
                    x="-3"
                    y="96.875"
                    width="4"
                    height="0.25"
                    transform="rotate(45 -3 97)"
                    fill={Colors.CYAN}
                />
            </g>
        )
    }

    private renderRight(): VNode {
        return (
            <g display={this.display}>
                <path
                    d={textZonePath(Math.PI + 0.6, Math.PI + 1.1, 128, true)}
                    fill={Colors.PFD_BOX_BG}
                />
                <text fill={Colors.WHITE} x="127" y="88" font-size="6" text-anchor="end">
                    {this.dist}
                </text>
                <text fill={Colors.CYAN} x="127" y="94" font-size="6" text-anchor="end">
                    {this.ident}
                </text>
                <text fill={Colors.WHITE} x="127" y="100" font-size="6" text-anchor="end">
                    {this.source}
                </text>
                <path
                    d="M90 97 L92 97 M105 97 L103 97 L100 100 M103 97 L100 94 M101.5 98.5 L93 98.5 Q90 97 93 95.5 L101.5 95.5"
                    stroke={Colors.CYAN}
                    stroke-width="0.5"
                    fill-opacity="0"
                />
            </g>
        )
    }

    public destroy(): void {
        this.display.destroy()
        this.dist.destroy()
        this.ident.destroy()
        this.source.destroy()
        super.destroy()
    }
}

interface DmePanelProps extends ComponentProps {
    display: Subscribable<string>
    source: Subscribable<string>
    ident: Subscribable<string>
    dist: Subscribable<string>
}

/** The bottom-left DME readout panel. */
class DmePanel extends DisplayComponent<DmePanelProps> {
    public render(): VNode {
        return (
            <g display={this.props.display}>
                <path d={textZonePath(0, -0.58, -28)} fill={Colors.PFD_BOX_BG} />
                <text fill={Colors.WHITE} x="-27" y="57" font-size="6" text-anchor="start">
                    DME
                </text>
                <text fill={Colors.CYAN} x="-27" y="64" font-size="6" text-anchor="start">
                    {this.props.source}
                </text>
                <text fill={Colors.CYAN} x="-27" y="71" font-size="6" text-anchor="start">
                    {this.props.ident}
                </text>
                <text fill={Colors.WHITE} x="-27" y="78" font-size="6" text-anchor="start">
                    {this.props.dist}
                </text>
            </g>
        )
    }
}

interface CenterTextProps extends ComponentProps {
    navFill: Subscribable<string>
    navSource: Subscribable<string>
    phaseText: Subscribable<string>
    phaseVisible: Subscribable<string>
    xtkText: Subscribable<string>
    xtkVisible: Subscribable<string>
}

/** The central nav-source label plus flight-phase and cross-track annunciations. */
class CenterText extends DisplayComponent<CenterTextProps> {
    public render(): VNode {
        return (
            <>
                <rect fill={Colors.PFD_BOX_BG} x="27" y="34.5" height="7" width="16" />
                <text fill={this.props.navFill} x="35" y="40" font-size="6" text-anchor="middle">
                    {this.props.navSource}
                </text>
                <rect
                    fill={Colors.PFD_BOX_BG}
                    x="56"
                    y="34.5"
                    height="7"
                    width="18"
                    visibility={this.props.phaseVisible}
                />
                <text
                    fill={Colors.MAGENTA}
                    x="65"
                    y="40"
                    font-size="6"
                    text-anchor="middle"
                    visibility={this.props.phaseVisible}
                >
                    {this.props.phaseText}
                </text>
                <rect
                    fill={Colors.PFD_BOX_BG}
                    x="29"
                    y="60.5"
                    height="7"
                    width="40"
                    visibility={this.props.xtkVisible}
                />
                <text
                    fill={Colors.MAGENTA}
                    x="50"
                    y="66"
                    font-size="6"
                    text-anchor="middle"
                    visibility={this.props.xtkVisible}
                >
                    {this.props.xtkText}
                </text>
            </>
        )
    }
}

type NavConsumers = ReturnType<HSIComponent['subscribeNav']>

export interface HSIComponentProps extends ComponentProps {
    bus: EventBus
    noCenterText: boolean
    noBackground: boolean
    noAffectSimRadioNav: boolean
    displayStyle: HSIndicatorDisplayType
    heading?: Subscribable<number>
    onApi?: (instance: HSIComponent) => void
}

export class HSIComponent extends DisplayComponent<HSIComponentProps> {
    private readonly consumers: ConsumerSubject<any>[] = []
    private readonly derived: MappedSubscribable<any>[] = []
    private readonly effects: Subscription[] = []

    private readonly formatPhase = CdiScaleFormatter.create(false)

    private readonly nav = this.props.bus.getSubscriber<AhrsEvents & G5CustomEvents & G5NavEvents>()

    private readonly magneticHeading = this.c(this.nav.on('actual_hdg_deg').withPrecision(1), 0)
    private readonly trackAngle = this.c(this.nav.on('track_angle_magnetic').withPrecision(1), 0)
    private readonly headingSource: Subscribable<number> =
        this.props.heading ?? this.c(this.nav.on('ap_heading_selected').withPrecision(1), 0)

    private readonly gpsDrivesNav1 = this.c(this.nav.on('gps_drives_nav1'), true)
    private readonly navSelected = this.c(this.nav.on('nav_selected'), 0)
    private readonly apprHold = this.c(this.nav.on('ap_appr_hold'), false)
    private readonly approachType = this.c(this.nav.on('ap_approach_type'), 0)
    private readonly tacanDriven = this.c(this.nav.on('tacan_drives_nav1'), false)
    private readonly nav2Available = this.c(this.nav.on('nav2_available'), false)

    private readonly gpsActive = this.c(this.nav.on('gps_active_waypoint'), false)
    private readonly gpsDesiredTrack = this.c(this.nav.on('gps_wp_desired_track'), 0)
    private readonly gpsCrossTrack = this.c(this.nav.on('gps_wp_cross_track'), 0)
    private readonly gpsCdiScaling = this.c(this.nav.on('gps_cdi_scaling'), 0)
    private readonly gpsWpNextId = this.c(this.nav.on('gps_wp_next_id'), '')
    private readonly gpsWpDistance = this.c(this.nav.on('gps_wp_distance'), 0)
    private readonly gpsWpBearing = this.c(this.nav.on('gps_wp_bearing'), 0)
    private readonly gpsObsActive = this.c(this.nav.on('gps_obs_active'), false)

    private readonly cdiNeedle = this.c(this.nav.on('hsi_cdi_needle'), 0)
    private readonly cdiNeedleValid = this.c(this.nav.on('hsi_cdi_needle_valid'), false)

    private readonly brg1Source = this.c(this.nav.on('brg1_source'), 0)
    private readonly brg2Source = this.c(this.nav.on('brg2_source'), 0)
    private readonly dmeSource = this.c(this.nav.on('dme_source'), 1)
    private readonly dmeDisplayed = this.c(this.nav.on('dme_displayed'), false)

    private readonly adf1Signal = this.c(this.nav.on('adf1_signal'), 0)
    private readonly adf1ActFreq = this.c(this.nav.on('adf1_act_freq'), 0)
    private readonly adf1Radial = this.c(this.nav.on('adf1_radial'), 0)

    private readonly cdiScaleLabel = this.c(
        this.props.bus.getSubscriber<G5NavdataEvents>().on('g5_cdi_scale_label'),
        CDIScaleLabel.Enroute
    )

    private readonly nav1 = this.subscribeNav(1)
    private readonly nav2 = this.subscribeNav(2)

    // ---- Resolved active nav source (GPS unless a NAV receiver is coupled) ----
    private readonly cdiSource = this.track(
        MappedSubject.create(
            ([gpsDrives, apprHold, apprType, navSel]) => {
                const navCoupled =
                    !gpsDrives || (apprHold && apprType !== ApproachType.APPROACH_TYPE_RNAV)
                return navCoupled && navSel !== 0 ? ((navSel - 1) % 2) + 1 : 3
            },
            this.gpsDrivesNav1,
            this.apprHold,
            this.approachType,
            this.navSelected
        )
    )

    private readonly navSource = this.track(
        MappedSubject.create(
            ([src, tacan, loc1, loc2]) => {
                if (src === 3) return 'GPS'
                if (tacan) return 'TCN' + src
                return ((src === 1 ? loc1 : loc2) ? 'LOC' : 'VOR') + src
            },
            this.cdiSource,
            this.tacanDriven,
            this.nav1.hasLoc,
            this.nav2.hasLoc
        )
    )

    private readonly displayedCourse = this.track(
        MappedSubject.create(
            ([src, active, gpsTrk, course1, course2]) => {
                if (src === 3) return active ? gpsTrk : 0
                return src === 1 ? course1 : course2
            },
            this.cdiSource,
            this.gpsActive,
            this.gpsDesiredTrack,
            this.navCourse(this.nav1),
            this.navCourse(this.nav2)
        )
    )

    private readonly toFrom = this.track(
        MappedSubject.create(
            ([src, tf1, tf2]) => (src === 3 ? 1 : src === 1 ? tf1 : tf2),
            this.cdiSource,
            this.navToFrom(this.nav1),
            this.navToFrom(this.nav2)
        )
    )

    private readonly cdiValid = this.track(
        MappedSubject.create(
            ([src, valid, has1, has2]) => (src === 3 ? valid : src === 1 ? has1 : has2),
            this.cdiSource,
            this.cdiNeedleValid,
            this.navHas(this.nav1),
            this.navHas(this.nav2)
        )
    )

    // ---- Rotations and needle position ----
    private readonly roseTransform = this.track(
        this.magneticHeading.map(h => `rotate(${-h}, 50, 50)`)
    )
    private readonly headingBugTransform = this.track(
        this.headingSource.map(h => `rotate(${h}, 50, 50)`)
    )
    private readonly trackTransform = this.track(this.trackAngle.map(t => `rotate(${t}, 50, 50)`))
    private readonly headingText = this.track(this.magneticHeading.map(formatHeading))
    private readonly courseTransform = this.track(
        this.displayedCourse.map(c => `rotate(${c}, 50, 50)`)
    )
    private readonly cdiTransform = this.track(
        this.cdiNeedle.map(n => `translate(${clamp((n / 127) * 30, -30, 30)}, 0)`)
    )
    private readonly cdiDisplay = this.track(this.cdiValid.map(v => (v ? '' : 'none')))
    private readonly toVisible = this.track(this.toFrom.map(t => (t === 1 ? 'inherit' : 'none')))
    private readonly fromVisible = this.track(this.toFrom.map(t => (t === 2 ? 'inherit' : 'none')))

    // ---- Nav-source styling (NAV2 renders as a hollow lime pointer) ----
    private readonly navFill = this.track(
        this.navSource.map(s => (s === 'GPS' ? Colors.MAGENTA : Colors.GREEN))
    )
    private readonly navFillOpacity = this.track(
        this.navSource.map(s => (s.endsWith('2') ? '0' : '1'))
    )
    private readonly navStroke = this.track(
        this.navSource.map(s => (s.endsWith('2') ? Colors.GREEN : ''))
    )

    // ---- GPS-only annunciations ----
    private readonly phaseVisible = this.track(
        this.cdiSource.map(s => (s === 3 ? 'visible' : 'hidden'))
    )
    private readonly phaseText = this.track(
        MappedSubject.create(
            ([active, label]) => (active ? this.formatPhase(label) : 'ENR'),
            this.gpsActive,
            this.cdiScaleLabel
        )
    )
    private readonly xtkVisible = this.track(
        MappedSubject.create(
            ([src, active, xtk, scaling]) => {
                if (src !== 3) return 'hidden'
                const fullError = scaling > 0 ? scaling : 2
                return Math.abs(active ? xtk : 0) >= fullError ? 'visible' : 'hidden'
            },
            this.cdiSource,
            this.gpsActive,
            this.gpsCrossTrack,
            this.gpsCdiScaling
        )
    )
    private readonly xtkText = this.track(this.gpsCrossTrack.map(x => `XTK ${fastToFixed(x, 2)}NM`))

    // ---- Bearing pointers ----
    private readonly gpsBearing = this.track(
        MappedSubject.create(
            ([id, dist, brg]): BearingReadout => ({ ident: id, dist: String(dist), angle: brg }),
            this.gpsWpNextId,
            this.gpsWpDistance,
            this.gpsWpBearing
        )
    )
    private readonly adfBearing = this.track(
        MappedSubject.create(
            ([signal, freq, radial, hdg]): BearingReadout =>
                signal > 0
                    ? { ident: fastToFixed(freq, 1), dist: '', angle: (radial + hdg) % 360 }
                    : { ident: 'NO DATA', dist: '', angle: NaN },
            this.adf1Signal,
            this.adf1ActFreq,
            this.adf1Radial,
            this.magneticHeading
        )
    )
    private readonly bearing1 = this.bearingState(this.brg1Source)
    private readonly bearing2 = this.bearingState(this.brg2Source)

    private readonly innerCircleVisible = this.track(
        MappedSubject.create(
            ([b1, b2]) => (b1.visible || b2.visible ? 'inherit' : 'none'),
            this.bearing1,
            this.bearing2
        )
    )

    // ---- DME readout ----
    private readonly dmeDisplay = this.track(this.dmeDisplayed.map(d => (d ? 'inherit' : 'none')))
    private readonly dmeSourceLabel = this.track(this.dmeSource.map(s => 'NAV' + s))
    private readonly dmeIdent = this.track(
        MappedSubject.create(
            ([src, r1, r2]) => (src === 2 ? r2 : r1).ident,
            this.dmeSource,
            this.navDme(this.nav1),
            this.navDme(this.nav2)
        )
    )
    private readonly dmeDist = this.track(
        MappedSubject.create(
            ([src, r1, r2]) => (src === 2 ? r2 : r1).dist,
            this.dmeSource,
            this.navDme(this.nav1),
            this.navDme(this.nav2)
        )
    )

    constructor(props: HSIComponentProps) {
        super(props)

        // Drop GPS coupling when a non-RNAV approach becomes active, so the ILS/VOR drives the CDI.
        this.effects.push(
            this.apprHold.sub(hold => {
                if (
                    !this.props.noAffectSimRadioNav &&
                    hold &&
                    this.approachType.get() !== ApproachType.APPROACH_TYPE_RNAV &&
                    this.gpsDrivesNav1.get()
                ) {
                    SimVar.SetSimVarValue('K:TOGGLE_GPS_DRIVES_NAV1', SimVarValueType.Bool, 0)
                }
            })
        )
        this.effects.push(
            this.dmeSource.sub(src => {
                if (src === 0 && !this.props.noAffectSimRadioNav) {
                    SimVar.SetSimVarValue('L:Glasscockpit_DmeSource', SimVarValueType.Number, 1)
                }
            })
        )
    }

    private c<T>(consumer: Consumer<T>, initial: T): ConsumerSubject<T> {
        const subject = ConsumerSubject.create(consumer, initial).pause()
        this.consumers.push(subject)
        return subject
    }

    private track<T extends MappedSubscribable<any>>(subscribable: T): T {
        this.derived.push(subscribable.pause())
        return subscribable
    }

    private subscribeNav(index: 1 | 2) {
        const s = this.props.bus.getSubscriber<G5NavEvents>()
        const on = <T,>(topic: keyof G5NavEvents, init: T) =>
            this.c(s.on(topic) as unknown as Consumer<T>, init)
        return {
            hasNav: on<boolean>(`nav${index}_has_nav`, false),
            hasLoc: on<boolean>(`nav${index}_has_loc`, false),
            localizer: on<number>(`nav${index}_localizer`, 0),
            obs: on<number>(`nav${index}_obs`, 0),
            toFrom: on<number>(`nav${index}_to_from`, 0),
            hasTacan: on<boolean>(`nav${index}_has_tacan`, false),
            tacanObs: on<number>(`nav${index}_tacan_obs`, 0),
            tacanToFrom: on<number>(`nav${index}_tacan_to_from`, 0),
            signal: on<number>(`nav${index}_signal`, 0),
            ident: on<string>(`nav${index}_ident`, ''),
            hasDme: on<boolean>(`nav${index}_has_dme`, false),
            dme: on<number>(`nav${index}_dme`, 0),
            radial: on<number>(`nav${index}_radial`, 0),
            actFreq: on<number>(`nav${index}_act_freq`, 0),
        }
    }

    private navCourse(nav: NavConsumers): MappedSubscribable<number> {
        return this.track(
            MappedSubject.create(
                ([tacan, hasLoc, loc, obs, tObs]) => (tacan ? tObs : hasLoc ? loc : obs),
                this.tacanDriven,
                nav.hasLoc,
                nav.localizer,
                nav.obs,
                nav.tacanObs
            )
        )
    }

    private navToFrom(nav: NavConsumers): MappedSubscribable<number> {
        return this.track(
            MappedSubject.create(
                ([tacan, tf, tTf]) => (tacan ? tTf : tf),
                this.tacanDriven,
                nav.toFrom,
                nav.tacanToFrom
            )
        )
    }

    private navHas(nav: NavConsumers): MappedSubscribable<boolean> {
        return this.track(
            MappedSubject.create(
                ([tacan, hasTacan, hasNav]) => (tacan ? hasTacan : hasNav),
                this.tacanDriven,
                nav.hasTacan,
                nav.hasNav
            )
        )
    }

    private navBearing(nav: NavConsumers): MappedSubscribable<BearingReadout> {
        return this.track(
            MappedSubject.create(
                ([hasNav, signal, ident, hasDme, dme, radial]): BearingReadout =>
                    hasNav
                        ? {
                              ident: signal > 0 ? ident : '',
                              dist: hasDme ? String(dme) : '',
                              angle: (180 + radial) % 360,
                          }
                        : { ident: 'NO DATA', dist: '', angle: NaN },
                nav.hasNav,
                nav.signal,
                nav.ident,
                nav.hasDme,
                nav.dme,
                nav.radial
            )
        )
    }

    private navDme(nav: NavConsumers): MappedSubscribable<{ ident: string; dist: string }> {
        return this.track(
            MappedSubject.create(
                ([signal, hasDme, freq, dme]) =>
                    signal > 0 && hasDme
                        ? { ident: fastToFixed(freq, 2), dist: isNaN(dme) ? '' : String(dme) }
                        : { ident: '', dist: '' },
                nav.signal,
                nav.hasDme,
                nav.actFreq,
                nav.dme
            )
        )
    }

    private bearingState(source: Subscribable<number>): MappedSubscribable<BearingState> {
        return this.track(
            MappedSubject.create(
                ([src, n1, n2, gps, adf]): BearingState => {
                    switch (src) {
                        case 1:
                            return { visible: true, source: 'NAV1', ...n1 }
                        case 2:
                            return { visible: true, source: 'NAV2', ...n2 }
                        case 3:
                            return { visible: true, source: 'GPS', ...gps }
                        case 4:
                            return { visible: true, source: 'ADF', ...adf }
                        default:
                            return NO_BEARING
                    }
                },
                source,
                this.navBearing(this.nav1),
                this.navBearing(this.nav2),
                this.gpsBearing,
                this.adfBearing
            )
        )
    }

    onAfterRender(): void {
        this.consumers.forEach(c => c.resume())
        this.derived.forEach(d => d.resume())
        this.props.onApi?.(this)
    }

    destroy(): void {
        this.effects.forEach(e => e.destroy())
        this.derived.forEach(d => d.destroy())
        this.consumers.forEach(c => c.destroy())
        super.destroy()
    }

    /** Handles the CRS/BRG/CDI/DME hardware knobs and softkeys routed by the NavSystem. */
    onEvent(event: string): void {
        if (this.props.noAffectSimRadioNav) return

        switch (event) {
            case 'CRS_INC':
                this.adjustCourse(1)
                break
            case 'CRS_DEC':
                this.adjustCourse(-1)
                break
            case 'CRS_PUSH':
                this.centerCourse()
                break
            case 'SoftKeys_PFD_DME':
                SimVar.SetSimVarValue(
                    'L:PFD_DME_Displayed',
                    SimVarValueType.Number,
                    this.dmeDisplayed.get() ? 0 : 1
                )
                break
            case 'SoftKeys_PFD_BRG1':
            case 'BRG1Switch':
                this.cycleBearing('L:PFD_BRG1_Source', this.brg1Source.get())
                break
            case 'SoftKeys_PFD_BRG2':
            case 'BRG2Switch':
                this.cycleBearing('L:PFD_BRG2_Source', this.brg2Source.get())
                break
            case 'SoftKey_CDI':
            case 'NavSourceSwitch':
                this.cycleCdiSource()
                break
        }
    }

    private adjustCourse(direction: 1 | -1): void {
        const src = this.cdiSource.get()
        if (src === 1) {
            SimVar.SetSimVarValue(
                direction > 0 ? 'K:VOR1_OBI_INC' : 'K:VOR1_OBI_DEC',
                SimVarValueType.Number,
                0
            )
        } else if (src === 2) {
            SimVar.SetSimVarValue(
                direction > 0 ? 'K:VOR2_OBI_INC' : 'K:VOR2_OBI_DEC',
                SimVarValueType.Number,
                0
            )
        } else if (this.gpsObsActive.get()) {
            SimVar.SetSimVarValue(
                direction > 0 ? 'K:GPS_OBS_INC' : 'K:GPS_OBS_DEC',
                SimVarValueType.Number,
                0
            )
        }
    }

    private centerCourse(): void {
        const src = this.cdiSource.get()
        if (src === 1) {
            SimVar.SetSimVarValue(
                'K:VOR1_SET',
                SimVarValueType.Number,
                (180 + this.nav1.radial.get()) % 360
            )
        } else if (src === 2) {
            SimVar.SetSimVarValue(
                'K:VOR2_SET',
                SimVarValueType.Number,
                (180 + this.nav2.radial.get()) % 360
            )
        }
    }

    private cycleBearing(lvar: string, current: number): void {
        SimVar.SetSimVarValue(lvar, SimVarValueType.Number, (current + 1) % 5)
    }

    private cycleCdiSource(): void {
        let next = (this.cdiSource.get() % 3) + 1
        if (next === 2 && !this.nav2Available.get()) {
            next = 3
        }
        if ((next === 3) !== this.gpsDrivesNav1.get()) {
            SimVar.SetSimVarValue('K:TOGGLE_GPS_DRIVES_NAV1', SimVarValueType.Bool, 0)
        }
        if (next !== 3) {
            ;(Simplane as any).setAutoPilotSelectedNav(next)
        }
    }

    render(): VNode {
        const full = this.props.displayStyle !== HSIndicatorDisplayType.HUD_Simplified

        return (
            <svg class="hsi" width="100%" height="100%" viewBox="-28 -15 156 116">
                {[-135, -90, -45, 45, 90, 135].map(angle => (
                    <rect
                        x="49.5"
                        y="-7"
                        width="1"
                        height="6"
                        transform={`rotate(${angle} 50 50)`}
                        fill={Colors.WHITE}
                    />
                ))}

                <g transform={this.roseTransform}>
                    <CompassCard noBackground={this.props.noBackground} />

                    <polygon
                        points="46,0 47,0 50,4 53,0 54,0 54,5 46,5"
                        fill={Colors.CYAN}
                        transform={this.headingBugTransform}
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="30"
                        stroke={Colors.WHITE}
                        stroke-width="0.8"
                        fill-opacity="0"
                        display={this.innerCircleVisible}
                    />

                    {full && (
                        <>
                            <polygon
                                points="50,-4 52,0 50,4 48,0"
                                fill={Colors.MAGENTA}
                                transform={this.trackTransform}
                            />
                            <BearingPointer state={this.bearing1} variant={1} />
                            <BearingPointer state={this.bearing2} variant={2} />
                            <CoursePointer
                                transform={this.courseTransform}
                                fill={this.navFill}
                                fillOpacity={this.navFillOpacity}
                                stroke={this.navStroke}
                                cdiTransform={this.cdiTransform}
                                cdiDisplay={this.cdiDisplay}
                                toVisible={this.toVisible}
                                fromVisible={this.fromVisible}
                            />
                        </>
                    )}
                </g>

                <polygon points="46,-3 54,-3 50,3" fill={Colors.WHITE} stroke={Colors.BLACK} />
                <path
                    d="M44 50 L49 50 L49 53 L48 54 L48 55 L52 55 L52 54 L51 53 L51 50 L56 50 L56 49 L51 48 L51 46 Q50 44 49 46 L49 48 L44 49 Z"
                    fill={Colors.WHITE}
                />

                <rect x="35" y="-15" height="12" width="30" fill={Colors.PFD_BOX_BG} />
                <text fill={Colors.WHITE} text-anchor="middle" x="50" y="-5" font-size="11">
                    {this.headingText}
                </text>

                {full && (
                    <>
                        {!this.props.noCenterText && (
                            <CenterText
                                navFill={this.navFill}
                                navSource={this.navSource}
                                phaseText={this.phaseText}
                                phaseVisible={this.phaseVisible}
                                xtkText={this.xtkText}
                                xtkVisible={this.xtkVisible}
                            />
                        )}
                        <DmePanel
                            display={this.dmeDisplay}
                            source={this.dmeSourceLabel}
                            ident={this.dmeIdent}
                            dist={this.dmeDist}
                        />
                        <BearingInfoPanel state={this.bearing1} side="left" />
                        <BearingInfoPanel state={this.bearing2} side="right" />
                    </>
                )}
            </svg>
        )
    }
}
