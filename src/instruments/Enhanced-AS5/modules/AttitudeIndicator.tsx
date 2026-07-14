import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    NodeReference,
    EventBus,
    ConsumerSubject,
    MappedSubject,
    AhrsEvents,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'
import { Colors } from './Utils'

export interface TurnRateIndicatorProps extends ComponentProps {
    turnRate: Subscribable<number>
}

export class TurnRateIndicatorComponent extends DisplayComponent<TurnRateIndicatorProps> {
    private readonly barStyle: MappedSubject<[number], string>

    constructor(props: TurnRateIndicatorProps) {
        super(props)

        this.barStyle = MappedSubject.create(([r]) => {
            const clamped = Math.min(Math.max(r, -6), 6)
            const widthPct = (Math.abs(clamped) * 40) / 3
            const leftPct = clamped <= 0 ? 50 - widthPct : 50
            const borderRadius = clamped <= 0 ? '5px 0 0 5px' : '0 5px 5px 0'
            return `width: ${widthPct}%; left: ${leftPct}%; border-radius: ${borderRadius}`
        }, props.turnRate).pause()
    }

    destroy(): void {
        this.barStyle.destroy()
        super.destroy()
    }

    onAfterRender(): void {
        this.barStyle.resume()
    }

    render(): VNode {
        return (
            <div class="turn-rate-indicator-root">
                <div class="turn-rate-bar" style={this.barStyle}></div>
                <div class="turn-rate-left-marker"></div>
                <div class="turn-rate-right-marker"></div>
                <div class="turn-rate-center-marker"></div>
            </div>
        )
    }
}

export interface SlipSkidIndicatorProps extends ComponentProps {
    slipSkid: Subscribable<number>
}

export class SlipSkidIndicatorComponent extends DisplayComponent<SlipSkidIndicatorProps> {
    private readonly ballCx: MappedSubject<[number], number>

    constructor(props: SlipSkidIndicatorProps) {
        super(props)

        this.ballCx = MappedSubject.create(
            ([s]) => Math.min(Math.max(s, -1), 1) * 50,
            props.slipSkid
        ).pause()
    }

    destroy(): void {
        this.ballCx.destroy()
        super.destroy()
    }

    onAfterRender(): void {
        this.ballCx.resume()
    }

