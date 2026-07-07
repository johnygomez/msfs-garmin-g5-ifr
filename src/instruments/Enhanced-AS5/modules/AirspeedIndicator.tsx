import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    NodeReference,
    Subject,
    Subscription,
} from '@microsoft/msfs-sdk'

export class ReferenceBug {
    bug: any
    group: any
    text: any
}

export interface AirspeedIndicatorComponentProps extends ComponentProps {
    height: number
    noColor: boolean
    indicatedAirspeed: Subject<number>
    trueAirspeed: Subject<number>
    groundSpeed: Subject<number>
    machSpeed: Subject<number>
    displayRefSpeed: Subject<string>
    refSpeedMach: Subject<number>
    refSpeed: Subject<number>
    airspeedTrend: Subject<number>
    maxSpeed: Subject<number>
    displayMach: Subject<boolean>
    noTrueAirspeed: Subject<boolean>
}

export class AirspeedIndicatorComponent extends DisplayComponent<AirspeedIndicatorComponentProps> {
    private readonly rootRef = FSComponent.createRef<SVGElement>()
    private readonly bottomBackgroundRef = FSComponent.createRef<SVGElement>()
    private readonly centerGroupRef = FSComponent.createRef<SVGElement>()
    private readonly centerSvgRef = FSComponent.createRef<SVGElement>()
    private readonly airspeedReferenceGroupRef = FSComponent.createRef<SVGElement>()
    private readonly selectedSpeedFixedBugRef = FSComponent.createRef<SVGElement>()
    private readonly selectedSpeedTextRef = FSComponent.createRef<SVGElement>()
    private readonly selectedSpeedTextMachRef = FSComponent.createRef<SVGElement>()
    private readonly cursorRef = FSComponent.createRef<SVGElement>()
    private readonly trendElementRef = FSComponent.createRef<SVGElement>()
    private readonly digit1TopRef = FSComponent.createRef<SVGElement>()
    private readonly digit1BotRef = FSComponent.createRef<SVGElement>()
    private readonly digit2TopRef = FSComponent.createRef<SVGElement>()
    private readonly digit2BotRef = FSComponent.createRef<SVGElement>()
    private readonly endDigitsGroupRef = FSComponent.createRef<SVGElement>()
    private readonly redElementRef = FSComponent.createRef<SVGElement>()
    private readonly yellowElementRef = FSComponent.createRef<SVGElement>()
    private readonly greenElementRef = FSComponent.createRef<SVGElement>()
    private readonly flapsElementRef = FSComponent.createRef<SVGElement>()
    private readonly startElementRef = FSComponent.createRef<SVGElement>()
    private readonly endElementRef = FSComponent.createRef<SVGElement>()
    private readonly vyseElementRef = FSComponent.createRef<SVGElement>()
    private readonly vmcElementRef = FSComponent.createRef<SVGElement>()
    private readonly selectedSpeedBugRef = FSComponent.createRef<SVGElement>()
    private readonly tasBackgroundRef = FSComponent.createRef<SVGElement>()
    private readonly tasTasTextRef = FSComponent.createRef<SVGElement>()
    private readonly tasTextRef = FSComponent.createRef<SVGElement>()
    private readonly machTextRef = FSComponent.createRef<SVGElement>()
    private readonly tasGsTextRef = FSComponent.createRef<SVGElement>()
    private readonly GSTextRef = FSComponent.createRef<SVGElement>()

    private readonly endDigitRefs: NodeReference<SVGElement>[] = []
    private readonly gradTextRefs: NodeReference<SVGElement>[] = []

    private readonly subs: Subscription[] = []

    private center: number = 0

