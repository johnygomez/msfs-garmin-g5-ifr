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

import { Colors } from '../common/Utils'
import { BearingState } from '../providers/BearingPointerDataProvider'
import { G5NavdataEvents } from '../providers/GpsPhaseSource'
import { NavSource, NavSourceLabel } from '../providers/NavSourceDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max)

/**
 * The gauge renders into a 512 x 350 px panel texture, which the G5 model maps onto a
 * 68.16 x 51.39 mm screen quad. The narrower quad squeezes the image horizontally, so
 * geometry is pre-stretched along x to reach the eye undistorted.
 */
const SCREEN_ASPECT_CORRECTION = 512 / 350 / (68.16 / 51.39)

/** Pre-stretches the compass along x, undone by the screen quad when displayed. */
const ASPECT_TRANSFORM = `scale(${SCREEN_ASPECT_CORRECTION}, 1)`

/** The `-28 -15 156 116` design space, widened to hold the pre-stretched geometry. */
const VIEWBOX = `${-28 * SCREEN_ASPECT_CORRECTION} -15 ${156 * SCREEN_ASPECT_CORRECTION} 116`

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
                    points="49,74.5 51,74.5 51,25.5 49,25.5"
                    fill={fill}
                    fill-opacity={fillOpacity}
                    stroke={stroke}
                    display={this.props.cdiDisplay}
                    transform={this.props.cdiTransform}
                />
                <polygon
                    class="course-arrow-head"
                    points="51,25 49,25 49,13 45,15 50,4 55,15 51,13"
                    fill={fill}
                    fill-opacity={fillOpacity}
                    stroke={stroke}
                />
                <polygon
                    class="course-from-to-arrow"
                    points="45,55 50,57 55,55 50,65"
                    fill={fill}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                    display={this.props.fromVisible}
                />
                <polygon
                    points="45,45 50,43 55,45 50,35"
                    fill={fill}
                    stroke={Colors.BLACK}
                    stroke-width="1"
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

interface TrackIndicatorProps extends ComponentProps {
    trackAngle: Subscribable<number>
}

class TrackIndicator extends DisplayComponent<TrackIndicatorProps> {
    private readonly trackTransform: MappedSubject<[number], string>

    constructor(props: TrackIndicatorProps) {
        super(props)

        this.trackTransform = MappedSubject.create(
            ([angle]) => `rotate(${angle}, 50, 50)`,
            this.props.trackAngle
        ).pause()
    }

    public onAfterRender(): void {
        this.trackTransform.resume()
    }

    public destroy(): void {
        this.trackTransform.destroy()
        super.destroy()
    }

    public render(): VNode {
        return (
            <g transform={this.trackTransform}>
                <polygon class="track-arrow" points="46,0 54,0 50,4" fill={Colors.MAGENTA} />
                <line
                    x1="50"
                    y1="4"
                    x2="50"
                    y2="50"
                    stroke={Colors.WHITE}
                    stroke-width="1"
                    stroke-dasharray="4"
                    opacity="0.5"
                />
            </g>
        )
    }
}

const BEARING_POINTER_PATH: Record<1 | 2, string> = {
    1: 'M50 90 L50 80 M50 10 L50 20 M50 12 L54 17 M50 12 L46 17',
    2: 'M50 90 L50 86 M48 80 L48 84 Q50 88 52 84 L52 80 M50 10 L50 13 L54 17 M50 13 L46 17 M48 15 L48 20 M52 15 L52 20',
}

interface BearingPointerProps extends ComponentProps {
    state: Subscribable<BearingState>
    variant: 1 | 2
    id?: string
}

/** The rotating bearing pointer that overlays the compass rose. */
class BearingPointer extends DisplayComponent<BearingPointerProps> {
    private readonly display = this.props.state.map(s => (s.visible ? 'inherit' : 'none'))
    private readonly transform = this.props.state.map(s => `rotate(${s.angle}, 50, 50)`)

