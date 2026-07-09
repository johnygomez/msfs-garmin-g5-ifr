import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    NodeReference,
    Subject,
    EventBus,
    ConsumerSubject,
    MappedSubject,
    AdcEvents,
} from '@microsoft/msfs-sdk'
import { G5CustomEvents } from './G5CustomPublisher'

export class ReferenceBug {
    bug: any
    group: any
    text: any
}

export interface AirspeedIndicatorComponentProps extends ComponentProps {
    bus: EventBus
    height: number
    noColor: boolean
    indicatedAirspeed: Subject<number>
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

    // Legacy ref arrays — kept for compatibility
    private readonly endDigitRefs: NodeReference<SVGElement>[] = []
    private readonly gradTextRefs: NodeReference<SVGElement>[] = []

    // ConsumerSubjects from the EventBus — reactive values for TAS/mach/GS display
    private readonly tas: ConsumerSubject<number>
    private readonly machNumber: ConsumerSubject<number>
    private readonly gs: ConsumerSubject<number>

    // Design speeds for colored bands (read once from Simplane)
    private greenBegin = 0
    private greenEnd = 0
    private flapsBegin = 0
    private flapsEnd = 0
    private yellowBegin = 0
    private yellowEnd = 0
    private redBegin = 0
    private redEnd = 0
    private maxValue = 0
    private minValue = 0
    private vyseValue = 0
    private vmcValue = 0
    private height = 0
    private centerPx = 0
    private centerY = 0

    // --- Declarative MappedSubjects for JSX bindings ---

    /** Tape scroll transform. */
    private readonly tapeTransform: MappedSubject<[number], string>

    /** Graduation text labels (17 marks at 10-kt intervals, higher speeds at top).
     *  Generous count so the tape appears continuous — marks extend well beyond
     *  the visible viewport. */
    private readonly gradTextSubjects: MappedSubject<[number], string>[] = []

    /** Number of graduation marks above / below centre. */
    private readonly GRAD_COUNT = 8

    /** Cursor digit texts (hundreds + tens). */
    private readonly cursorHundredsText: MappedSubject<[number], string>
    private readonly cursorTensText: MappedSubject<[number], string>

    /** End-digit drum group transform. */
    private readonly endDigitTransform: MappedSubject<[number], string>

    /** End-digit drum text values (5 digits). */
    private readonly endDigitTextSubjects: MappedSubject<[number], string>[] = []

    /** Cursor fill color (red when off-scale, dark otherwise). */
    private readonly cursorFill: MappedSubject<[number], string>

    /** Selected-speed bug transform. */
    private readonly selectedBugTransform: MappedSubject<[number, number], string>

    /** Colored speed-range bars. */
    private readonly greenBarY: MappedSubject<[number], number>
    private readonly greenBarHeight: MappedSubject<[number], number>
    private readonly yellowBarY: MappedSubject<[number], number>
    private readonly yellowBarHeight: MappedSubject<[number], number>
    private readonly redBarY: MappedSubject<[number], number>
    private readonly redBarHeight: MappedSubject<[number], number>
    private readonly flapsBarY: MappedSubject<[number], number>
    private readonly flapsBarHeight: MappedSubject<[number], number>
    private readonly vyseY: MappedSubject<[number], number>
    private readonly vmcY: MappedSubject<[number], number>

    /** Start/end element transforms (white arc below min, red arc above max). */
    private readonly startElementTransform: MappedSubject<[number], string>
    private readonly endElementTransform: MappedSubject<[number, number], string>

    /** Trend vector. */
    private readonly trendY: MappedSubject<[number], number>
    private readonly trendHeight: MappedSubject<[number], number>

    /** Derived helpers — shared across multiple MappedSubjects. */

    /** Rounded center value in knots: `max(round(ias/10)*10, 60)`. */
    private readonly centerKt: MappedSubject<[number], number>

    /** Clamp helper: maps a speed to a bar y-position on the tape. */
    private barY(speed: number, ck: number): number {
        return Math.min(Math.max(-100, this.centerY + -10 * (speed - ck)), this.height)
    }