    onAfterRender(): void {
        const height = this.props.height
        this.center = (height - 100) / 2

        this.subs.push(
            this.props.indicatedAirspeed.sub(ias => this.updateIASDisplay(ias), true),
            this.props.trueAirspeed.sub(tas => {
                const el = this.tasTextRef.getOrDefault()
                if (el) el.textContent = fastToFixed(tas, 0) + 'KT'
            }),
            this.props.groundSpeed.sub(gs => {
                const el = this.GSTextRef.getOrDefault()
                if (el) el.textContent = fastToFixed(gs, 0) + 'KT'
            }),
            this.props.machSpeed.sub(mach => {
                const el = this.machTextRef.getOrDefault()
                if (el)
                    el.textContent =
                        'M ' + (mach < 1 ? fastToFixed(mach, 3).slice(1) : fastToFixed(mach, 3))
            }),
            this.props.displayRefSpeed.sub(mode => this.updateRefSpeedDisplay(mode)),
            this.props.refSpeedMach.sub(refMach => {
                const el = this.selectedSpeedTextMachRef.getOrDefault()
                if (el)
                    el.textContent =
                        'M' +
                        (refMach < 1 ? fastToFixed(refMach, 3).slice(1) : fastToFixed(refMach, 3))
            }),
            this.props.refSpeed.sub(refSpd => {
                const el = this.selectedSpeedTextRef.getOrDefault()
                if (el) el.textContent = fastToFixed(refSpd, 0)
            }),
            this.props.airspeedTrend.sub(trend => {
                const el = this.trendElementRef.getOrDefault()
                if (el) {
                    const trendHeight = Math.min(Math.max(trend * 10, -120), 120)
                    el.setAttribute('y', `${this.center - trendHeight / 2}`)
                    el.setAttribute('height', `${Math.abs(trendHeight)}`)
                }
            }),
            this.props.maxSpeed.sub(maxSpd => {
                const el = this.endElementRef.getOrDefault()
                if (el) {
                    el.setAttribute(
                        'transform',
                        `translate(0, ${this.speedToY(maxSpd) - this.center})`
                    )
                }
            }),
            this.props.displayMach.sub(showMach => {
                const tasEl = this.tasTextRef.getOrDefault()
                const machEl = this.machTextRef.getOrDefault()
                const tasTasEl = this.tasTasTextRef.getOrDefault()
                if (tasEl) tasEl.setAttribute('display', showMach ? 'none' : 'inherit')
                if (machEl) machEl.setAttribute('display', showMach ? 'inherit' : 'none')
                if (tasTasEl) tasTasEl.setAttribute('display', showMach ? 'none' : 'inherit')
            }),
            this.props.noTrueAirspeed.sub(hide => {
                const tasEl = this.tasTextRef.getOrDefault()
                const tasTasEl = this.tasTasTextRef.getOrDefault()
                if (tasEl && hide) tasEl.setAttribute('display', 'none')
                if (tasTasEl && hide) tasTasEl.setAttribute('display', 'none')
            })
        )
    }

    destroy(): void {
        this.subs.forEach(s => s.destroy())
        super.destroy()
    }

    private speedToY(speed: number): number {
        return this.center - speed * 2
    }

    private updateIASDisplay(ias: number): void {
        const iasRounded = Math.round(ias)
        const tens = Math.floor(iasRounded / 10) % 10
        const ones = iasRounded % 10
        const hundreds = Math.floor(iasRounded / 100) % 10

        const d1t = this.digit1TopRef.getOrDefault()
        const d2t = this.digit2TopRef.getOrDefault()

        if (d1t) d1t.textContent = `${hundreds}`
        if (d2t) d2t.textContent = `${tens}`

        const endDigitGroup = this.endDigitsGroupRef.getOrDefault()
        if (endDigitGroup) {
            endDigitGroup.setAttribute('transform', `translate(0, ${-ones * 70})`)
        }

        const speedOffset = (ias % 100) * 2
        const centerGroup = this.centerGroupRef.getOrDefault()
        if (centerGroup) {
            centerGroup.setAttribute('transform', `translate(0, ${-speedOffset})`)
        }

        this.endDigitRefs.forEach((ref, i) => {
            const el = ref.getOrDefault()
            if (el) {
                const digit = (ones + (i - 2) + 10) % 10
                el.textContent = `${digit}`
            }
        })
    }

