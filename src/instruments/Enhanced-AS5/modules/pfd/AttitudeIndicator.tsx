import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    EventBus,
    ConsumerSubject,
    MappedSubscribable,
    Subscribable,
    AhrsEvents,
    MappedSubject,
} from '@microsoft/msfs-sdk'

import { Colors } from '../common/Utils'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'

const GF_FONT = 'OpenSans-Bold'

/** Angles from `start` to `end` inclusive, in `step` increments. */
function angleRange(start: number, end: number, step: number): number[] {
    const count = Math.round((end - start) / step) + 1
    return Array.from({ length: count }, (_, i) => start + i * step)
}

interface PitchTickLabelsProps extends ComponentProps {
    /** Pitch angle, in degrees, being labelled. */
    angle: number
    tickWidth: number
    /** Top edge of the tick, in SVG units. */
    tickY: number
}

/** The numbers flanking a labelled graduation tick, one on each side. */
class PitchTickLabels extends DisplayComponent<PitchTickLabelsProps> {
    private static readonly FONT_SIZE = 20
    private static readonly GAP = 5

    public render(): VNode {
        const { angle, tickWidth, tickY } = this.props
        const label = `${Math.abs(angle)}`
        const baseline = tickY + PitchTickLabels.FONT_SIZE / 2

        return (
            <>
                <text
                    class="attitude-pitch-left-text"
                    x={-tickWidth / 2 - PitchTickLabels.GAP}
                    y={baseline}
                    text-anchor="end"
                    font-size={`${PitchTickLabels.FONT_SIZE}`}
                    font-family={GF_FONT}
                    fill={Colors.WHITE}
                >
                    {label}
                </text>
                <text
                    class="attitude-pitch-right-text"
                    x={tickWidth / 2 + PitchTickLabels.GAP}
                    y={baseline}
                    text-anchor="start"
                    font-size={`${PitchTickLabels.FONT_SIZE}`}
                    font-family={GF_FONT}
                    fill={Colors.WHITE}
                >
                    {label}
                </text>
            </>
        )
    }
}

interface PitchTickProps extends ComponentProps {
    /** Pitch angle, in degrees, marked by this tick. */
    angle: number
    /** SVG units per degree of pitch. */
    pitchScale: number
}

/** A single graduation tick, sized and labelled according to the angle it marks. */
class PitchTick extends DisplayComponent<PitchTickProps> {
    private static readonly LABEL_INTERVAL = 10
    private static readonly MINOR_INTERVAL = 5

    private static readonly BIG = { width: 120, height: 3 }
    private static readonly MEDIUM = { width: 60, height: 3 }
    private static readonly SMALL = { width: 40, height: 2 }

    private static sizeFor(angle: number): { width: number; height: number } {
        if (angle % PitchTick.LABEL_INTERVAL === 0) {
            return PitchTick.BIG
        }

        return angle % PitchTick.MINOR_INTERVAL === 0 ? PitchTick.MEDIUM : PitchTick.SMALL
    }

    public render(): VNode {
        const { angle, pitchScale } = this.props
        const { width, height } = PitchTick.sizeFor(angle)
        const y = pitchScale * angle - height / 2

        return (
            <>
                <rect
                    class="attitude-pitch-gradation"
                    fill={Colors.WHITE}
                    x={-width / 2}
                    y={y}
                    width={width}
                    height={height}
                />
                {angle % PitchTick.LABEL_INTERVAL === 0 ? (
                    <PitchTickLabels angle={angle} tickWidth={width} tickY={y} />
                ) : null}
            </>
        )
    }
}

interface UnusualAttitudeChevronProps extends ComponentProps {
    /** Pitch angle, in degrees, at the chevron's wide end. */
    angle: number
    /** SVG units per degree of pitch. */
    pitchScale: number
    direction: 'up' | 'down'
}

/** One red chevron of the unusual-attitude recovery guidance, pointing back towards the horizon. */
class UnusualAttitudeChevron extends DisplayComponent<UnusualAttitudeChevronProps> {
    /** Pitch angles, in degrees, spanned by one chevron. */
    public static readonly SPAN = 10

    private static readonly WIDTH = 120
    private static readonly THICKNESS = 3
    /** Width of the flat notch at the wide end, and of the barbs at the narrow end. */
    private static readonly NOTCH = 40
    private static readonly APEX_OVERSHOOT = 20