    constructor(props: AirspeedIndicatorComponentProps) {
        super(props)
        const sub = props.bus.getSubscriber<AdcEvents & G5CustomEvents>()

        this.tas = ConsumerSubject.create(sub.on('tas').withPrecision(0), 0)
        this.machNumber = ConsumerSubject.create(sub.on('mach_number').withPrecision(3), 0)
        this.gs = ConsumerSubject.create(sub.on('ground_speed').withPrecision(0), 0)

        this.height = props.height
        this.centerPx = (props.height - 100) / 2
        this.centerY = props.height / 2 - 100

        this.readDesignSpeeds()

        const ias = props.indicatedAirspeed
        const center = this.centerPx

        // --- Derived center value (shared) ---
        this.centerKt = MappedSubject.create(([v]) => Math.max(Math.round(v / 10) * 10, 60), ias)

        // --- Tape scroll transform (clamp IAS >= 20, per Thiago's original) ---
        this.tapeTransform = MappedSubject.create(
            ([v, ck]) => `translate(0, ${(Math.max(v, 20) - ck) * 10})`,
            ias,
            this.centerKt
        )

        // --- Graduation text labels (GRAD_COUNT * 2 + 1 marks, idx -GRAD_COUNT .. +GRAD_COUNT, 10-kt intervals) ---
        // Higher speeds at the TOP (G3X convention): idx=-GRAD_COUNT (top) = ck + GRAD_COUNT*10, idx=GRAD_COUNT (bottom) = ck - GRAD_COUNT*10
        const gradN = this.GRAD_COUNT
        for (let i = 0; i < gradN * 2 + 1; i++) {
            const idx = i - gradN
            this.gradTextSubjects.push(
                MappedSubject.create(([ck]) => fastToFixed(ck - idx * 10, 0), this.centerKt)
            )
        }

        // --- Cursor digits ---
        this.cursorHundredsText = MappedSubject.create(([v]) => {
            const r = Math.round(Math.max(v, 20))
            return `${Math.floor(r / 100) % 10}`
        }, ias)
        this.cursorTensText = MappedSubject.create(([v]) => {
            const r = Math.round(Math.max(v, 20))
            return `${Math.floor(r / 10) % 10}`
        }, ias)

        // --- End-digit drum ---
        this.endDigitTransform = MappedSubject.create(([v]) => {
            const value = Math.max(v, 20)
            const endValue = value % 10
            const endCenter = Math.round(endValue)
            return `translate(0, ${(endValue - endCenter) * 70})`
        }, ias)
        for (let i = -2; i <= 2; i++) {
            const idx = i
            this.endDigitTextSubjects.push(
                MappedSubject.create(([v]) => {
                    const value = Math.max(v, 20)
                    const endCenter = Math.round(value % 10)
                    return `${(endCenter + (2 - idx) + 10) % 10}`
                }, ias)
            )
        }

        // --- Cursor fill (red when off-scale) ---
        this.cursorFill = MappedSubject.create(([v]) => {
            const value = Math.max(v, 20)
            const offScale =
                (!props.noColor && this.minValue > 0 && value < this.minValue) ||
                (this.maxValue > 0 && value > this.maxValue)
            return offScale ? 'red' : '#1a1d21'
        }, ias)

        // --- Selected speed bug ---
        this.selectedBugTransform = MappedSubject.create(
            ([v, ref]) => `translate(0, ${(v - ref) * 10})`,
            ias,
            props.refSpeed
        )

        // --- Colored bars ---
        this.greenBarY = MappedSubject.create(([ck]) => this.barY(this.greenEnd, ck), this.centerKt)
        this.greenBarHeight = MappedSubject.create(
            ([ck]) => Math.max(0, this.barY(this.greenBegin, ck) - this.barY(this.greenEnd, ck)),
            this.centerKt
        )
        this.yellowBarY = MappedSubject.create(
            ([ck]) => this.barY(this.yellowEnd, ck),
            this.centerKt
        )
        this.yellowBarHeight = MappedSubject.create(
            ([ck]) => Math.max(0, this.barY(this.yellowBegin, ck) - this.barY(this.yellowEnd, ck)),
            this.centerKt
        )
        this.redBarY = MappedSubject.create(([ck]) => this.barY(this.redEnd, ck), this.centerKt)
        this.redBarHeight = MappedSubject.create(
            ([ck]) => Math.max(0, this.barY(this.redBegin, ck) - this.barY(this.redEnd, ck)),
            this.centerKt
        )
        this.flapsBarY = MappedSubject.create(([ck]) => this.barY(this.flapsEnd, ck), this.centerKt)
        this.flapsBarHeight = MappedSubject.create(
            ([ck]) => Math.max(0, this.barY(this.flapsBegin, ck) - this.barY(this.flapsEnd, ck)),
            this.centerKt
        )
        this.vyseY = MappedSubject.create(
            ([ck]) => this.barY(this.vyseValue, ck) - 4,
            this.centerKt
        )
        this.vmcY = MappedSubject.create(([ck]) => this.barY(this.vmcValue, ck) - 4, this.centerKt)

        // --- Start/end element transforms ---
        this.startElementTransform = MappedSubject.create(
            ([v, ck]) => {
                if (this.minValue <= 0) return 'translate(0, 0)'
                const y =
                    this.height +
                    200 +
                    (ck - this.minValue + (this.height - 100) / 20) * 10 +
                    (v - ck) * 10
                return `translate(0, ${y})`
            },
            ias,
            this.centerKt
        )
        this.endElementTransform = MappedSubject.create(
            ([v, ck, maxV]) => {
                const effectiveMax = maxV > 0 ? maxV : this.maxValue
                if (effectiveMax <= 0) return 'translate(0, 0)'
                const y =
                    100 +
                    Math.min(
                        Math.max((ck - effectiveMax + (this.height - 100) / 20) * 10, -100),
                        this.height + 100
                    ) +
                    (v - ck) * 10
                return `translate(0, ${y})`
            },
            ias,
            this.centerKt,
            props.maxSpeed
        )

        // --- Trend vector ---
        this.trendY = MappedSubject.create(([t]) => {
            const h = Math.min(Math.max(t * 10, -120), 120)
            return center - h / 2
        }, props.airspeedTrend)
        this.trendHeight = MappedSubject.create(
            ([t]) => Math.abs(Math.min(Math.max(t * 10, -120), 120)),
            props.airspeedTrend
        )
    }

