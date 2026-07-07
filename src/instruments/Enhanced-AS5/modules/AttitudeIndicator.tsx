import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    NodeReference,
    Subject,
    Subscription,
} from '@microsoft/msfs-sdk'

export enum SlipSkidDisplayMode {
    ROUND = 0,
    DEFAULT = 1,
}

export interface AttitudeIndicatorComponentProps extends ComponentProps {
    verticalCenter: boolean
    bottomY: number
    slipSkidDisplayMode: SlipSkidDisplayMode
    showTurnRate: boolean
    bankSizeRatio: number
    isBackup: boolean
    pitch: Subject<number>
    bank: Subject<number>
    slipSkid: Subject<number>
    fdActive: Subject<boolean>
    fdPitch: Subject<number>
    fdBark: Subject<number>
    lowBankMode: Subject<boolean>
}

export class AttitudeIndicatorComponent extends DisplayComponent<AttitudeIndicatorComponentProps> {
    private readonly rootRef = FSComponent.createRef<SVGElement>()
    private readonly horizonGroupRef = FSComponent.createRef<SVGElement>()
    private readonly horizonTopRef = FSComponent.createRef<SVGElement>()
    private readonly horizonBottomRef = FSComponent.createRef<SVGElement>()
    private readonly horizonSeparatorRef = FSComponent.createRef<SVGElement>()
    private readonly pitchContainerRef = FSComponent.createRef<SVGElement>()
    private readonly pitchGradationsRef = FSComponent.createRef<SVGElement>()
    private readonly bankGroupRef = FSComponent.createRef<SVGElement>()
    private readonly bankArcRef = FSComponent.createRef<SVGElement>()
    private readonly flightDirectorRef = FSComponent.createRef<SVGElement>()
    private readonly flightDirectorOuterLeftRef = FSComponent.createRef<SVGElement>()
    private readonly flightDirectorOuterLeftLineRef = FSComponent.createRef<SVGElement>()
    private readonly flightDirectorOuterRightRef = FSComponent.createRef<SVGElement>()
    private readonly flightDirectorOuterRightLineRef = FSComponent.createRef<SVGElement>()
    private readonly slipSkidBallRef = FSComponent.createRef<SVGElement>()
    private readonly slipSkidLeftMarkerRef = FSComponent.createRef<SVGElement>()
    private readonly slipSkidRightMarkerRef = FSComponent.createRef<SVGElement>()
    private readonly turnRateIndicatorRef = FSComponent.createRef<SVGElement>()
    private readonly turnRateLeftMarkerRef = FSComponent.createRef<SVGElement>()
    private readonly turnRateRightMarkerRef = FSComponent.createRef<SVGElement>()
    private readonly turnRateCenterMarkerRef = FSComponent.createRef<SVGElement>()
    private readonly cursorLeftLowerRef = FSComponent.createRef<SVGElement>()
    private readonly cursorLeftUpperRef = FSComponent.createRef<SVGElement>()
    private readonly cursorRightLowerRef = FSComponent.createRef<SVGElement>()
    private readonly cursorRightUpperRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleInnerLeftRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleOuterLeftRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleInnerRightRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTriangleOuterRightRef = FSComponent.createRef<SVGElement>()
    private readonly cursorTopTriangleRef = FSComponent.createRef<SVGElement>()
    private readonly lowBankGreenArcRef = FSComponent.createRef<SVGElement>()
    private readonly bankingColorRef = FSComponent.createRef<SVGElement>()
    private readonly lowBankModeRef = FSComponent.createRef<SVGElement>()
    private readonly lowBankModeMaskRef = FSComponent.createRef<SVGElement>()

    private pitchLeftTextRefs: NodeReference<SVGElement>[] = []
    private pitchRightTextRefs: NodeReference<SVGElement>[] = []

    private readonly subs: Subscription[] = []

    private readonly horizonTopColor = '#3062C8'
    private readonly horizonBottomColor = '#864B01'
    private readonly horizonTopColorLight = '#5F8AE0'
    private readonly horizonBottomColorLight = '#A66C1D'
    private readonly fontFamily = 'Montserrat-Bold'