    render(): VNode {
        return (
            <svg
                class="slip-skid-indicator-root"
                width="100%"
                viewBox="-50 -12 100 24"
                overflow="visible"
            >
                <circle
                    class="slip-skid-ball"
                    cx={this.ballCx}
                    cy="0"
                    r="10"
                    fill={Colors.WHITE}
                    stroke={Colors.BLACK}
                />
                <rect
                    class="slip-skid-left-marker"
                    x="-12"
                    y="-12"
                    width="4"
                    height="24"
                    fill={Colors.WHITE}
                    stroke={Colors.BLACK}
                />
                <rect
                    class="slip-skid-right-marker"
                    x="12"
                    y="-12"
                    width="4"
                    height="24"
                    fill={Colors.WHITE}
                    stroke={Colors.BLACK}
                />
            </svg>
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
    private readonly horizonTopRef = FSComponent.createRef<SVGElement>()
    private readonly horizonBottomRef = FSComponent.createRef<SVGElement>()
    private readonly horizonSeparatorRef = FSComponent.createRef<SVGElement>()
    private readonly pitchGradationsRef = FSComponent.createRef<SVGElement>()
    private readonly bankGroupRef = FSComponent.createRef<SVGElement>()
    private readonly bankArcRef = FSComponent.createRef<SVGElement>()
    private readonly cursorLeftLowerRef = FSComponent.createRef<SVGElement>()
    private readonly cursorLeftUpperRef = FSComponent.createRef<SVGElement>()
    private readonly cursorRightLowerRef = FSComponent.createRef<SVGElement>()
    private readonly cursorRightUpperRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleInnerLeftRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleOuterLeftRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleInnerRightRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleOuterRightRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTopTriangleRef = FSComponent.createRef<SVGElement>()

    private pitchLeftTextRefs: NodeReference<SVGElement>[] = []
    private pitchRightTextRefs: NodeReference<SVGElement>[] = []

    // ConsumerSubjects from the EventBus — reactive values for geometry transforms
    private readonly pitch: ConsumerSubject<number>
    private readonly bank: ConsumerSubject<number>
    private readonly fdPitch: ConsumerSubject<number>
    private readonly fdBark: ConsumerSubject<number>
    private readonly fdActive: ConsumerSubject<boolean>
    private readonly maxBankValue: ConsumerSubject<number>

    // Derived Subscribables for declarative JSX attribute bindings
    private readonly rootTransform: MappedSubject<[number], string>
    private readonly horizonTransform: MappedSubject<[number], string>
    private readonly pitchTransform: MappedSubject<[number], string>
    private readonly fdVisibility: MappedSubject<[boolean], string>
    private readonly fdPitchTransform: MappedSubject<[number], string>
    private readonly fdBarkRotation: MappedSubject<[number], string>
    private readonly lowBankDisplay: MappedSubject<[number], string>
    private readonly lowBankMaskPath: MappedSubject<[number], string>
    private readonly lowBankColorDisplay: MappedSubject<[number], string>

    private readonly horizonTopColor = Colors.SKY_BLUE
    private readonly horizonBottomColor = Colors.GROUND_BROWN
    private readonly horizonTopColorLight = Colors.SKY_BLUE_LIGHT
    private readonly horizonBottomColorLight = Colors.GROUND_BROWN_LIGHT
    private readonly fontFamily = 'OpenSans-Bold'

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
        const sub = props.bus.getSubscriber<AhrsEvents & G5CustomEvents>()

        this.pitch = ConsumerSubject.create(sub.on('actual_pitch_deg').withPrecision(2), 0)
        this.bank = ConsumerSubject.create(sub.on('actual_roll_deg').withPrecision(2), 0)
        this.fdPitch = ConsumerSubject.create(sub.on('flight_director_pitch').withPrecision(2), 0)
        this.fdBark = ConsumerSubject.create(sub.on('flight_director_bank').withPrecision(2), 0)
        this.fdActive = ConsumerSubject.create(sub.on('flight_director_is_active'), false)
        this.maxBankValue = ConsumerSubject.create(sub.on('ap_max_bank_value').withPrecision(0), 30)

        const pitchScale = props.bankSizeRatio
        const radius = -this.topY

        // --- Derived transforms for declarative JSX bindings ---

        this.rootTransform = MappedSubject.create(([b]) => `rotate(${b})`, this.bank)

        this.pitchTransform = MappedSubject.create(
            ([p]) => `translate(0, ${p * pitchScale})`,
            this.pitch
        )

        // Sky/ground horizon shares the same pitch-driven translation as the pitch ladder
        this.horizonTransform = MappedSubject.create(
            ([p]) => `translate(0, ${p * pitchScale})`,
            this.pitch
        )

        this.fdVisibility = MappedSubject.create(([a]) => (a ? 'inherit' : 'none'), this.fdActive)

        this.fdPitchTransform = MappedSubject.create(
            ([p]) => `translate(0, ${p * pitchScale})`,
            this.fdPitch
        )

        this.fdBarkRotation = MappedSubject.create(([b]) => `rotate(${b})`, this.fdBark)

        this.lowBankDisplay = MappedSubject.create(
            ([m]) => (m < 20 ? 'inherit' : 'none'),
            this.maxBankValue
        )

        this.lowBankMaskPath = MappedSubject.create(
            ([m]) => (m < 20 ? `M0 ${-radius} h-200 v${2 * radius} h200 Z` : ''),
            this.maxBankValue
        )

        this.lowBankColorDisplay = MappedSubject.create(
            ([m]) => (m < 20 ? 'inherit' : 'none'),
            this.maxBankValue
        )
    }

    destroy(): void {
        this.pitch.destroy()
        this.bank.destroy()
        this.fdPitch.destroy()
        this.fdBark.destroy()
        this.fdActive.destroy()
        this.maxBankValue.destroy()

        super.destroy()
    }

    render(): VNode {
        this.pitchLeftTextRefs = []
        this.pitchRightTextRefs = []

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

                    {/* Root rotation group — bank angle rotates everything relative to the aircraft */}
                    <g transform={this.rootTransform}>
                        {/* Sky / ground / horizon line — moves with pitch */}
                        <g transform={this.horizonTransform}>
                            <rect
                                ref={this.horizonTopRef}
                                class="horizon-top"
                                fill="url(#skyGradient)"
                                x="-1000"
                                y="-1000"
                                width="2000"
                                height="2000"
                            />
                            <rect
                                ref={this.horizonBottomRef}
                                class="horizon-bottom"
                                fill="url(#groundGradient)"
                                x="-1500"
                                y="0"
                                width="3000"
                                height="3000"
                            />
                            <rect
                                ref={this.horizonSeparatorRef}
                                class="horizon-separator"
                                fill="white"
                                x="-1500"
                                y="-3"
                                width="3000"
                                height="4"
                            />
                        </g>

                        {/* Pitch ladder and flight director */}
                        <svg
                            class="attitude_pitch_container"
                            width="230"
                            height={`${this.pitchContainerHeight}`}
                            x="-115"
                            y={`${this.pitchContainerY}`}
                            viewBox={`-115 ${this.pitchContainerY} 230 ${this.pitchContainerHeight}`}
                            overflow="hidden"
                        >
                            <g
                                ref={this.pitchGradationsRef}
                                class="attitude_pitch"
                                transform={this.pitchTransform}
                            >
                                {this.buildPitchGraduations()}
                            </g>
                            {this.buildFlightDirector()}
                        </svg>

                        {/* Bank arc and reference marks */}
                        <g ref={this.bankGroupRef} class="attitude_bank">
                            {this.buildBankGroup()}
                        </g>

                        {this.buildLowBankMode()}
                    </g>
                    {this.buildCursors()}
                </svg>
            </div>
        )
    }