    public render(): VNode {
        return (
            <g display={this.display} transform={this.transform} id={this.props.id ?? ''}>
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

// interface BearingInfoPanelProps extends ComponentProps {
//     state: Subscribable<BearingState>
//     side: 'left' | 'right'
//     id?: string
// }

// /** The fixed corner panel listing a bearing pointer's source, ident, and distance. */
// class BearingInfoPanel extends DisplayComponent<BearingInfoPanelProps> {
//     private readonly display = this.props.state.map(s => (s.visible ? 'inherit' : 'none'))
//     private readonly dist = this.props.state.map(s => s.dist)
//     private readonly ident = this.props.state.map(s => s.ident)
//     private readonly source = this.props.state.map(s => s.source)

//     public render(): VNode {
//         return this.props.side === 'left' ? this.renderLeft() : this.renderRight()
//     }

//     private renderLeft(): VNode {
//         return (
//             <g display={this.display} id={this.props.id ?? ''}>
//                 <path
//                     d={textZonePath(-0.6, -1.1, -28)}
//                     fill={Colors.BLACK}
//                     stroke={Colors.LIGHT_GREY}
//                     stroke-width="0.5"
//                 />
//                 <text fill={Colors.WHITE} x="-27" y="100" font-size="6" text-anchor="start">
//                     {this.source}
//                 </text>
//                 <rect x="-5" y="96.875" width="15" height="0.25" fill={Colors.CYAN} />
//                 <rect
//                     x="-3"
//                     y="96.875"
//                     width="4"
//                     height="0.25"
//                     transform="rotate(-45 -3 97)"
//                     fill={Colors.CYAN}
//                 />
//                 <rect
//                     x="-3"
//                     y="96.875"
//                     width="4"
//                     height="0.25"
//                     transform="rotate(45 -3 97)"
//                     fill={Colors.CYAN}
//                 />
//             </g>
//         )
//     }

//     private renderRight(): VNode {
//         return (
//             <g display={this.display}>
//                 <path
//                     d={textZonePath(Math.PI + 0.6, Math.PI + 1.1, 128, true)}
//                     fill={Colors.BLACK}
//                     stroke={Colors.LIGHT_GREY}
//                     stroke-width="0.5"
//                 />
//                 <text fill={Colors.WHITE} x="127" y="100" font-size="6" text-anchor="end">
//                     {this.source}
//                 </text>
//                 <path
//                     d="M90 97 L92 97 M105 97 L103 97 L100 100 M103 97 L100 94 M101.5 98.5 L93 98.5 Q90 97 93 95.5 L101.5 95.5"
//                     stroke={Colors.CYAN}
//                     stroke-width="0.5"
//                     fill-opacity="0"
//                 />
//             </g>
//         )
//     }

//     public destroy(): void {
//         this.display.destroy()
//         this.dist.destroy()
//         this.ident.destroy()
//         this.source.destroy()
//         super.destroy()
//     }
// }

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
    activeSource: Subscribable<NavSource>
    navSourceLabel: Subscribable<NavSourceLabel>
    cdiVisible: Subscribable<boolean>
    noCenterText: boolean
    noBackground: boolean
    noAffectSimRadioNav: boolean
    bearing1State: Subscribable<BearingState>
    bearing2State: Subscribable<BearingState>
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
    private readonly apprHold = this.c(this.nav.on('ap_appr_hold'), false)
    private readonly approachType = this.c(this.nav.on('ap_approach_type'), 0)
    private readonly tacanDriven = this.c(this.nav.on('tacan_drives_nav1'), false)
    private readonly nav2Available = this.c(this.nav.on('nav2_available'), false)

    private readonly gpsActive = this.c(this.nav.on('gps_active_waypoint'), false)
    private readonly gpsDesiredTrack = this.c(this.nav.on('gps_wp_desired_track'), 0)
    private readonly gpsCrossTrack = this.c(this.nav.on('gps_wp_cross_track'), 0)
    private readonly gpsCdiScaling = this.c(this.nav.on('gps_cdi_scaling'), 0)
    private readonly gpsObsActive = this.c(this.nav.on('gps_obs_active'), false)

    private readonly cdiNeedle = this.c(this.nav.on('hsi_cdi_needle'), 0)

    private readonly dmeSource = this.c(this.nav.on('dme_source'), 1)
    private readonly dmeDisplayed = this.c(this.nav.on('dme_displayed'), false)

    private readonly cdiScaleLabel = this.c(
        this.props.bus.getSubscriber<G5NavdataEvents>().on('g5_cdi_scale_label'),
        CDIScaleLabel.Enroute
    )

    private readonly nav1 = this.subscribeNav(1)
    private readonly nav2 = this.subscribeNav(2)

    // ---- Resolved active nav source (consumed from NavSourceDataProvider) ----
    private readonly cdiSource = this.props.activeSource

    private readonly displayedCourse = this.track(
        MappedSubject.create(
            ([src, active, gpsTrk, course1, course2]) => {
                if (src === NavSource.GPS) return active ? gpsTrk : 0
                return src === NavSource.Nav1 ? course1 : course2
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
            ([src, tf1, tf2]) => (src === NavSource.GPS ? 1 : src === NavSource.Nav1 ? tf1 : tf2),
            this.cdiSource,
            this.navToFrom(this.nav1),
            this.navToFrom(this.nav2)
        )
    )

    // ---- Rotations and needle position ----
    private readonly roseTransform = this.track(
        this.magneticHeading.map(h => `rotate(${-h}, 50, 50)`)
    )
    private readonly headingBugTransform = this.track(
        this.headingSource.map(h => `rotate(${h}, 50, 50)`)
    )
    private readonly headingText = this.track(this.magneticHeading.map(formatHeading))
    private readonly courseTransform = this.track(
        this.displayedCourse.map(c => `rotate(${c}, 50, 50)`)
    )
    private readonly cdiTransform = this.track(
        this.cdiNeedle.map(n => `translate(${clamp((n / 127) * 30, -30, 30)}, 0)`)
    )
    private readonly cdiDisplay = this.track(this.props.cdiVisible.map(v => (v ? '' : 'none')))
    private readonly toVisible = this.track(this.toFrom.map(t => (t === 1 ? 'inherit' : 'none')))
    private readonly fromVisible = this.track(this.toFrom.map(t => (t === 2 ? 'inherit' : 'none')))

    // ---- Nav-source styling (NAV2 renders as a hollow lime pointer) ----
    private readonly navFill = this.track(
        this.props.navSourceLabel.map(s => (s === 'GPS' ? Colors.MAGENTA : Colors.GREEN))
    )
    private readonly navFillOpacity = this.track(
        this.props.navSourceLabel.map(s => (s.endsWith('2') ? '0' : '1'))
    )
    private readonly navStroke = this.track(
        this.props.navSourceLabel.map(s => (s.endsWith('2') ? Colors.GREEN : ''))
    )

    // ---- GPS-only annunciations ----
    private readonly phaseVisible = this.track(
        this.cdiSource.map(s => (s === NavSource.GPS ? 'visible' : 'hidden'))
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
                if (src !== NavSource.GPS) return 'hidden'
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

    private readonly innerCircleVisible = this.track(
        MappedSubject.create(
            ([b1, b2]) => (b1.visible || b2.visible ? 'inherit' : 'none'),
            this.props.bearing1State,
            this.props.bearing2State
        )
    )

    // ---- DME readout ----
    private readonly dmeDisplay = this.track(this.dmeDisplayed.map(d => (d ? 'inherit' : 'none')))
    private readonly dmeSourceLabel = this.track(this.dmeSource.map(s => 'NAV' + s))
    private readonly nav1Dme = this.navDme(this.nav1)
    private readonly nav2Dme = this.navDme(this.nav2)
    private readonly dmeIdent = this.track(
        MappedSubject.create(
            ([src, r1, r2]) => (src === 2 ? r2 : r1).ident,
            this.dmeSource,
            this.nav1Dme,
            this.nav2Dme
        )
    )
    private readonly dmeDist = this.track(
        MappedSubject.create(
            ([src, r1, r2]) => (src === 2 ? r2 : r1).dist,
            this.dmeSource,
            this.nav1Dme,
            this.nav2Dme
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
            hasLoc: on<boolean>(`nav${index}_has_loc`, false),
            localizer: on<number>(`nav${index}_localizer`, 0),
            obs: on<number>(`nav${index}_obs`, 0),
            toFrom: on<number>(`nav${index}_to_from`, 0),
            hasTacan: on<boolean>(`nav${index}_has_tacan`, false),
            tacanObs: on<number>(`nav${index}_tacan_obs`, 0),
            tacanToFrom: on<number>(`nav${index}_tacan_to_from`, 0),
            signal: on<number>(`nav${index}_signal`, 0),
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

    /** Handles the CRS/CDI/DME hardware knobs and softkeys routed by the MFD page. */
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
            case 'SoftKey_CDI':
            case 'NavSourceSwitch':
                this.cycleCdiSource()
                break
        }
    }

    private adjustCourse(direction: 1 | -1): void {
        const src = this.cdiSource.get()
        if (src === NavSource.Nav1) {
            SimVar.SetSimVarValue(
                direction > 0 ? 'K:VOR1_OBI_INC' : 'K:VOR1_OBI_DEC',
                SimVarValueType.Number,
                0
            )
        } else if (src === NavSource.Nav2) {
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
        if (src === NavSource.Nav1) {
            SimVar.SetSimVarValue(
                'K:VOR1_SET',
                SimVarValueType.Number,
                (180 + this.nav1.radial.get()) % 360
            )
        } else if (src === NavSource.Nav2) {
            SimVar.SetSimVarValue(
                'K:VOR2_SET',
                SimVarValueType.Number,
                (180 + this.nav2.radial.get()) % 360
            )
        }
    }

    private cycleCdiSource(): void {
        const order: NavSource[] = [NavSource.GPS, NavSource.Nav1, NavSource.Nav2]
        const currentIndex = order.indexOf(this.cdiSource.get())
        let nextIndex = (currentIndex + 1) % order.length
        if (order[nextIndex] === NavSource.Nav2 && !this.nav2Available.get()) {
            nextIndex = (nextIndex + 1) % order.length
        }
        const next = order[nextIndex]
        if ((next === NavSource.GPS) !== this.gpsDrivesNav1.get()) {
            SimVar.SetSimVarValue('K:TOGGLE_GPS_DRIVES_NAV1', SimVarValueType.Bool, 0)
        }
        if (next !== NavSource.GPS) {
            ;(Simplane as any).setAutoPilotSelectedNav(next === NavSource.Nav1 ? 1 : 2)
        }
    }

    render(): VNode {
        return (
            <svg class="hsi" width="100%" height="100%" viewBox={VIEWBOX}>
                <g transform={ASPECT_TRANSFORM}>
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

                        {
                            <>
                                <TrackIndicator trackAngle={this.trackAngle} />
                                <BearingPointer
                                    state={this.props.bearing1State}
                                    variant={1}
                                    id="BearingPointer1"
                                />
                                <BearingPointer
                                    state={this.props.bearing2State}
                                    variant={2}
                                    id="BearingPointer2"
                                />
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
                        }
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

                    {
                        <>
                            {!this.props.noCenterText && (
                                <CenterText
                                    navFill={this.navFill}
                                    navSource={this.props.navSourceLabel}
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
                        </>
                    }
                </g>
            </svg>
        )
    }
}
