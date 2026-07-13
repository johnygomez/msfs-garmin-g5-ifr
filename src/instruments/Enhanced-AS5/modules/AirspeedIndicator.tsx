import {
    ComponentProps,
    ConsumerSubject,
    DigitScroller,
    DisplayComponent,
    EventBus,
    FSComponent,
    MappedSubject,
    NodeReference,
    Subject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'

const GF_FONT = 'OpenSans-Bold'

/**
 * Vertical tape scale, in SVG viewBox units per knot. Together with the tape's
 * pixel scale this sets how much speed range is visible: larger values spread
 * the graduations further apart and show a tighter range. At the current column
 * width (~102px, `slice`-scaled) the visible window is roughly `854 / UNITS_PER_KT`
 * knots, so 12 ≈ 70 kt.
 */
const UNITS_PER_KT = 12

export interface AirspeedIndicatorComponentProps extends ComponentProps {
    bus: EventBus
    height: number
    noColor: boolean
    indicatedAirspeed: Subject<number>
    refSpeed: Subject<number>
    airspeedTrend: Subject<number>
    maxSpeed: Subject<number>
}

interface IASDisplayBoxProps extends ComponentProps {
    ias: Subscribable<number>
    isOffScale: Subscribable<boolean>
}

/**
 * The indicated-airspeed cursor readout. Rendered as an HTML overlay with
 * scrolling digit drums, analogous to the altimeter's IndicatedAltDisplayBox
 * and the G3X Touch AirspeedIasDisplayBox.
 */
class IASDisplayBox extends DisplayComponent<IASDisplayBoxProps> {
    private readonly scrollerRefs: NodeReference<DigitScroller>[] = []

    public render(): VNode {
        const hundredsScrollerRef = FSComponent.createRef<DigitScroller>()
        const tensScrollerRef = FSComponent.createRef<DigitScroller>()
        const onesScrollerRef = FSComponent.createRef<DigitScroller>()

        this.scrollerRefs.push(hundredsScrollerRef, tensScrollerRef, onesScrollerRef)

        return (
            <div
                class={{
                    'airspeed-ias-box': true,
                    'airspeed-ias-box-offscale': this.props.isOffScale,
                }}
            >
                <svg viewBox="0 0 82 72" class="airspeed-ias-box-bg" preserveAspectRatio="none">
                    <path
                        vector-effect="non-scaling-stroke"
                        d="M 75 0 L 75 29 L 82 36 L 75 43 L 75 72 L 50 72 L 50 54 L 0 54 L 0 18 L 50 18 L 50 0 Z"
                    />
                </svg>
                <div class="airspeed-ias-box-scrollers">
                    <div class="airspeed-ias-box-digit-container airspeed-ias-box-hundreds">
                        <DigitScroller
                            ref={hundredsScrollerRef}
                            value={this.props.ias}
                            base={10}
                            factor={100}
                            scrollThreshold={99}
                            renderDigit={(digit): string =>
                                digit === 0 ? ' ' : (Math.abs(digit) % 10).toString()
                            }
                        />
                        <div class="airspeed-ias-box-scroller-mask"></div>
                    </div>
                    <div class="airspeed-ias-box-digit-container airspeed-ias-box-tens">
                        <DigitScroller
                            ref={tensScrollerRef}
                            value={this.props.ias}
                            base={10}
                            factor={10}
                            scrollThreshold={9}
                            nanString="-"
                        />
                        <div class="airspeed-ias-box-scroller-mask"></div>
                    </div>
                    <div class="airspeed-ias-box-digit-container airspeed-ias-box-ones">
                        <DigitScroller
                            ref={onesScrollerRef}
                            value={this.props.ias}
                            base={10}
                            factor={1}
                            nanString="-"
                        />
                        <div class="airspeed-ias-box-scroller-mask"></div>
                    </div>
                </div>
            </div>
        )
    }

    public destroy(): void {
        for (const ref of this.scrollerRefs) {
            ref.getOrDefault()?.destroy()
        }

        super.destroy()
    }
}

interface AirspeedTrendVectorProps extends ComponentProps {
    /** Trend in knots per second. */
    trend: Subscribable<number>
    /** Vertical centre of the tape, in tape pixels. */
    center: number
}

/** The magenta acceleration-trend bar drawn alongside the tape cursor. */
class AirspeedTrendVector extends DisplayComponent<AirspeedTrendVectorProps> {
    private static readonly MAX_LENGTH_PX = 120

    private readonly barY: MappedSubject<[number], number>
    private readonly barHeight: MappedSubject<[number], number>

    constructor(props: AirspeedTrendVectorProps) {
        super(props)

        const clampedLength = props.trend.map(t =>
            Math.min(
                Math.max(t * UNITS_PER_KT, -AirspeedTrendVector.MAX_LENGTH_PX),
                AirspeedTrendVector.MAX_LENGTH_PX
            )
        )
        this.barY = MappedSubject.create(([len]) => props.center - len / 2, clampedLength)
        this.barHeight = MappedSubject.create(([len]) => Math.abs(len), clampedLength)
    }

    public destroy(): void {
        this.barY.destroy()
        this.barHeight.destroy()
        super.destroy()
    }

    public render(): VNode {
        return <rect x="200" y={this.barY} width="8" height={this.barHeight} fill="#d12bc7" />
    }
}

interface SelectedSpeedBugProps extends ComponentProps {
    ias: Subscribable<number>
    refSpeed: Subscribable<number>
    /** Vertical centre of the tape, in tape pixels. */
    center: number
}

/** The cyan reference-speed bug that rides the airspeed tape. */
class SelectedSpeedBug extends DisplayComponent<SelectedSpeedBugProps> {
    private readonly transform: MappedSubject<[number, number], string>

    constructor(props: SelectedSpeedBugProps) {
        super(props)

        this.transform = MappedSubject.create(
            ([ias, ref]) => `translate(0, ${(ias - ref) * UNITS_PER_KT})`,
            props.ias,
            props.refSpeed
        )
    }

    public destroy(): void {
        this.transform.destroy()
        super.destroy()
    }

    public render(): VNode {
        const c = this.props.center
        return (
            <polygon
                points={`200,${c - 20} 180,${c - 20} 180,${c - 15} 190,${c} 180,${c + 15} 180,${c + 20} 200,${c + 20}`}
                fill="#36c8d2"
                transform={this.transform}
            />
        )
    }
}

interface GroundSpeedDisplayProps extends ComponentProps {
    bus: EventBus
}

/** The fixed ground-speed readout overlaid at the bottom of the airspeed column. */
class GroundSpeedDisplay extends DisplayComponent<GroundSpeedDisplayProps> {
    private readonly gs: ConsumerSubject<number>

    constructor(props: GroundSpeedDisplayProps) {
        super(props)

        const sub = props.bus.getSubscriber<G5CustomEvents>()
        this.gs = ConsumerSubject.create(sub.on('ground_speed').withPrecision(0), 0)
    }

    public destroy(): void {
        this.gs.destroy()
        super.destroy()
    }

    public render(): VNode {
        return (
            <div class="airspeed-gs-box">
                <span class="airspeed-gs-box-label">GS</span>
                <span class="airspeed-gs-box-value">
                    {this.gs.map(g => fastToFixed(g, 0) + 'KT')}
                </span>
            </div>
        )
    }
}

export class AirspeedIndicatorComponent extends DisplayComponent<AirspeedIndicatorComponentProps> {
    private greenBegin = 0
    private greenEnd = 0
    private flapsBegin = 0
    private flapsEnd = 0
    private yellowBegin = 0
    private yellowEnd = 0
    private redBegin = 0
    private redEnd = 0
    private maxValue = 0
    private vyseValue = 0
    private vmcValue = 0

    private readonly height: number
    private readonly centerY: number

    /** Number of graduation marks per side of centre. */
    private readonly GRAD_COUNT = 8

    private readonly centerKt: MappedSubject<[number], number>
    private readonly iasBoxValue: MappedSubject<[number], number>
    private readonly isOffScale: MappedSubject<[number], boolean>
    private readonly tapeTransform: MappedSubject<[number, number], string>
    private readonly gradTextSubjects: MappedSubject<[number], string>[] = []

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

    /** Red barber-pole arc above the maximum speed. */
    private readonly endElementTransform: MappedSubject<[number, number, number], string>

    private barY(speed: number, ck: number): number {
        return Math.min(Math.max(-100, this.centerY + -UNITS_PER_KT * (speed - ck)), this.height)
    }

    constructor(props: AirspeedIndicatorComponentProps) {
        super(props)

        this.height = props.height
        this.centerY = props.height / 2 - 50

        this.readDesignSpeeds()

        const ias = props.indicatedAirspeed

        this.centerKt = MappedSubject.create(([v]) => Math.max(Math.round(v / 10) * 10, 60), ias)

        this.iasBoxValue = MappedSubject.create(([v]) => Math.max(v, 20), ias)

        this.isOffScale = MappedSubject.create(
            ([v]) => this.maxValue > 0 && Math.max(v, 20) > this.maxValue,
            ias
        )

        this.tapeTransform = MappedSubject.create(
            ([v, ck]) => `translate(0, ${(Math.max(v, 20) - ck) * UNITS_PER_KT})`,
            ias,
            this.centerKt
        )

        const gradN = this.GRAD_COUNT
        for (let i = 0; i < gradN * 2 + 1; i++) {
            const idx = i - gradN
            this.gradTextSubjects.push(
                MappedSubject.create(([ck]) => fastToFixed(ck - idx * 10, 0), this.centerKt)
            )
        }

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

        this.endElementTransform = MappedSubject.create(
            ([v, ck, maxV]) => {
                const effectiveMax = maxV > 0 ? maxV : this.maxValue
                if (effectiveMax <= 0) return 'translate(0, 0)'
                const y =
                    100 +
                    Math.min(
                        Math.max(
                            (ck - effectiveMax + (this.height - 100) / (2 * UNITS_PER_KT)) *
                                UNITS_PER_KT,
                            -100
                        ),
                        this.height + 100
                    ) +
                    (v - ck) * UNITS_PER_KT
                return `translate(0, ${y})`
            },
            ias,
            this.centerKt,
            props.maxSpeed
        )
    }

    public destroy(): void {
        this.centerKt.destroy()
        this.iasBoxValue.destroy()
        this.isOffScale.destroy()
        this.tapeTransform.destroy()
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
        this.endElementTransform.destroy()

        this.gradTextSubjects.forEach(s => s.destroy())

        super.destroy()
    }

    private readDesignSpeeds(): void {
        try {
            const designSpeeds = Simplane.getDesignSpeeds()
            if (designSpeeds) {
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
        const height = this.props.height
        const noColor = this.props.noColor
        const refBarWidth = 25
        const center = height / 2

        return (
            <>
                <svg
                    class="airspeed-indicator"
                    width="100%"
                    height="100%"
                    viewBox={`0 0 250 ${height}`}
                    preserveAspectRatio="xMinYMid slice"
                >
                    <rect
                        x="0"
                        y="-62"
                        width="200"
                        height={height}
                        fill="#1a1d21"
                        fill-opacity="0.25"
                    />
                    <svg x="0" y="0" width="250" height={height} viewBox={`0 0 250 ${height}`}>
                        <g transform={this.tapeTransform}>
                            {!noColor && (
                                <>
                                    <rect
                                        x="175"
                                        y={this.redBarY}
                                        width={refBarWidth}
                                        height={this.redBarHeight}
                                        fill="red"
                                    />
                                    <rect
                                        x="175"
                                        y={this.yellowBarY}
                                        width={refBarWidth}
                                        height={this.yellowBarHeight}
                                        fill="yellow"
                                    />
                                    <rect
                                        x="175"
                                        y={this.greenBarY}
                                        width={refBarWidth}
                                        height={this.greenBarHeight}
                                        fill="green"
                                    />
                                    <rect
                                        x="190"
                                        y={this.flapsBarY}
                                        width={10}
                                        height={this.flapsBarHeight}
                                        fill="white"
                                    />
                                    <svg
                                        id="DASH"
                                        x="175"
                                        y="0"
                                        width={refBarWidth}
                                        height={height - 100}
                                        viewBox={`0 0 25 ${height - 100}`}
                                    >
                                        <g transform={this.endElementTransform}>
                                            <rect
                                                x="0"
                                                y={-(height + 200)}
                                                width={refBarWidth}
                                                height={height + 100}
                                                fill="white"
                                            />
                                            {this.buildDashLines(refBarWidth, 12.5)}
                                        </g>
                                    </svg>
                                    <rect
                                        id="vyse-pointer"
                                        x="170"
                                        y={this.vyseY}
                                        width="40"
                                        height="8"
                                        fill="cyan"
                                    />
                                    <rect
                                        id="vmc-pointer"
                                        x="170"
                                        y={this.vmcY}
                                        width="40"
                                        height="8"
                                        fill="red"
                                    />
                                </>
                            )}
                            {this.buildGraduations(center)}
                            <SelectedSpeedBug
                                ias={this.props.indicatedAirspeed}
                                refSpeed={this.props.refSpeed}
                                center={center}
                            />
                        </g>
                    </svg>
                    <AirspeedTrendVector trend={this.props.airspeedTrend} center={center} />
                </svg>
                <IASDisplayBox ias={this.iasBoxValue} isOffScale={this.isOffScale} />
                <GroundSpeedDisplay bus={this.props.bus} />
            </>
        )
    }

    private buildDashLines(width: number, dashHeight: number): VNode[] {
        const count = Math.round((this.height + 100) / 25) - 1
        return Array.from({ length: count }, (_, i) => (
            <rect
                x="0"
                y={-125 - 25 * i}
                width={width}
                height={dashHeight}
                transform="skewY(-30)"
                fill="red"
            />
        ))
    }

    private buildGraduations(center: number): VNode[] {
        const spacing = 10 * UNITS_PER_KT
        return Array.from({ length: this.GRAD_COUNT * 2 + 1 }, (_, i) => {
            const idx = i - this.GRAD_COUNT
            return (
                <g key={i}>
                    <rect
                        x="150"
                        y={center - 2 + spacing * idx}
                        height="4"
                        width="50"
                        fill="white"
                    />
                    {idx !== 0 && (
                        <rect
                            x="175"
                            y={center - 2 + spacing * idx + (idx < 0 ? spacing / 2 : -spacing / 2)}
                            height="4"
                            width="25"
                            fill="white"
                        />
                    )}
                    <text
                        x="140"
                        y={center + 20 + spacing * idx}
                        fill="white"
                        font-size="56"
                        text-anchor="end"
                        font-family={GF_FONT}
                        letter-spacing="8"
                    >
                        {this.gradTextSubjects[i].map(v => v)}
                    </text>
                </g>
            )
        })
    }
}