    destroy(): void {
        this.tas.destroy()
        this.machNumber.destroy()
        this.gs.destroy()

        this.tapeTransform.destroy()
        this.centerKt.destroy()
        this.cursorHundredsText.destroy()
        this.cursorTensText.destroy()
        this.endDigitTransform.destroy()
        this.cursorFill.destroy()
        this.selectedBugTransform.destroy()
        this.greenBarY.destroy()
        this.greenBarHeight.destroy()
        this.yellowBarY.destroy()
        this.yellowBarHeight.destroy()
        this.redBarY.destroy()
        this.redBarHeight.destroy()
        this.flapsBarY.destroy()
        this.flapsBarHeight.destroy()
        this.vyseY.destroy()
        this.vmcY.destroy()
        this.startElementTransform.destroy()
        this.endElementTransform.destroy()
        this.trendY.destroy()
        this.trendHeight.destroy()

        this.gradTextSubjects.forEach(s => s.destroy())
        this.endDigitTextSubjects.forEach(s => s.destroy())

        super.destroy()
    }

    private readDesignSpeeds(): void {
        try {
            const designSpeeds = Simplane.getDesignSpeeds()
            if (designSpeeds) {
                this.minValue = 0
                this.greenBegin = designSpeeds.VS1 ?? 0
                this.greenEnd = designSpeeds.VNo ?? 0
                this.flapsBegin = designSpeeds.VS0 ?? 0
                this.flapsEnd = designSpeeds.VFe ?? 0
                this.yellowBegin = designSpeeds.VNo ?? 0
                this.yellowEnd = designSpeeds.VNe ?? 0
                this.redBegin = designSpeeds.VNe ?? 0
                this.redEnd = designSpeeds.VMax ?? 0
                this.maxValue = designSpeeds.VNe ?? 0
                if (isFinite(designSpeeds.Vyse)) this.vyseValue = designSpeeds.Vyse
                if (isFinite(designSpeeds.Vmc)) this.vmcValue = designSpeeds.Vmc
            }
        } catch (_e) {
            /* design speeds not available */
        }
    }