    public render(): VNode {
        const { angle, pitchScale, direction } = this.props
        const { WIDTH, THICKNESS, NOTCH, APEX_OVERSHOOT, SPAN } = UnusualAttitudeChevron

        const base = pitchScale * angle
        const tip = pitchScale * (angle + SPAN)
        const [wide, narrow, apex] =
            direction === 'down'
                ? [tip - THICKNESS / 2, base - THICKNESS / 2, tip + APEX_OVERSHOOT]
                : [base - THICKNESS / 2, tip + THICKNESS / 2, base - APEX_OVERSHOOT]

        const d =
            `M${-NOTCH / 2} ${wide} l${NOTCH} 0 ` +
            `L${WIDTH / 2} ${narrow} l${-NOTCH} 0 ` +
            `L0 ${apex} ` +
            `L${-WIDTH / 2 + NOTCH} ${narrow} l${-NOTCH} 0 Z`

        return <path class={`attitude-pitch-chevron-${direction}`} d={d} fill={Colors.RED} />
    }
}

interface PitchLadderProps extends ComponentProps {
    /** SVG units per degree of pitch. */
    pitchScale: number
    /** Pitch-driven translation shared with the horizon. */
    transform: Subscribable<string>
}

/** The pitch ladder — graduation marks, numeric labels, and unusual-attitude chevrons. */
class PitchLadder extends DisplayComponent<PitchLadderProps> {
    /** Outermost pitch angle, in degrees, drawn in either direction. */
    private static readonly LIMIT = 80
    /** Degrees, not SVG units — the on-screen spacing follows from `pitchScale`. */
    private static readonly TICK_STEP = 2.5

    /** Past these pitch angles the ladder gives way to chevrons. */
    private static readonly UNUSUAL_ATTITUDE_LOWER_LIMIT = -30
    private static readonly UNUSUAL_ATTITUDE_UPPER_LIMIT = 50

    private static readonly TICK_ANGLES = angleRange(
        -PitchLadder.LIMIT,
        PitchLadder.LIMIT,
        PitchLadder.TICK_STEP
    ).filter(angle => angle !== 0)

    private static readonly DOWN_CHEVRON_ANGLES = angleRange(
        -PitchLadder.LIMIT,
        PitchLadder.UNUSUAL_ATTITUDE_LOWER_LIMIT - UnusualAttitudeChevron.SPAN,
        UnusualAttitudeChevron.SPAN
    )

    private static readonly UP_CHEVRON_ANGLES = angleRange(
        PitchLadder.UNUSUAL_ATTITUDE_UPPER_LIMIT,
        PitchLadder.LIMIT - UnusualAttitudeChevron.SPAN,
        UnusualAttitudeChevron.SPAN
    )

    public render(): VNode {
        const pitchScale = this.props.pitchScale

        return (
            <g class="attitude_pitch" transform={this.props.transform}>
                {PitchLadder.TICK_ANGLES.map(angle => (
                    <PitchTick angle={angle} pitchScale={pitchScale} />
                ))}
                {PitchLadder.DOWN_CHEVRON_ANGLES.map(angle => (
                    <UnusualAttitudeChevron
                        angle={angle}
                        pitchScale={pitchScale}
                        direction="down"
                    />
                ))}
                {PitchLadder.UP_CHEVRON_ANGLES.map(angle => (
                    <UnusualAttitudeChevron angle={angle} pitchScale={pitchScale} direction="up" />
                ))}
            </g>
        )
    }
}

interface FlightDirectorProps extends ComponentProps {
    bus: EventBus
    /** SVG units per degree of pitch. */
    pitchScale: number
}

/** The magenta flight-director command bars. Owns its own FD bus subscriptions. */
class FlightDirector extends DisplayComponent<FlightDirectorProps> {
    private readonly fdPitch: ConsumerSubject<number>
    private readonly fdBank: ConsumerSubject<number>
    private readonly fdActive: ConsumerSubject<boolean>

    private readonly visibility: MappedSubscribable<string>
    private readonly bankRotation: MappedSubscribable<string>
    private readonly pitchTransform: MappedSubscribable<string>