    private updateRefSpeedDisplay(mode: string): void {
        const speedText = this.selectedSpeedTextRef.getOrDefault()
        const speedTextMach = this.selectedSpeedTextMachRef.getOrDefault()
        const refGroup = this.airspeedReferenceGroupRef.getOrDefault()
        const fixedBug = this.selectedSpeedFixedBugRef.getOrDefault()

        switch (mode) {
            case 'Mach':
                if (speedText) speedText.setAttribute('display', 'none')
                if (speedTextMach) speedTextMach.setAttribute('display', 'inherit')
                if (refGroup) refGroup.setAttribute('fill-opacity', '0.25')
                if (fixedBug) fixedBug.setAttribute('fill-opacity', '0')
                break
            case 'True':
                if (speedText) speedText.setAttribute('display', 'inherit')
                if (speedTextMach) speedTextMach.setAttribute('display', 'none')
                if (refGroup) refGroup.setAttribute('fill-opacity', '0.25')
                if (fixedBug) fixedBug.setAttribute('fill-opacity', '0')
                break
            case 'False':
            default:
                if (speedText) speedText.setAttribute('display', 'none')
                if (speedTextMach) speedTextMach.setAttribute('display', 'none')
                if (refGroup) refGroup.setAttribute('fill-opacity', '1')
                if (fixedBug) fixedBug.setAttribute('fill-opacity', '1')
                break
        }
    }