    get verticalCenter(): boolean {
        return this.props.verticalCenter
    }
    get bottomY(): number {
        return this.props.bottomY
    }
    get showTurnRate(): boolean {
        return this.props.showTurnRate
    }
    get bankSizeRatio(): number {
        return this.props.bankSizeRatio
    }
    get isBackup(): boolean {
        return this.props.isBackup
    }
    get slipSkidDisplayMode(): SlipSkidDisplayMode {
        return this.props.slipSkidDisplayMode
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

    onAfterRender(): void {
        const root = this.rootRef.getOrDefault()
        const pitchContainer = this.pitchContainerRef.getOrDefault()
        const slipSkidBall = this.slipSkidBallRef.getOrDefault()
        const flightDirector = this.flightDirectorRef.getOrDefault()
        const flightDirectorOuterLeft = this.flightDirectorOuterLeftRef.getOrDefault()
        const flightDirectorOuterLeftLine = this.flightDirectorOuterLeftLineRef.getOrDefault()
        const flightDirectorOuterRight = this.flightDirectorOuterRightRef.getOrDefault()
        const flightDirectorOuterRightLine = this.flightDirectorOuterRightLineRef.getOrDefault()
        const lowBankGreenArc = this.lowBankGreenArcRef.getOrDefault()
        const lowBankModeMask = this.lowBankModeMaskRef.getOrDefault()
        const slipSkidLeftMarker = this.slipSkidLeftMarkerRef.getOrDefault()
        const slipSkidRightMarker = this.slipSkidRightMarkerRef.getOrDefault()
        const lowBankMode = this.lowBankModeRef.getOrDefault()
        const bankingColor = this.bankingColorRef.getOrDefault()

        if (!root || !pitchContainer) return

        const pitchScale = this.bankSizeRatio

        this.subs.push(
            this.props.pitch.sub(pitch => {
                pitchContainer.setAttribute('transform', `translate(0, ${pitch * pitchScale})`)
            }, true),

            this.props.bank.sub(bank => {
                root.setAttribute('transform', `rotate(${bank})`)
            }, true),

            this.props.slipSkid.sub(slipSkid => {
                const clampedSkid = Math.min(Math.max(slipSkid, -1), 1)
                const offset = clampedSkid * 15
                if (slipSkidBall) {
                    slipSkidBall.setAttribute('cx', `${offset}`)
                }
                if (slipSkidLeftMarker) {
                    slipSkidLeftMarker.setAttribute('x', `${-15 + offset}`)
                }
                if (slipSkidRightMarker) {
                    slipSkidRightMarker.setAttribute('x', `${11 + offset}`)
                }
            }, true),

            this.props.fdActive.sub(active => {
                if (flightDirector) {
                    flightDirector.setAttribute('display', active ? 'inherit' : 'none')
                }
            }, true),

            this.props.fdPitch.sub(fdPitch => {
                const fdY = fdPitch * pitchScale
                if (flightDirectorOuterLeft)
                    flightDirectorOuterLeft.setAttribute('transform', `translate(0, ${fdY})`)
                if (flightDirectorOuterLeftLine)
                    flightDirectorOuterLeftLine.setAttribute('transform', `translate(0, ${fdY})`)
                if (flightDirectorOuterRight)
                    flightDirectorOuterRight.setAttribute('transform', `translate(0, ${fdY})`)
                if (flightDirectorOuterRightLine)
                    flightDirectorOuterRightLine.setAttribute('transform', `translate(0, ${fdY})`)
            }, true),

            this.props.fdBark.sub(fdBark => {
                if (flightDirector) {
                    flightDirector.setAttribute('transform', `rotate(${fdBark})`)
                }
            }, true),

            this.props.lowBankMode.sub(lowBank => {
                if (lowBankGreenArc) {
                    lowBankGreenArc.setAttribute('display', lowBank ? 'inherit' : 'none')
                }
                if (lowBankModeMask) {
                    lowBankModeMask.setAttribute('d', this.getLowBankMaskPath(lowBank))
                }
                if (lowBankMode && bankingColor) {
                    bankingColor.setAttribute('display', 'inherit')
                } else if (bankingColor) {
                    bankingColor.setAttribute('display', 'none')
                }
            }, true)
        )
    }

    destroy(): void {
        this.subs.forEach(s => s.destroy())
        super.destroy()
    }

    private getLowBankMaskPath(_enabled: boolean): string {
        const radius = this.bankRadius
        return `M0 ${-radius} h-200 v${2 * radius} h200 Z`
    }

    render(): VNode {
        this.pitchLeftTextRefs = []
        this.pitchRightTextRefs = []

        return (
            <div class="attitude-indicator" style="position:relative; width:100%; height:100%;">
                <svg
                    class="horizon-svg"
                    width="100%"
                    height="100%"
                    viewBox={this.viewBox}
                    x="-100"
                    y="-100"
                    overflow="visible"
                    style="position:absolute; z-index: -2; width: 100%; height:100%;"
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
                    <rect
                        ref={this.horizonTopRef}
                        class="horizon-top"
                        fill="url(#skyGradient)"
                        x="-1000"
                        y="-1000"
                        width="2000"
                        height="2000"
                    />
                    <g ref={this.horizonGroupRef}>
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
                </svg>
                <div id="Attitude" style="width:100%; height:100%; position:absolute">
                    <svg
                        ref={this.rootRef}
                        class="attitude-root"
                        width="100%"
                        height="100%"
                        viewBox={this.viewBox}
                        overflow="visible"
                        style="position:absolute"
                    >
                        <svg
                            ref={this.pitchContainerRef}
                            class="attitude_pitch_container"
                            width="230"
                            height={`${this.pitchContainerHeight}`}
                            x="-115"
                            y={`${this.pitchContainerY}`}
                            viewBox={`-115 ${this.pitchContainerY} 230 ${this.pitchContainerHeight}`}
                            overflow="hidden"
                        >
                            <g ref={this.pitchGradationsRef} class="attitude_pitch">
                                {this.buildPitchGraduations()}
                            </g>
                            {this.buildFlightDirector()}
                        </svg>
                        <g ref={this.bankGroupRef} class="attitude_bank">
                            {this.buildBankGroup()}
                        </g>
                        {this.buildTurnRateIndicator()}
                        {this.buildCursors()}
                        {this.buildSlipSkid()}
                        {this.buildLowBankMode()}
                    </svg>
                </div>
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
                        fill="white"
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
                            fill="white"
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
                            fill="white"
                        >{`${Math.abs(angle)}`}</text>
                    )
                }

                if (angle < unusualAttitudeLowerLimit) {
                    let path = `M${-smallWidth / 2} ${bankSizeRatio * nextAngle - bigHeight / 2} l${smallWidth} 0 `
                    path += `L${bigWidth / 2} ${bankSizeRatio * angle - bigHeight / 2} l${-smallWidth} 0 `
                    path += `L0 ${bankSizeRatio * nextAngle + 20} `
                    path += `L${-bigWidth / 2 + smallWidth} ${bankSizeRatio * angle - bigHeight / 2} l${-smallWidth} 0 Z`
                    gradations.push(<path d={path} fill="red" />)
                }

                if (angle >= unusualAttitudeUpperLimit && nextAngle <= maxDash) {
                    let path = `M${-smallWidth / 2} ${bankSizeRatio * angle - bigHeight / 2} l${smallWidth} 0 `
                    path += `L${bigWidth / 2} ${bankSizeRatio * nextAngle + bigHeight / 2} l${-smallWidth} 0 `
                    path += `L0 ${bankSizeRatio * angle - 20} `
                    path += `L${-bigWidth / 2 + smallWidth} ${bankSizeRatio * nextAngle + bigHeight / 2} l${-smallWidth} 0 Z`
                    gradations.push(<path d={path} fill="red" />)
                }
            }
            angle = nextAngle
        }

        return gradations
    }

    private buildFlightDirector(): VNode[] {
        return [
            <g ref={this.flightDirectorRef} class="flight-director">
                <path
                    ref={this.flightDirectorOuterLeftRef}
                    class="flight-director-outer-left"
                    d="M-100 40 -100 20 0 0 -85 40 Z"
                    fill="#d12bc7"
                    stroke="black"
                    stroke-width="1.5"
                />
                <path
                    ref={this.flightDirectorOuterLeftLineRef}
                    class="flight-director-outer-left-line"
                    d="M-100 20 L-85 40 Z"
                    stroke="black"
                    stroke-width="1.5"
                />
                <path
                    ref={this.flightDirectorOuterRightRef}
                    class="flight-director-outer-right"
                    d="M100 40 100 20 0 0 85 40 Z"
                    fill="#d12bc7"
                    stroke="black"
                    stroke-width="1.5"
                />
                <path
                    ref={this.flightDirectorOuterRightLineRef}
                    class="flight-director-outer-right-line"
                    d="M100 20 L85 40 Z"
                    stroke="black"
                    stroke-width="1.5"
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
            <path class="attitude_bank_triangle" d={`M0 ${topY} l -10 -20 l20 0 Z`} fill="white" />
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
                    fill="white"
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
                    fill="white"
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
                stroke="white"
                stroke-width="3"
            />
        )

        return children
    }

    private buildTurnRateIndicator(): VNode[] {
        if (!this.showTurnRate) {
            return []
        }

        const turnRateIndicatorY = this.bottomY - 15
        const turnRateIndicatorHeight = 15
        const markerW = 2
        const markerX = 80

        return [
            <g id="turnRateIndicator">
                <rect
                    ref={this.turnRateIndicatorRef}
                    class="turn-rate-indicator"
                    fill="#eb008b"
                    width="0"
                    height={`${turnRateIndicatorHeight}`}
                    x="0"
                    y={`${turnRateIndicatorY}`}
                />
                <rect
                    ref={this.turnRateLeftMarkerRef}
                    class="turn-rate-left-marker"
                    fill="white"
                    width={`${markerW}`}
                    height={`${turnRateIndicatorHeight}`}
                    x={`${-markerX - markerW / 2}`}
                    y={`${turnRateIndicatorY}`}
                />
                <rect
                    ref={this.turnRateRightMarkerRef}
                    class="turn-rate-right-marker"
                    fill="white"
                    width={`${markerW}`}
                    height={`${turnRateIndicatorHeight}`}
                    x={`${markerX - markerW / 2}`}
                    y={`${turnRateIndicatorY}`}
                />
                <rect
                    ref={this.turnRateCenterMarkerRef}
                    class="turn-rate-center-marker"
                    fill="black"
                    width="1"
                    height={`${turnRateIndicatorHeight}`}
                    x="-0.5"
                    y={`${turnRateIndicatorY}`}
                />
            </g>,
        ]
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
                    fill="#ffff00"
                    stroke="#000000"
                    stroke-width="1"
                />
                <path
                    ref={this.cursorRightLowerRef}
                    class="cursor-right-lower"
                    d="M170 0 l0 5 l-40 0 l-10 -5 Z"
                    fill="#cccc00"
                    stroke="#000000"
                    stroke-width="1"
                />
                <path
                    ref={this.cursorRightUpperRef}
                    class="cursor-right-upper"
                    d="M170 0 l0 -5 l-40 0 l-10 5 Z"
                    fill="#ffff00"
                    stroke="#000000"
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleInnerLeftRef}
                    class="cursor-triangle-inner-left"
                    d="M-60 40 -38 40 L0 0 Z"
                    fill="#cccc00"
                    stroke="#000000"
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleOuterLeftRef}
                    class="cursor-triangle-outer-left"
                    d="M-85 40 -60 40 L0 0 Z"
                    fill="#ffff00"
                    stroke="#000000"
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleInnerRightRef}
                    class="cursor-triangle-inner-left"
                    d="M60 40 38 40 L0 0 Z"
                    fill="#cccc00"
                    stroke="#000000"
                    stroke-width="1"
                />
                <path
                    ref={this.cursorTriangleOuterRightRef}
                    class="cursor-triangle-outer-right"
                    d="M85 40 60 40 L0 0 Z"
                    fill="#ffff00"
                    stroke="#000000"
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

    private buildSlipSkid(): VNode[] {
        const bottomY = this.bottomY
        const topY = this.topY

        switch (this.slipSkidDisplayMode) {
            case SlipSkidDisplayMode.ROUND: {
                const y = bottomY - 30
                return [
                    <g id="slipSkid">
                        <circle
                            ref={this.slipSkidBallRef}
                            class="slip-skid-ball"
                            cx="0"
                            cy={`${y}`}
                            r="10"
                            fill="white"
                            stroke="black"
                        />
                        <rect
                            ref={this.slipSkidLeftMarkerRef}
                            class="slip-skid-left-marker"
                            x="-15"
                            y={`${y - 11}`}
                            width="4"
                            height="22"
                            fill="white"
                            stroke="black"
                        />
                        <rect
                            ref={this.slipSkidRightMarkerRef}
                            class="slip-skid-right-marker"
                            x="11"
                            y={`${y - 11}`}
                            width="4"
                            height="22"
                            fill="white"
                            stroke="black"
                        />
                    </g>,
                ]
            }
            case SlipSkidDisplayMode.DEFAULT:
            default:
                return [
                    <path
                        ref={this.slipSkidBallRef}
                        id="slipSkid"
                        d={`M-20 ${topY + 30} l4 -6 h32 l4 6 Z`}
                        fill="white"
                    />,
                ]
        }
    }

    private buildLowBankMode(): VNode[] {
        const radius = this.bankRadius

        return [
            <defs>
                <clipPath id="topMask">
                    <path ref={this.lowBankModeMaskRef} />
                </clipPath>
            </defs>,
            <g ref={this.lowBankModeRef} clip-path="url(#topMask)">
                <circle
                    ref={this.lowBankGreenArcRef}
                    class="low-bank-green-arc"
                    cx="0"
                    cy="0"
                    r={`${radius}`}
                    fill="transparent"
                    stroke="green"
                    stroke-width="5"
                />
            </g>,
        ]
    }
}