    public render(): VNode {
        this.gradTextRefs.length = 0
        const height = this.props.height
        const noColor = this.props.noColor
        const GF_font = 'OpenSans-Bold'
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

        // Build end-digit VNodes with reactive text
        this.endDigitRefs.length = 0
        const endDigitVNodes: VNode[] = []
        for (let i = 0; i < 5; i++) {
            const digitRef = FSComponent.createRef<SVGElement>()
            this.endDigitRefs.push(digitRef)
            const subject = this.endDigitTextSubjects[i]
            endDigitVNodes.push(
                <text
                    ref={digitRef}
                    x="0"
                    y={15 + endDigitSpace * (i - 2)}
                    fill="white"
                    font-size="62"
                    font-family={GF_font}
                >
                    {subject.map(v => v)}
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
                    <g ref={this.centerGroupRef} transform={this.tapeTransform}>
                        {!noColor && (
                            <>
                                <rect
                                    ref={this.redElementRef}
                                    x="175"
                                    y={this.redBarY}
                                    width={refBarWidth}
                                    height={this.redBarHeight}
                                    fill="red"
                                />
                                <rect
                                    ref={this.yellowElementRef}
                                    x="175"
                                    y={this.yellowBarY}
                                    width={refBarWidth}
                                    height={this.yellowBarHeight}
                                    fill="yellow"
                                />
                                <rect
                                    ref={this.greenElementRef}
                                    x="175"
                                    y={this.greenBarY}
                                    width={refBarWidth}
                                    height={this.greenBarHeight}
                                    fill="green"
                                />
                                <rect
                                    ref={this.flapsElementRef}
                                    x="187.5"
                                    y={this.flapsBarY}
                                    width={refBarWidth / 2}
                                    height={this.flapsBarHeight}
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
                                <g
                                    ref={this.startElementRef}
                                    transform={this.startElementTransform}
                                >
                                    <rect
                                        x="0"
                                        y={-(height + 200)}
                                        width={refBarWidth}
                                        height={height + 100}
                                        fill="white"
                                    />
                                    {...startRedLines}
                                </g>
                                <g ref={this.endElementRef} transform={this.endElementTransform}>
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
                                    y={this.vyseY}
                                    width="40"
                                    height="8"
                                    fill="cyan"
                                />
                                <rect
                                    ref={this.vmcElementRef}
                                    id="vmc-pointer"
                                    x="170"
                                    y={this.vmcY}
                                    width="40"
                                    height="8"
                                    fill="red"
                                />
                            </>
                        )}
                        {[...Array(this.GRAD_COUNT * 2 + 1)].map((_, i) => {
                            const idx = i - this.GRAD_COUNT
                            const gradTextRef = FSComponent.createRef<SVGElement>()
                            this.gradTextRefs.push(gradTextRef)
                            const gradSubject = this.gradTextSubjects[i]
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
                                        font-size="56"
                                        text-anchor="end"
                                        font-family={GF_font}
                                        letter-spacing="8"
                                    >
                                        {gradSubject.map(v => v)}
                                    </text>
                                </g>
                            )
                        })}
                        <polygon
                            ref={this.selectedSpeedBugRef}
                            points={`200,${center - 20} 180,${center - 20} 180,${center - 15} 190,${center} 180,${center + 15} 180,${center + 20} 200,${center + 20}`}
                            fill="#36c8d2"
                            transform={this.selectedBugTransform}
                        />
                    </g>
                </svg>
                <polygon
                    ref={this.cursorRef}
                    points={`205,${center} 180,${center - 20} 180,${center - 100} 120,${center - 100} 120,${center - 40} 10,${center - 40} 10,${center + 40} 120,${center + 40} 120,${center + 100} 180,${center + 100} 180,${center + 40} 180,${center + 20}`}
                    fill={this.cursorFill}
                    stroke="white"
                    stroke-width="3"
                />
                <rect
                    ref={this.trendElementRef}
                    x="200"
                    y={this.trendY}
                    width="8"
                    height={this.trendHeight}
                    fill="#d12bc7"
                />
                <svg x="0" y={center - 39} width="120" height="75" viewBox="0 0 75 75">
                    <text
                        ref={this.digit1TopRef}
                        x="10"
                        y="-1"
                        fill="white"
                        font-size="68"
                        font-family={GF_font}
                    >
                        {this.cursorHundredsText.map(v => v)}
                    </text>
                    <text
                        ref={this.digit1BotRef}
                        x="10"
                        y="62"
                        fill="white"
                        font-size="68"
                        font-family={GF_font}
                    >
                        -
                    </text>
                    <text
                        ref={this.digit2TopRef}
                        x="54"
                        y="-1"
                        fill="white"
                        font-size="68"
                        font-family={GF_font}
                    >
                        {this.cursorTensText.map(v => v)}
                    </text>
                    <text
                        ref={this.digit2BotRef}
                        x="54"
                        y="62"
                        fill="white"
                        font-size="68"
                        font-family={GF_font}
                    >
                        -
                    </text>
                </svg>
                <svg x="122" y={center - 100} width="70" height="200" viewBox="0 -100 50 200">
                    <g ref={this.endDigitsGroupRef} transform={this.endDigitTransform}>
                        {...endDigitVNodes}
                    </g>
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
                    x="195"
                    y={height - 100 + 38}
                    fill="white"
                    font-size="35"
                    font-family={GF_font}
                    text-anchor="end"
                    display="none"
                >
                    {this.tas.map(t => fastToFixed(t, 0) + 'KT')}
                </text>
                <text
                    x="195"
                    y={height - 100 + 38}
                    fill="white"
                    font-size="35"
                    font-family={GF_font}
                    text-anchor="end"
                    display="none"
                >
                    {this.machNumber.map(
                        m => 'M ' + (m < 1 ? fastToFixed(m, 3).slice(1) : fastToFixed(m, 3))
                    )}
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
                    x="195"
                    y={height - 100 + 38}
                    fill="magenta"
                    font-size="38"
                    font-family={GF_font}
                    text-anchor="end"
                >
                    {this.gs.map(g => fastToFixed(g, 0) + 'KT')}
                </text>
            </svg>
        )
    }
}
