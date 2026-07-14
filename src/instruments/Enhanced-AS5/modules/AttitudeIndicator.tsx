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
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'
import { Colors } from './Utils'

const GF_FONT = 'OpenSans-Bold'

interface PitchLadderProps extends ComponentProps {
    /** SVG units per degree of pitch. */
    bankSizeRatio: number
    /** Pitch-driven translation shared with the horizon. */
    transform: Subscribable<string>
}

/** The pitch ladder — graduation marks, numeric labels, and unusual-attitude chevrons. */
class PitchLadder extends DisplayComponent<PitchLadderProps> {
    public render(): VNode {
        return (
            <g class="attitude_pitch" transform={this.props.transform}>
                {this.buildGraduations()}
            </g>
        )
    }

    private buildGraduations(): VNode[] {
        const gradations: VNode[] = []
        const maxDash = 80
        const fullPrecisionLowerLimit = -20
        const fullPrecisionUpperLimit = 20
        const halfPrecisionLowerLimit = -30
        const halfPrecisionUpperLimit = 45
        const unusualAttitudeLowerLimit = -30
        const unusualAttitudeUpperLimit = 50
        const bigWidth = 120
        const bigHeight = 3
        const mediumWidth = 60
        const mediumHeight = 3
        const smallWidth = 40
        const smallHeight = 2
        const fontSize = 20
        const bankSizeRatio = this.props.bankSizeRatio

        let angle = -maxDash
        let nextAngle: number

        while (angle <= maxDash) {
            let width: number
            let height: number
            let hasText: boolean

            if (angle % 10 == 0) {
                width = bigWidth
                height = bigHeight
                hasText = true
                if (angle >= fullPrecisionLowerLimit && angle < fullPrecisionUpperLimit) {
                    nextAngle = angle + 2.5
                } else if (angle >= halfPrecisionLowerLimit && angle < halfPrecisionUpperLimit) {
                    nextAngle = angle + 5
                } else {
                    nextAngle = angle + 10
                }
            } else {
                if (angle % 5 == 0) {
                    width = mediumWidth
                    height = mediumHeight
                    hasText = true
                    if (angle >= fullPrecisionLowerLimit && angle < fullPrecisionUpperLimit) {
                        nextAngle = angle + 2.5
                    } else {
                        nextAngle = angle + 5
                    }
                } else {
                    width = smallWidth
                    height = smallHeight
                    nextAngle = angle + 2.5
                    hasText = false
                }
            }

            if (angle != 0) {
                gradations.push(
                    <rect
                        class="attitude-pitch-gradation"
                        fill={Colors.WHITE}
                        x={-width / 2}
                        y={bankSizeRatio * angle - height / 2}
                        width={width}
                        height={height}
                    />
                )

                if (hasText) {
                    gradations.push(
                        <text
                            class="attitude-pitch-left-text"
                            x={-width / 2 - 5}
                            y={bankSizeRatio * angle - height / 2 + fontSize / 2}
                            text-anchor="end"
                            font-size={`${fontSize}`}
                            font-family={GF_FONT}
                            fill={Colors.WHITE}
                        >{`${Math.abs(angle)}`}</text>
                    )

                    gradations.push(
                        <text
                            class="attitude-pitch-right-text"
                            x={width / 2 + 5}
                            y={bankSizeRatio * angle - height / 2 + fontSize / 2}
                            text-anchor="start"
                            font-size={`${fontSize}`}
                            font-family={GF_FONT}
                            fill={Colors.WHITE}
                        >{`${Math.abs(angle)}`}</text>
                    )
                }

                if (angle < unusualAttitudeLowerLimit) {
                    let path = `M${-smallWidth / 2} ${bankSizeRatio * nextAngle - bigHeight / 2} l${smallWidth} 0 `
                    path += `L${bigWidth / 2} ${bankSizeRatio * angle - bigHeight / 2} l${-smallWidth} 0 `
                    path += `L0 ${bankSizeRatio * nextAngle + 20} `
                    path += `L${-bigWidth / 2 + smallWidth} ${bankSizeRatio * angle - bigHeight / 2} l${-smallWidth} 0 Z`
                    gradations.push(<path d={path} fill={Colors.RED} />)
                }

                if (angle >= unusualAttitudeUpperLimit && nextAngle <= maxDash) {
                    let path = `M${-smallWidth / 2} ${bankSizeRatio * angle - bigHeight / 2} l${smallWidth} 0 `
                    path += `L${bigWidth / 2} ${bankSizeRatio * nextAngle + bigHeight / 2} l${-smallWidth} 0 `
                    path += `L0 ${bankSizeRatio * angle - 20} `
                    path += `L${-bigWidth / 2 + smallWidth} ${bankSizeRatio * nextAngle + bigHeight / 2} l${-smallWidth} 0 Z`
                    gradations.push(<path d={path} fill={Colors.RED} />)
                }
            }
            angle = nextAngle
        }

        return gradations
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
        return (
            <g class="flight-director" display={this.visibility} transform={this.bankRotation}>
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
    /** Y of the top-of-arc pointer, in SVG units (negative = up). */
    topY: number
    /** Bank-arc radius, in SVG units. */
    radius: number
}

/** The static bank scale — top triangle, graduation dashes, and the roll arc. */
class BankScale extends DisplayComponent<BankScaleProps> {
    public render(): VNode {
        const topY = this.props.topY
        const radius = this.props.radius
        const bigDashes = [-60, -30, 30, 60]
        const smallDashes = [-45, -20, -10, 10, 20, 45]
        const arcRadius = 126

        const children: VNode[] = []

        children.push(
            <path
                class="attitude_bank_triangle"
                d={`M0 ${topY} l -10 -20 l20 0 Z`}
                fill={Colors.WHITE}
            />
        )

        const bigDashWidth = 3
        const bigDashHeight = 20
        for (let i = 0; i < bigDashes.length; i++) {
            children.push(
                <rect
                    class="attitude-arc-big-dash"
                    x={-bigDashWidth / 2}
                    y={-radius - bigDashHeight}
                    height={`${bigDashHeight}`}
                    width={`${bigDashWidth}`}
                    fill={Colors.WHITE}
                    transform={`rotate(${bigDashes[i]},0,0)`}
                />
            )
        }

        const smallDashWidth = 4
        const smallDashHeight = 12
        for (let i = 0; i < smallDashes.length; i++) {
            children.push(
                <rect
                    class="attitude-arc-small-dash"
                    x={-smallDashWidth / 2}
                    y={-radius - smallDashHeight}
                    height={`${smallDashHeight}`}
                    width={`${smallDashWidth}`}
                    fill={Colors.WHITE}
                    transform={`rotate(${smallDashes[i]},0,0)`}
                />
            )
        }

        const startX = -106
        const startY = -radius + 60
        const endX = 106
        const endY = -radius + 60
        const arcD = `M${startX} ${startY} A${arcRadius} ${arcRadius} 0 0 1 ${endX} ${endY}`
        children.push(
            <path
                class="attitude-arc"
                d={arcD}
                fill="none"
                stroke={Colors.WHITE}
                stroke-width="3"
            />
        )

        return <g class="attitude_bank">{children}</g>
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
                        fill="#cccc00"
                        stroke="#000000"
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
                        fill={Colors.CURSOR_YELLOW_DARK}
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
                        fill={Colors.CURSOR_YELLOW_DARK}
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
                        fill={Colors.CURSOR_YELLOW_DARK}
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
    verticalCenter: boolean
    bankSizeRatio: number
    isBackup: boolean
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

    get verticalCenter(): boolean {
        return this.props.verticalCenter
    }
    get bankSizeRatio(): number {
        return this.props.bankSizeRatio
    }
    get isBackup(): boolean {
        return this.props.isBackup
    }

    private get topY(): number {
        return this.verticalCenter ? -120 : -170
    }
    private get bankRadius(): number {
        return -this.topY
    }
    private get viewBox(): string {
        return this.verticalCenter ? '-200 -150 400 300' : '-200 -200 400 300'
    }
    private get pitchContainerY(): number {
        return this.verticalCenter ? -80 : -130
    }
    private get pitchContainerHeight(): number {
        return this.isBackup ? 330 : 230
    }

    constructor(props: AttitudeIndicatorComponentProps) {
        super(props)
        const sub = props.bus.getSubscriber<AhrsEvents>()

        this.pitch = ConsumerSubject.create(sub.on('actual_pitch_deg').withPrecision(2), 0).pause()
        this.bank = ConsumerSubject.create(sub.on('actual_roll_deg').withPrecision(2), 0).pause()

        const pitchScale = props.bankSizeRatio

        this.rootTransform = this.bank.map(b => `rotate(${b})`).pause()
        this.pitchTransform = this.pitch.map(p => `translate(0, ${p * pitchScale})`).pause()
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
                    viewBox={this.viewBox}
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
                            height={`${this.pitchContainerHeight}`}
                            x="-115"
                            y={`${this.pitchContainerY}`}
                            viewBox={`-115 ${this.pitchContainerY} 230 ${this.pitchContainerHeight}`}
                            overflow="hidden"
                        >
                            <PitchLadder
                                bankSizeRatio={this.bankSizeRatio}
                                transform={this.pitchTransform}
                            />
                            <FlightDirector bus={this.props.bus} pitchScale={this.bankSizeRatio} />
                        </svg>

                        <BankScale topY={this.topY} radius={this.bankRadius} />

                        <LowBankMode bus={this.props.bus} radius={this.bankRadius} />
                    </g>
                    <AircraftCursors topY={this.topY} />
                </svg>
            </div>
        )
    }
}