    constructor(props: FlightDirectorProps) {
        super(props)
        const sub = props.bus.getSubscriber<AhrsEvents & G5CustomEvents>()

        this.fdPitch = ConsumerSubject.create(
            sub.on('flight_director_pitch').withPrecision(2),
            0
        ).pause()
        this.fdBank = ConsumerSubject.create(
            sub.on('flight_director_bank').withPrecision(2),
            0
        ).pause()
        this.fdActive = ConsumerSubject.create(sub.on('flight_director_is_active'), false).pause()

        const pitchScale = props.pitchScale
        this.visibility = this.fdActive.map(a => (a ? 'inherit' : 'none')).pause()
        this.bankRotation = this.fdBank.map(b => `rotate(${b})`).pause()
        this.pitchTransform = this.fdPitch.map(p => `translate(0, ${p * pitchScale})`).pause()
    }

    public onAfterRender(): void {
        this.fdPitch.resume()
        this.fdBank.resume()
        this.fdActive.resume()
        this.visibility.resume()
        this.bankRotation.resume()
        this.pitchTransform.resume()
        return
    }

    public destroy(): void {
        this.visibility.destroy()
        this.bankRotation.destroy()
        this.pitchTransform.destroy()
        this.fdPitch.destroy()
        this.fdBank.destroy()
        this.fdActive.destroy()
        super.destroy()
    }

    public render(): VNode {
        // NOTE: Until full AP support, the FD will not be functional, not to confuse the users.
        return (
            <g class="flight-director" transform={this.bankRotation} display="none">
                <path
                    class="flight-director-outer-left"
                    d="M-100 40 -100 20 0 0 -85 40 Z"
                    fill={Colors.MAGENTA}
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.pitchTransform}
                />
                <path
                    class="flight-director-outer-left-line"
                    d="M-100 20 L-85 40 Z"
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.pitchTransform}
                />
                <path
                    class="flight-director-outer-right"
                    d="M100 40 100 20 0 0 85 40 Z"
                    fill={Colors.MAGENTA}
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.pitchTransform}
                />
                <path
                    class="flight-director-outer-right-line"
                    d="M100 20 L85 40 Z"
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.pitchTransform}
                />
            </g>
        )
    }
}

interface BankScaleProps extends ComponentProps {
    /** Value of TAS is used to compute the rate 1 turn tick marks */
    tas: Subscribable<number>
    /** Bank-arc radius, in SVG units. The arc sits here and the dashes rise outward from it. */
    radius: number
    x?: number
    y?: number
}

/** The static bank scale — the roll arc, its graduation dashes, and the top pointer. */
class BankScale extends DisplayComponent<BankScaleProps> {
    private static readonly BIG_DASHES = [-60, -30, 30, 60]
    private static readonly SMALL_DASHES = [-45, -20, -10, 10, 20, 45]
    private static readonly BIG_DASH_WIDTH = 3
    private static readonly BIG_DASH_HEIGHT = 20
    private static readonly SMALL_DASH_WIDTH = 4
    private static readonly SMALL_DASH_HEIGHT = 12
    private static readonly STD_RATE_TICK_HEIGHT = 14

    /** Half-angle of the visible roll arc, in degrees (matches the outermost dashes). */
    private static readonly ARC_HALF_ANGLE = 60
    private static readonly POINTER_HALF_WIDTH = 10
    private static readonly POINTER_HEIGHT = 20

    /** Standard-rate (rate-1) turn: 3°/s, in rad/s. */
    private static readonly RATE_ONE_TURN_RATE = (3 * Math.PI) / 180
    private static readonly KNOTS_TO_MPS = 0.514444
    private static readonly GRAVITY = 9.80665

    private readonly rateOneTurnAngle: MappedSubject<[number], number>
    private readonly rateOneTurnLeftTransform: MappedSubscribable<string>
    private readonly rateOneTurnRightTransform: MappedSubscribable<string>

    constructor(props: BankScaleProps) {
        super(props)
        this.rateOneTurnAngle = MappedSubject.create(
            ([tas]) => this.computeRateOneTurnAngle(tas),
            props.tas
        ).pause()
        this.rateOneTurnLeftTransform = this.rateOneTurnAngle
            .map(angle => `rotate(${-angle})`)
            .pause()
        this.rateOneTurnRightTransform = this.rateOneTurnAngle
            .map(angle => `rotate(${angle})`)
            .pause()
    }