    private buildPitchGraduations(): VNode[] {
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
        const bankSizeRatio = this.bankSizeRatio

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
                    const leftTextRef = FSComponent.createRef<SVGElement>()
                    this.pitchLeftTextRefs.push(leftTextRef)
                    gradations.push(
                        <text
                            ref={leftTextRef}
                            class="attitude-pitch-left-text"
                            x={-width / 2 - 5}
                            y={bankSizeRatio * angle - height / 2 + fontSize / 2}
                            text-anchor="end"
                            font-size={`${fontSize}`}
                            font-family={this.fontFamily}
                            fill={Colors.WHITE}
                        >{`${Math.abs(angle)}`}</text>
                    )

                    const rightTextRef = FSComponent.createRef<SVGElement>()
                    this.pitchRightTextRefs.push(rightTextRef)
                    gradations.push(
                        <text
                            ref={rightTextRef}
                            class="attitude-pitch-right-text"
                            x={width / 2 + 5}
                            y={bankSizeRatio * angle - height / 2 + fontSize / 2}
                            text-anchor="start"
                            font-size={`${fontSize}`}
                            font-family={this.fontFamily}
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

    private buildFlightDirector(): VNode[] {
        return [
            <g class="flight-director" display={this.fdVisibility} transform={this.fdBarkRotation}>
                <path
                    class="flight-director-outer-left"
                    d="M-100 40 -100 20 0 0 -85 40 Z"
                    fill={Colors.MAGENTA}
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.fdPitchTransform}
                />
                <path
                    class="flight-director-outer-left-line"
                    d="M-100 20 L-85 40 Z"
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.fdPitchTransform}
                />
                <path
                    class="flight-director-outer-right"
                    d="M100 40 100 20 0 0 85 40 Z"
                    fill={Colors.MAGENTA}
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.fdPitchTransform}
                />
                <path
                    class="flight-director-outer-right-line"
                    d="M100 20 L85 40 Z"
                    stroke={Colors.BLACK}
                    stroke-width="1.5"
                    transform={this.fdPitchTransform}
                />
            </g>,
        ]
    }

    private buildBankGroup(): VNode[] {
        const topY = this.topY
        const radius = this.bankRadius
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
                ref={this.bankArcRef}
                class="attitude-arc"
                d={arcD}
                fill="none"
                stroke={Colors.WHITE}
                stroke-width="3"
            />
        )

        return children
    }

    private buildCursors(): VNode[] {
        const topY = this.topY

        return [
            <g class="cursors">
                <path
                    ref={this.cursorLeftLowerRef}
                    class="cursor-left-lower"
                    d="M-170 0 l0 5 l40 0 l10 -5 Z"
                    fill="#cccc00"
                    stroke="#000000"
                    stroke-width="1"
                />
                <path
                    ref={this.cursorLeftUpperRef}
                    class="cursor-left-upper"
                    d="M-170 0 l0 -5 l40 0 l10 5 Z"
                    fill={Colors.YELLOW}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                />
                <path
                    ref={this.cursorRightLowerRef}
                    class="cursor-right-lower"
                    d="M170 0 l0 5 l-40 0 l-10 -5 Z"
                    fill={Colors.CURSOR_YELLOW_DARK}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                />
                <path
                    ref={this.cursorRightUpperRef}
                    class="cursor-right-upper"
                    d="M170 0 l0 -5 l-40 0 l-10 5 Z"
                    fill={Colors.YELLOW}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleInnerLeftRef}
                    class="cursor-triangle-inner-left"
                    d="M-60 40 -38 40 L0 0 Z"
                    fill={Colors.CURSOR_YELLOW_DARK}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleOuterLeftRef}
                    class="cursor-triangle-outer-left"
                    d="M-85 40 -60 40 L0 0 Z"
                    fill={Colors.YELLOW}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleInnerRightRef}
                    class="cursor-triangle-inner-left"
                    d="M60 40 38 40 L0 0 Z"
                    fill={Colors.CURSOR_YELLOW_DARK}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleOuterRightRef}
                    class="cursor-triangle-outer-right"
                    d="M85 40 60 40 L0 0 Z"
                    fill={Colors.YELLOW}
                    stroke={Colors.BLACK}
                    stroke-width="1"
                />
            </g>,
            <path
                ref={this.cursorTopTriangleRef}
                class="cursor-top-triangle"
                d={`M0 ${topY} l-13 20 l26 0 Z`}
                fill="white"
            />,
        ]
    }

    private buildLowBankMode(): VNode[] {
        const radius = this.bankRadius

        return [
            <defs>
                <clipPath id="topMask">
                    <path d={this.lowBankMaskPath} />
                </clipPath>
            </defs>,
            <g clip-path="url(#topMask)" display={this.lowBankColorDisplay}>
                <circle
                    class="low-bank-green-arc"
                    cx="0"
                    cy="0"
                    r={`${radius}`}
                    fill="transparent"
                    stroke="green"
                    stroke-width="5"
                    display={this.lowBankDisplay}
                />
            </g>,
        ]
    }
}