    public render(): VNode {
        this.gradTextRefs.length = 0
        const height = this.props.height
        const noColor = this.props.noColor
        const GF_font = 'Montserrat-Bold'
        const refBarWidth = 25
        const endDigitSpace = 70
        const center = (height - 100) / 2

        const dashLineCount = Math.round((height + 100) / 25) - 1
        const startRedLines: VNode[] = []
        const endRedLines: VNode[] = []
        for (let i = 0; i < dashLineCount; i++) {
            startRedLines.push(
                <rect
                    x="0"
                    y={-125 - 25 * i}
                    width={refBarWidth}
                    height={refBarWidth / 2}
                    transform="skewY(-30)"
                    fill="red"
                />
            )
            endRedLines.push(
                <rect
                    x="0"
                    y={-125 - 25 * i}
                    width={refBarWidth}
                    height="12.5"
                    transform="skewY(-30)"
                    fill="red"
                />
            )
        }

        this.endDigitRefs.length = 0
        const endDigitVNodes: VNode[] = []
        for (let i = -2; i <= 2; i++) {
            const digitRef = FSComponent.createRef<SVGElement>()
            this.endDigitRefs.push(digitRef)
            endDigitVNodes.push(
                <text
                    ref={digitRef}
                    x="0"
                    y={15 + endDigitSpace * i}
                    fill="white"
                    font-size="58"
                    font-family={GF_font}
                >
                    {i === 0 ? '-' : ' '}
                </text>
            )
        }

        return (
            <svg
                ref={this.rootRef}
                class="airspeed-indicator"
                width="100%"
                height="100%"
                viewBox={`0 -50 250 ${height}`}
            >
                <g ref={this.airspeedReferenceGroupRef}>
                    <rect x="0" y="-50" width="200" height="50" fill="#1a1d21" fill-opacity="1" />
                    <polygon
                        ref={this.selectedSpeedFixedBugRef}
                        points="190,-40 180,-40 180,-30 185,-25 180,-20 180,-10 190,-10"
                        fill="#36c8d2"
                    />
                    <text
                        ref={this.selectedSpeedTextRef}
                        x="20"
                        y="-10"
                        fill="#36c8d2"
                        font-size="45"
                        font-family={GF_font}
                        text-anchor="start"
                        display="none"
                    >
                        ---
                    </text>
                    <text
                        ref={this.selectedSpeedTextMachRef}
                        x="20"
                        y="-10"
                        fill="#36c8d2"
                        font-size="45"
                        font-family={GF_font}
                        text-anchor="start"
                        display="none"
                    >
                        ---
                    </text>
                </g>
                <rect
                    ref={this.bottomBackgroundRef}
                    x="0"
                    y="-62"
                    width="200"
                    height={height + 50}
                    fill="#1a1d21"
                    fill-opacity="0.25"
                />
                <defs>
                    <linearGradient id="shadowGradient" gradientTransform="rotate(90)">
                        <stop offset="0%" stop-color="#000000" stop-opacity="0.8" />
                        <stop offset="10%" stop-color="#000000" stop-opacity="0" />
                        <stop offset="90%" stop-color="#000000" stop-opacity="0" />
                        <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
                    </linearGradient>
                    <linearGradient id="underShadowGradient" gradientTransform="rotate(90)">
                        <stop offset="0%" stop-color="rgb(0,0,0)" stop-opacity="0.8" />
                        <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0" />
                    </linearGradient>
                </defs>
                <svg
                    ref={this.centerSvgRef}
                    x="0"
                    y="0"
                    width="250"
                    height={height - 100}
                    viewBox={`0 0 250 ${height - 100}`}
                >
                    <g ref={this.centerGroupRef}>
                        {!noColor && (
                            <>
                                <rect
                                    ref={this.redElementRef}
                                    x="175"
                                    y="-1"
                                    width={refBarWidth}
                                    height="0"
                                    fill="red"
                                />
                                <rect
                                    ref={this.yellowElementRef}
                                    x="175"
                                    y="-1"
                                    width={refBarWidth}
                                    height="0"
                                    fill="yellow"
                                />
                                <rect
                                    ref={this.greenElementRef}
                                    x="175"
                                    y="-1"
                                    width={refBarWidth}
                                    height="0"
                                    fill="green"
                                />
                                <rect
                                    ref={this.flapsElementRef}
                                    x="187.5"
                                    y="-1"
                                    width={refBarWidth / 2}
                                    height="0"
                                    fill="white"
                                />
                            </>
                        )}
                        {!noColor && (
                            <svg
                                id="DASH"
                                x="175"
                                y="0"
                                width={refBarWidth}
                                height={height - 100}
                                viewBox={`0 0 25 ${height - 100}`}
                            >
                                <g ref={this.startElementRef}>
                                    <rect
                                        x="0"
                                        y={-(height + 200)}
                                        width={refBarWidth}
                                        height={height + 100}
                                        fill="white"
                                    />
                                    {...startRedLines}
                                </g>
                                <g ref={this.endElementRef}>
                                    <rect
                                        x="0"
                                        y={-(height + 200)}
                                        width={refBarWidth}
                                        height={height + 100}
                                        fill="white"
                                    />
                                    {...endRedLines}
                                </g>
                            </svg>
                        )}
                        {!noColor && (
                            <>
                                <rect
                                    ref={this.vyseElementRef}
                                    id="vyse-pointer"
                                    x="170"
                                    y="-1"
                                    width="40"
                                    height="8"
                                    fill="cyan"
                                />
                                <rect
                                    ref={this.vmcElementRef}
                                    id="vmc-pointer"
                                    x="170"
                                    y="-1"
                                    width="40"
                                    height="8"
                                    fill="red"
                                />
                            </>
                        )}
                        {[...Array(9)].map((_, i) => {
                            const idx = i - 4
                            const gradTextRef = FSComponent.createRef<SVGElement>()
                            this.gradTextRefs.push(gradTextRef)
                            return (
                                <g key={i}>
                                    <rect
                                        x="150"
                                        y={center - 2 + 100 * idx}
                                        height="4"
                                        width="50"
                                        fill="white"
                                    />
                                    {idx !== 0 && (
                                        <rect
                                            x="175"
                                            y={center - 2 + 100 * idx + (idx < 0 ? 50 : -50)}
                                            height="4"
                                            width="25"
                                            fill="white"
                                        />
                                    )}
                                    <text
                                        ref={gradTextRef}
                                        x="140"
                                        y={center + 20 + 100 * idx}
                                        fill="white"
                                        font-size="50"
                                        text-anchor="end"
                                        font-family={GF_font}
                                        letter-spacing="8"
                                    >
                                        XXX
                                    </text>
                                </g>
                            )
                        })}
                        <polygon
                            ref={this.selectedSpeedBugRef}
                            points={`200,${center - 20} 180,${center - 20} 180,${center - 15} 190,${center} 180,${center + 15} 180,${center + 20} 200,${center + 20}`}
                            fill="#36c8d2"
                        />
                    </g>
                </svg>
                <polygon
                    ref={this.cursorRef}
                    points={`205,${center} 180,${center - 20} 180,${center - 100} 120,${center - 100} 120,${center - 40} 10,${center - 40} 10,${center + 40} 120,${center + 40} 120,${center + 100} 180,${center + 100} 180,${center + 40} 180,${center + 20}`}
                    fill="#1a1d21"
                    stroke="white"
                    stroke-width="3"
                />
                <rect
                    ref={this.trendElementRef}
                    x="200"
                    y="-1"
                    width="8"
                    height="0"
                    fill="#d12bc7"
                />
                <svg x="0" y={center - 39} width="120" height="75" viewBox="0 0 75 75">
                    <text
                        ref={this.digit1TopRef}
                        x="10"
                        y="-1"
                        fill="white"
                        font-size="64"
                        font-family={GF_font}
                    >
                        -
                    </text>
                    <text
                        ref={this.digit1BotRef}
                        x="10"
                        y="62"
                        fill="white"
                        font-size="64"
                        font-family={GF_font}
                    >
                        -
                    </text>
                    <text
                        ref={this.digit2TopRef}
                        x="54"
                        y="-1"
                        fill="white"
                        font-size="64"
                        font-family={GF_font}
                    >
                        -
                    </text>
                    <text
                        ref={this.digit2BotRef}
                        x="54"
                        y="62"
                        fill="white"
                        font-size="64"
                        font-family={GF_font}
                    >
                        -
                    </text>
                </svg>
                <svg x="122" y={center - 100} width="70" height="200" viewBox="0 -100 50 200">
                    <g ref={this.endDigitsGroupRef}>{...endDigitVNodes}</g>
                </svg>
                <rect fill="url(#shadowGradient)" x="120" y={center - 98} width="60" height="198" />
                <rect fill="url(#underShadowGradient)" x="0" y="-50" width="200" height="30" />
                <rect
                    ref={this.tasBackgroundRef}
                    x="0"
                    y={height - 105}
                    width="200"
                    height="60"
                    fill="#1a1d21"
                    stroke="white"
                    stroke-width="2"
                />
                <text
                    ref={this.tasTasTextRef}
                    x="5"
                    y={height - 100 + 38}
                    fill="white"
                    font-size="35"
                    font-family={GF_font}
                    text-anchor="start"
                    display="none"
                >
                    TAS
                </text>
                <text
                    ref={this.tasTextRef}
                    x="195"
                    y={height - 100 + 38}
                    fill="white"
                    font-size="35"
                    font-family={GF_font}
                    text-anchor="end"
                    display="none"
                >
                    0KT
                </text>
                <text
                    ref={this.machTextRef}
                    x="195"
                    y={height - 100 + 38}
                    fill="white"
                    font-size="35"
                    font-family={GF_font}
                    text-anchor="end"
                    display="none"
                >
                    M .000
                </text>
                <text
                    ref={this.tasGsTextRef}
                    x="5"
                    y={height - 100 + 38}
                    fill="white"
                    font-size="32"
                    font-family={GF_font}
                    text-anchor="start"
                >
                    GS
                </text>
                <text
                    ref={this.GSTextRef}
                    x="195"
                    y={height - 100 + 38}
                    fill="magenta"
                    font-size="38"
                    font-family={GF_font}
                    text-anchor="end"
                >
                    0KT
                </text>
            </svg>
        )
    }
}