    onAfterRender(): void {
        this.rateOneTurnAngle.resume()
        this.rateOneTurnLeftTransform.resume()
        this.rateOneTurnRightTransform.resume()
    }

    destroy(): void {
        this.rateOneTurnAngle.destroy()
        this.rateOneTurnLeftTransform.destroy()
        this.rateOneTurnRightTransform.destroy()

        super.destroy()
    }

    private computeRateOneTurnAngle(tasKnots: number): number {
        const v = tasKnots * BankScale.KNOTS_TO_MPS
        const bankRad = Math.atan((v * BankScale.RATE_ONE_TURN_RATE) / BankScale.GRAVITY)
        return (bankRad * 180) / Math.PI
    }

    public render(): VNode {
        const radius = this.props.radius
        const arcAngle = (BankScale.ARC_HALF_ANGLE * Math.PI) / 180
        const arcX = radius * Math.sin(arcAngle)
        const arcY = -radius * Math.cos(arcAngle)
        // Concentric arc centred on the origin: bulges up to (0, -radius), passing
        // through the inner base of every dash so the scale reads as one piece.
        const arcD = `M${-arcX} ${arcY} A${radius} ${radius} 0 0 1 ${arcX} ${arcY}`
        const rateOneTurnPath = `M${-BankScale.STD_RATE_TICK_HEIGHT} ${-radius - BankScale.STD_RATE_TICK_HEIGHT} L${BankScale.STD_RATE_TICK_HEIGHT} ${-radius - BankScale.STD_RATE_TICK_HEIGHT} L0 ${-radius} Z`

        return (
            <g
                class="attitude_bank"
                transform={`translate(${this.props.x ?? 0}, ${this.props.y ?? 0})`}
            >
                <path
                    class="attitude-arc"
                    d={arcD}
                    fill="none"
                    stroke={Colors.WHITE}
                    stroke-width="3"
                />

                {BankScale.BIG_DASHES.map(angle => (
                    <rect
                        class="attitude-arc-big-dash"
                        x={-BankScale.BIG_DASH_WIDTH / 2}
                        y={-radius - BankScale.BIG_DASH_HEIGHT}
                        width={BankScale.BIG_DASH_WIDTH}
                        height={BankScale.BIG_DASH_HEIGHT}
                        fill={Colors.WHITE}
                        transform={`rotate(${angle},0,0)`}
                    />
                ))}

                {BankScale.SMALL_DASHES.map(angle => (
                    <rect
                        class="attitude-arc-small-dash"
                        x={-BankScale.SMALL_DASH_WIDTH / 2}
                        y={-radius - BankScale.SMALL_DASH_HEIGHT}
                        width={BankScale.SMALL_DASH_WIDTH}
                        height={BankScale.SMALL_DASH_HEIGHT}
                        fill={Colors.WHITE}
                        transform={`rotate(${angle},0,0)`}
                    />
                ))}

                <path
                    class="attitude-arc-rate-one-turn-left"
                    d={rateOneTurnPath}
                    fill={Colors.GREEN}
                    stroke={Colors.BLACK}
                    transform={this.rateOneTurnLeftTransform}
                    visibility={this.rateOneTurnAngle.map(a => (a > 7 ? 'inherit' : 'hidden'))}
                />

                <path
                    class="attitude-arc-rate-one-turn-right"
                    d={rateOneTurnPath}
                    fill={Colors.GREEN}
                    stroke={Colors.BLACK}
                    transform={this.rateOneTurnRightTransform}
                    visibility={this.rateOneTurnAngle.map(a => (a > 7 ? 'inherit' : 'hidden'))}
                />

                <path
                    class="attitude_bank_triangle"
                    d={`M${-BankScale.POINTER_HALF_WIDTH} ${-radius} L${BankScale.POINTER_HALF_WIDTH} ${-radius} L0 ${-radius + BankScale.POINTER_HEIGHT} Z`}
                    fill={Colors.WHITE}
                    transform={`translate(0, ${-BankScale.POINTER_HEIGHT})`}
                />
            </g>
        )
    }
}

interface AircraftCursorsProps extends ComponentProps {
    /** Y of the top-of-arc triangle, in SVG units (negative = up). */
    topY: number
}

/** The fixed aircraft-reference cursors and the top bank pointer. */
class AircraftCursors extends DisplayComponent<AircraftCursorsProps> {
    public render(): VNode {
        const topY = this.props.topY

        return (
            <>
                <g class="cursors">
                    <path
                        class="cursor-left-lower"
                        d="M-170 0 l0 5 l40 0 l10 -5 Z"
                        fill={Colors.DARK_YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                    <path
                        class="cursor-left-upper"
                        d="M-170 0 l0 -5 l40 0 l10 5 Z"
                        fill={Colors.YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                    <path
                        class="cursor-right-lower"
                        d="M170 0 l0 5 l-40 0 l-10 -5 Z"
                        fill={Colors.DARK_YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                    <path
                        class="cursor-right-upper"
                        d="M170 0 l0 -5 l-40 0 l-10 5 Z"
                        fill={Colors.YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                    <path
                        class="cursor-triangle-inner-left"
                        d="M-60 40 -38 40 L0 0 Z"
                        fill={Colors.DARK_YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                    <path
                        class="cursor-triangle-outer-left"
                        d="M-85 40 -60 40 L0 0 Z"
                        fill={Colors.YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                    <path
                        class="cursor-triangle-inner-left"
                        d="M60 40 38 40 L0 0 Z"
                        fill={Colors.DARK_YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                    <path
                        class="cursor-triangle-outer-right"
                        d="M85 40 60 40 L0 0 Z"
                        fill={Colors.YELLOW}
                        stroke={Colors.BLACK}
                        stroke-width="1"
                    />
                </g>
                <path class="cursor-top-triangle" d={`M0 ${topY} l-13 20 l26 0 Z`} fill="white" />
            </>
        )
    }
}

interface LowBankModeProps extends ComponentProps {
    bus: EventBus
    /** Bank-arc radius, in SVG units. */
    radius: number
}

/** The green low-bank limit arc, shown only when the AP max-bank setting is low. */
class LowBankMode extends DisplayComponent<LowBankModeProps> {
    private readonly maxBankValue: ConsumerSubject<number>

    private readonly display: MappedSubscribable<string>
    private readonly maskPath: MappedSubscribable<string>

    constructor(props: LowBankModeProps) {
        super(props)
        const sub = props.bus.getSubscriber<G5CustomEvents>()

        this.maxBankValue = ConsumerSubject.create(
            sub.on('ap_max_bank_value').withPrecision(0),
            30
        ).pause()

        const radius = props.radius
        this.display = this.maxBankValue.map(m => (m < 20 ? 'inherit' : 'none')).pause()
        this.maskPath = this.maxBankValue
            .map(m => (m < 20 ? `M0 ${-radius} h-200 v${2 * radius} h200 Z` : ''))
            .pause()
    }

    public onAfterRender(): void {
        this.maxBankValue.resume()
        this.display.resume()
        this.maskPath.resume()
    }

    public destroy(): void {
        this.display.destroy()
        this.maskPath.destroy()
        this.maxBankValue.destroy()
        super.destroy()
    }

    public render(): VNode {
        const radius = this.props.radius

        return (
            <>
                <defs>
                    <clipPath id="topMask">
                        <path d={this.maskPath} />
                    </clipPath>
                </defs>
                <g clip-path="url(#topMask)" display={this.display}>
                    <circle
                        class="low-bank-green-arc"
                        cx="0"
                        cy="0"
                        r={`${radius}`}
                        fill="transparent"
                        stroke="green"
                        stroke-width="5"
                    />
                </g>
            </>
        )
    }
}

export interface AttitudeIndicatorComponentProps extends ComponentProps {
    bus: EventBus
    tas: Subscribable<number>
}

export class AttitudeIndicatorComponent extends DisplayComponent<AttitudeIndicatorComponentProps> {
    private readonly pitch: ConsumerSubject<number>
    private readonly bank: ConsumerSubject<number>

    private readonly rootTransform: MappedSubscribable<string>
    private readonly pitchTransform: MappedSubscribable<string>

    private readonly horizonTopColor = Colors.SKY_BLUE
    private readonly horizonBottomColor = Colors.GROUND_BROWN
    private readonly horizonTopColorLight = Colors.SKY_BLUE_LIGHT
    private readonly horizonBottomColorLight = Colors.GROUND_BROWN_LIGHT

    private readonly TOP_Y = -145
    // Concentric with the roll pivot (the SVG origin): radius = |TOP_Y| puts the arc's
    // top at the pointer, so rotating about the origin reads true. This makes the mount
    // offset y = BANK_RADIUS + TOP_Y = 0.
    private readonly BANK_RADIUS = -this.TOP_Y
    private readonly VIEWBOX = '-200 -150 400 300'
    /** Kept clear of the bank arc at |TOP_Y|, which the ladder must not reach. */
    private readonly PITCH_CONTAINER_HALF_HEIGHT = 115
    private readonly PITCH_CONTAINER_Y = -this.PITCH_CONTAINER_HALF_HEIGHT
    private readonly PITCH_CONTAINER_HEIGHT = 2 * this.PITCH_CONTAINER_HALF_HEIGHT
    private readonly PITCH_SCALE = -8

    constructor(props: AttitudeIndicatorComponentProps) {
        super(props)
        const sub = props.bus.getSubscriber<AhrsEvents>()

        this.pitch = ConsumerSubject.create(sub.on('actual_pitch_deg').withPrecision(2), 0).pause()
        this.bank = ConsumerSubject.create(sub.on('actual_roll_deg').withPrecision(2), 0).pause()

        this.rootTransform = this.bank.map(b => `rotate(${b})`).pause()
        this.pitchTransform = this.pitch.map(p => `translate(0, ${p * this.PITCH_SCALE})`).pause()
    }

    onAfterRender(): void {
        this.pitch.resume()
        this.bank.resume()
        this.rootTransform.resume()
        this.pitchTransform.resume()
    }

    destroy(): void {
        this.rootTransform.destroy()
        this.pitchTransform.destroy()
        this.pitch.destroy()
        this.bank.destroy()

        super.destroy()
    }

    render(): VNode {
        return (
            <div class="attitude-indicator" style="position:relative; width:100%; height:100%;">
                <svg
                    class="attitude-root"
                    width="100%"
                    height="100%"
                    viewBox={this.VIEWBOX}
                    overflow="visible"
                    style="position:absolute"
                >
                    <defs>
                        <linearGradient id="skyGradient" gradientTransform="rotate(90)">
                            <stop offset="42%" stop-color={this.horizonTopColor} />
                            <stop offset="50%" stop-color={this.horizonTopColorLight} />
                            <stop offset="100%" stop-color={this.horizonTopColor} />
                        </linearGradient>
                        <linearGradient id="groundGradient" gradientTransform="rotate(90)">
                            <stop offset="0%" stop-color={this.horizonBottomColorLight} />
                            <stop offset="10%" stop-color={this.horizonBottomColor} />
                        </linearGradient>
                    </defs>

                    <g transform={this.rootTransform}>
                        <g transform={this.pitchTransform}>
                            <rect
                                class="horizon-top"
                                fill="url(#skyGradient)"
                                x="-1000"
                                y="-1000"
                                width="2000"
                                height="2000"
                            />
                            <rect
                                class="horizon-bottom"
                                fill="url(#groundGradient)"
                                x="-1500"
                                y="0"
                                width="3000"
                                height="3000"
                            />
                            <rect
                                class="horizon-separator"
                                fill="white"
                                x="-1500"
                                y="-3"
                                width="3000"
                                height="4"
                            />
                        </g>

                        <svg
                            class="attitude_pitch_container"
                            width="230"
                            height={`${this.PITCH_CONTAINER_HEIGHT}`}
                            x="-115"
                            y={`${this.PITCH_CONTAINER_Y}`}
                            viewBox={`-115 ${this.PITCH_CONTAINER_Y} 230 ${this.PITCH_CONTAINER_HEIGHT}`}
                            overflow="hidden"
                        >
                            <PitchLadder
                                pitchScale={this.PITCH_SCALE}
                                transform={this.pitchTransform}
                            />
                            <FlightDirector bus={this.props.bus} pitchScale={this.PITCH_SCALE} />
                        </svg>

                        <BankScale
                            tas={this.props.tas}
                            radius={this.BANK_RADIUS}
                            y={this.BANK_RADIUS + this.TOP_Y}
                        />

                        <LowBankMode bus={this.props.bus} radius={this.BANK_RADIUS} />
                    </g>
                    <AircraftCursors topY={this.TOP_Y} />
                </svg>
            </div>
        )
    }
}
