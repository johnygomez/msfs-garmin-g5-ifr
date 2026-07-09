import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    NodeReference,
    Subject,
    Subscription,
    EventBus,
    ConsumerSubject,
    MappedSubject,
    AdcEvents,
    Subscribable,
    DigitScroller,
    ObjectSubject,
    SubscribableMapFunctions,
    ArrayUtils,
    SubscribableUtils,
} from '@microsoft/msfs-sdk'
import { G5CustomEvents } from './G5CustomPublisher'

export interface AltimeterComponentProps extends ComponentProps {
    bus: EventBus
    height: number
    VSStyle: 'Default' | 'Compact'
    altitudeAlertState: Subject<string>
    referenceVspeed: Subject<string>
    verticalDeviationMode: Subject<string>
    verticalDeviationValue: Subject<number>
}

interface IndicatedAltDisplayBoxProps extends ComponentProps {
    /** Whether to show the display. */
    show: Subscribable<boolean>

    /** The indicated altitude value to display. */
    indicatedAlt: Subscribable<number>
}

class IndicatedAltDisplayBox extends DisplayComponent<IndicatedAltDisplayBoxProps> {
    private readonly scrollerRefs: NodeReference<DigitScroller>[] = []

    private readonly rootStyle = ObjectSubject.create({
        display: 'none',
    })

    private readonly indicatedAlt = this.props.indicatedAlt
        .map(SubscribableMapFunctions.identity())
        .pause()

    private readonly negativeSignHidden = ArrayUtils.create(3, index => {
        const topThreshold = index === 0 ? 0 : Math.pow(10, index + 1) - 20
        const bottomThreshold = Math.pow(10, index + 2) - 20

        return this.indicatedAlt.map(indicatedAlt => {
            return indicatedAlt >= -topThreshold || indicatedAlt < -bottomThreshold
        })
    })

    private showSub?: Subscription

    /** @inheritDoc */
    public onAfterRender(): void {
        this.showSub = this.props.show.sub(show => {
            if (show) {
                this.rootStyle.set('display', '')
                this.indicatedAlt.resume()
            } else {
                this.rootStyle.set('display', 'none')
                this.indicatedAlt.pause()
            }
        }, true)
    }

    /** @inheritDoc */
    public render(): VNode {
        const tensScrollerRef = FSComponent.createRef<DigitScroller>()
        const hundredsScrollerRef = FSComponent.createRef<DigitScroller>()
        const thousandsScrollerRef = FSComponent.createRef<DigitScroller>()
        const tenThousandsScrollerRef = FSComponent.createRef<DigitScroller>()

        this.scrollerRefs.push(
            tensScrollerRef,
            thousandsScrollerRef,
            hundredsScrollerRef,
            tenThousandsScrollerRef
        )

        return (
            <div class="altimeter-indicatedalt-box" style={this.rootStyle}>
                <svg
                    viewBox="0 0 88 60"
                    class="altimeter-indicatedalt-box-bg"
                    preserveAspectRatio="none"
                >
                    <path
                        vector-effect="non-scaling-stroke"
                        d="M 0 30 l 7 -7 v -6 c 0 -2.21 1.79 -4 4 -4 h 47 v -9 c 0 -2.21 1.79 -4 4 -4 h 22 c 2.21 0 4 1.79 4 4 v 52 c 0 2.21 -1.79 4 -4 4 h -22 c -2.21 0 -4 -1.79 -4 -4 v -8 h -47 c -2.21 0 -4 -1.79 -4 -4 v -7 l -7 -7 Z"
                    />
                </svg>
                <div class="altimeter-indicatedalt-box-scrollers">
                    <div class="altimeter-indicatedalt-box-digit-container altimeter-indicatedalt-box-ten-thousands">
                        <DigitScroller
                            ref={tenThousandsScrollerRef}
                            value={this.indicatedAlt}
                            base={10}
                            factor={10000}
                            scrollThreshold={9980}
                            renderDigit={(digit): string =>
                                digit === 0 ? ' ' : (Math.abs(digit) % 10).toString()
                            }
                        />
                        <div
                            class={{
                                'altimeter-indicatedalt-box-negative-sign': true,
                                hidden: this.negativeSignHidden[2],
                            }}
                        >
                            -
                        </div>
                    </div>
                    <div class="altimeter-indicatedalt-box-digit-container altimeter-indicatedalt-box-thousands">
                        <DigitScroller
                            ref={thousandsScrollerRef}
                            value={this.indicatedAlt}
                            base={10}
                            factor={1000}
                            scrollThreshold={980}
                            renderDigit={(digit): string =>
                                digit === 0 ? ' ' : (Math.abs(digit) % 10).toString()
                            }
                        />
                        <div
                            class={{
                                'altimeter-indicatedalt-box-negative-sign': true,
                                hidden: this.negativeSignHidden[1],
                            }}
                        >
                            -
                        </div>
                    </div>
                    <div class="altimeter-indicatedalt-box-digit-container altimeter-indicatedalt-box-hundreds">
                        <DigitScroller
                            ref={hundredsScrollerRef}
                            value={this.indicatedAlt}
                            base={10}
                            factor={100}
                            scrollThreshold={80}
                            renderDigit={(digit): string =>
                                digit === 0 ? ' ' : (Math.abs(digit) % 10).toString()
                            }
                        />
                        <div
                            class={{
                                'altimeter-indicatedalt-box-negative-sign': true,
                                hidden: this.negativeSignHidden[0],
                            }}
                        >
                            -
                        </div>
                    </div>
                    <div class="altimeter-indicatedalt-box-digit-container altimeter-indicatedalt-box-tens">
                        <DigitScroller
                            ref={tensScrollerRef}
                            value={this.indicatedAlt}
                            base={5}
                            factor={20}
                            renderDigit={(digit): string =>
                                ((Math.abs(digit) % 5) * 20).toString().padStart(2, '0')
                            }
                            nanString={'––'}
                        />
                        <div class="altimeter-indicatedalt-box-scroller-mask"></div>
                    </div>
                </div>
            </div>
        )
    }

    /** @inheritDoc */
    public destroy(): void {
        for (const hidden of this.negativeSignHidden) {
            hidden.destroy()
        }

        for (const ref of this.scrollerRefs) {
            ref.getOrDefault()?.destroy()
        }

        this.indicatedAlt.destroy()

        this.showSub?.destroy()

        super.destroy()
    }
}

export class AltimeterComponent extends DisplayComponent<AltimeterComponentProps> {
    private readonly rootRef = FSComponent.createRef<SVGElement>()
    private readonly indicatedAltBoxRef = FSComponent.createRef<IndicatedAltDisplayBox>()
    private readonly minimumAltitudeBugRef = FSComponent.createRef<SVGElement>()
    private readonly trendElementRef = FSComponent.createRef<SVGElement>()
    private readonly verticalDeviationTextRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineBackgroundRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineScaleRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineAltRef = FSComponent.createRef<SVGElement>()
    private readonly bugsGroupRef = FSComponent.createRef<SVGElement>()
    private readonly selectedAltitudeFixedBugRef = FSComponent.createRef<SVGElement>()
    private readonly pressureBackgroundRef = FSComponent.createRef<SVGElement>()
    private readonly selectedVSBugRef = FSComponent.createRef<SVGElement>()
    private readonly selectedVSBackgroundRef = FSComponent.createRef<SVGElement>()
    private readonly indicatorTextRef = FSComponent.createRef<SVGElement>()

    private gradTextRefs: NodeReference<SVGElement>[] = []
    private gradRectRefs: NodeReference<SVGElement>[] = []

    private readonly gradCount: number

    // --- G3X‑style tape layout ---
    /** Visible altitude window in feet (maps to the pixel height of the tape viewport). */
    private readonly ALT_WINDOW_FT = 400
    /** Feet between labelled major ticks. */
    private readonly MAJOR_TICK_INTERVAL = 100
    /** Number of minor intervals per major-tick span (minor ticks every MAJOR_TICK_INTERVAL / MINOR_TICK_FACTOR ft). */
    private readonly MINOR_TICK_FACTOR = 5

    /** Total altitude range the tape covers (ft). */
    private readonly TAPE_FT: number
    /** Number of major (labelled) ticks on the tape. */
    private readonly MAJOR_TICK_COUNT: number
    /** Pixel height of the visible tape window. */
    private readonly TAPE_WINDOW_PX: number
    /** Pixels per foot on the tape. */
    private readonly PX_PER_FT: number

    // ConsumerSubjects from the EventBus
    private readonly indicatedAlt: ConsumerSubject<number>
    private readonly baroSetting: ConsumerSubject<number>
    private readonly verticalSpd: ConsumerSubject<number>
    private readonly refAltitude: ConsumerSubject<number>

    // Derived Subscribables for declarative JSX attribute bindings
    private readonly tapeTransform: MappedSubject<[number], string>
    private readonly bugTransform: MappedSubject<[number, number], string>
    private readonly alertFill: MappedSubject<[string], string>
    private readonly alertBgFill: MappedSubject<[string], string>
    private readonly deviationVisibility: MappedSubject<[string], string>
    private readonly chevronDisplay: MappedSubject<[string], string>
    private readonly diamondDisplay: MappedSubject<[string], string>
    private readonly hollowDiamondDisplay: MappedSubject<[string], string>
    private readonly deviationTransform: MappedSubject<[number], string>
    private readonly vsBarY: MappedSubject<[number], number>
    private readonly vsBarHeight: MappedSubject<[number], number>
    private readonly vsIndicatorTransform: MappedSubject<[number], string>
    private readonly trendY: MappedSubject<[number], number>
    private readonly trendHeight: MappedSubject<[number], number>

    // Reactive graduation subjects
    private readonly gradTextSubjects: MappedSubject<[number], string>[] = []
    private readonly showIndicatedAltData = SubscribableUtils.toSubscribable(true, true)

    /** Altitude at the bottom of the tape (snapped to 100‑ft boundaries).
     *  Updated with hysteresis — only recentres when indicated altitude
     *  drifts outside the centre 50 % of the tape window (G3X behaviour). */
    private readonly currentMinimum = Subject.create(0)
    private readonly currentMinimumSub: Subscription

    private readonly minimum = SubscribableUtils.toSubscribable(-9999, true)
    private readonly maximum = SubscribableUtils.toSubscribable(99999, true)

    private readonly isIndicatedAltBelowScale: MappedSubject<[number, number], boolean>
    private readonly isIndicatedAltAboveScale: MappedSubject<[number, number], boolean>
    private readonly isIndicatedAltOffScale: MappedSubject<[boolean, boolean], boolean>
    private readonly indicatedAltBoxValue: MappedSubject<[number, boolean], number>

    constructor(props: AltimeterComponentProps) {
        super(props)
        const sub = props.bus.getSubscriber<AdcEvents & G5CustomEvents>()

        this.indicatedAlt = ConsumerSubject.create(sub.on('indicated_alt').withPrecision(0), 0)
        this.isIndicatedAltBelowScale = MappedSubject.create(
            ([indicatedAlt, minimum]): boolean => {
                return indicatedAlt < minimum
            },
            this.indicatedAlt,
            this.minimum
        ).pause()
        this.isIndicatedAltAboveScale = MappedSubject.create(
            ([indicatedAlt, maximum]): boolean => {
                return indicatedAlt > maximum
            },
            this.indicatedAlt,
            this.maximum
        )
        this.isIndicatedAltOffScale = MappedSubject.create(
            ([isIndicatedAltBelowScale, isIndicatedAltAboveScale]): boolean => {
                return isIndicatedAltBelowScale || isIndicatedAltAboveScale
            },
            this.isIndicatedAltBelowScale,
            this.isIndicatedAltAboveScale
        )

        this.indicatedAltBoxValue = MappedSubject.create(
            ([indicatedAlt, isIndicatedAltOffScale]): number => {
                return isIndicatedAltOffScale ? NaN : indicatedAlt
            },
            this.indicatedAlt,
            this.isIndicatedAltOffScale
        ).pause()
        this.baroSetting = ConsumerSubject.create(
            sub.on('altimeter_baro_setting_inhg').withPrecision(2),
            29.92
        )
        this.verticalSpd = ConsumerSubject.create(sub.on('vertical_speed').withPrecision(0), 0)
        this.refAltitude = ConsumerSubject.create(
            sub.on('ap_altitude_selected').withPrecision(0),
            0
        )

        const centerY = props.height / 2 - 100

        // --- G3X‑style tape sizing ---
        this.TAPE_WINDOW_PX = props.height - 100
        this.PX_PER_FT = this.TAPE_WINDOW_PX / this.ALT_WINDOW_FT
        this.MAJOR_TICK_COUNT = Math.ceil(this.ALT_WINDOW_FT / this.MAJOR_TICK_INTERVAL) * 2 + 1
        this.TAPE_FT = (this.MAJOR_TICK_COUNT - 1) * this.MAJOR_TICK_INTERVAL
        this.gradCount = this.MAJOR_TICK_COUNT

        // --- currentMinimum: lowest altitude shown on tape (G3X-style hysteresis) ---
        const recenterThreshold = this.TAPE_FT * 0.25 // 200 ft on each side
        this.currentMinimumSub = this.indicatedAlt.sub(alt => {
            const oldMin = this.currentMinimum.get()
            const lowerBound = oldMin + recenterThreshold
            const upperBound = oldMin + this.TAPE_FT - recenterThreshold

            if (alt < lowerBound || alt > upperBound) {
                const newMin =
                    Math.floor((alt - this.TAPE_FT / 2) / this.MAJOR_TICK_INTERVAL) *
                    this.MAJOR_TICK_INTERVAL
                if (newMin !== oldMin) {
                    this.currentMinimum.set(newMin)
                }
            }
        }, true)

        // --- Graduation text subjects (G3X‑style: labels are currentMinimum + i*100) ---
        for (let i = 0; i < this.MAJOR_TICK_COUNT; i++) {
            const idx = i
            this.gradTextSubjects.push(
                MappedSubject.create(
                    ([min]) => fastToFixed(min + idx * this.MAJOR_TICK_INTERVAL, 0),
                    this.currentMinimum
                )
            )
        }

        // --- Tape transform: centre indicated altitude on the cursor ---
        const centerPx = (props.height - 100) / 2
        this.tapeTransform = MappedSubject.create(
            ([alt, min]) => {
                const yIndicated = (min + this.TAPE_FT - alt) * this.PX_PER_FT
                const offset = centerPx - yIndicated
                return `translate(0, ${offset.toFixed(1)})`
            },
            this.indicatedAlt,
            this.currentMinimum
        )

        // --- Selected-altitude bug transform ---
        this.bugTransform = MappedSubject.create(
            ([refAlt, indAlt]) => {
                const diffPx = (indAlt - refAlt) * this.PX_PER_FT
                return `translate(0, ${diffPx.toFixed(1)})`
            },
            this.refAltitude,
            this.indicatedAlt
        )

        this.alertFill = MappedSubject.create(([state]) => {
            switch (state) {
                case 'Empty':
                    return 'transparent'
                case 'YellowText':
                    return 'yellow'
                default:
                    return '#36c8d2'
            }
        }, props.altitudeAlertState)

        this.alertBgFill = MappedSubject.create(
            ([state]) => (state === 'BlueBackground' ? '#36c8d2' : '#1a1d21'),
            props.altitudeAlertState
        )

        this.deviationVisibility = MappedSubject.create(
            ([mode]) => (mode !== 'None' ? 'visible' : 'hidden'),
            props.verticalDeviationMode
        )

        this.chevronDisplay = MappedSubject.create(
            ([mode]) => (mode === 'GS' ? '' : 'none'),
            props.verticalDeviationMode
        )

        this.diamondDisplay = MappedSubject.create(
            ([mode]) => (mode === 'GP' ? '' : 'none'),
            props.verticalDeviationMode
        )

        this.hollowDiamondDisplay = MappedSubject.create(
            ([mode]) => (mode === 'GSPreview' ? '' : 'none'),
            props.verticalDeviationMode
        )

        this.deviationTransform = MappedSubject.create(([val]) => {
            const offsetY = Math.max(-1, Math.min(1, val)) * 132
            return `translate(0, ${offsetY})`
        }, props.verticalDeviationValue)

        this.vsBarY = MappedSubject.create(([vs]) => {
            const clamped = Math.max(-2000, Math.min(2000, vs))
            const barY = centerY - (clamped / 2000) * 240
            return Math.min(centerY, barY)
        }, this.verticalSpd)

        this.vsBarHeight = MappedSubject.create(([vs]) => {
            const clamped = Math.max(-2000, Math.min(2000, vs))
            return Math.abs((clamped / 2000) * 240)
        }, this.verticalSpd)

        this.vsIndicatorTransform = MappedSubject.create(([vs]) => {
            const clamped = Math.max(-2000, Math.min(2000, vs))
            return `translate(0, ${(clamped / 2000) * 240})`
        }, this.verticalSpd)

        this.trendY = MappedSubject.create(([vs]) => {
            const clamped = Math.max(-2000, Math.min(2000, vs))
            const rawY = centerY + (clamped / 10) * -1.5
            const trendVal = Math.max(-50, Math.min(props.height - 150, rawY))
            return Math.min(trendVal, centerY)
        }, this.verticalSpd)

        this.trendHeight = MappedSubject.create(([vs]) => {
            const clamped = Math.max(-2000, Math.min(2000, vs))
            const rawY = centerY + (clamped / 10) * -1.5
            const trendVal = Math.max(-50, Math.min(props.height - 150, rawY))
            return Math.abs(trendVal - centerY)
        }, this.verticalSpd)
    }

    public destroy(): void {
        this.indicatedAlt.destroy()
        this.baroSetting.destroy()
        this.verticalSpd.destroy()
        this.refAltitude.destroy()

        this.tapeTransform.destroy()
        this.bugTransform.destroy()
        this.alertFill.destroy()
        this.alertBgFill.destroy()
        this.deviationVisibility.destroy()
        this.chevronDisplay.destroy()
        this.diamondDisplay.destroy()
        this.hollowDiamondDisplay.destroy()
        this.deviationTransform.destroy()
        this.vsBarY.destroy()
        this.vsBarHeight.destroy()
        this.vsIndicatorTransform.destroy()
        this.trendY.destroy()
        this.trendHeight.destroy()

        this.gradTextSubjects.forEach(s => s.destroy())
        this.currentMinimumSub.destroy()

        super.destroy()
    }

    onAfterRender(): void {
        this.indicatedAltBoxValue.resume()
    }

    render(): VNode {
        const centerY = this.props.height / 2 - 100
        const center = (this.props.height - 100) / 2
        const compactVs = this.props.VSStyle === 'Compact'
        const GF_font = 'Montserrat-Bold'
        const viewBoxWidth = compactVs ? 300 : 380

        return (
            <>
                <svg
                    ref={this.rootRef}
                    class="altimeter"
                    width="100%"
                    height="100%"
                    id="AltimeterRoot"
                    viewBox={`-55 -100 ${viewBoxWidth} ${this.props.height}`}
                >
                    <g class="vertical-deviation-group" visibility={this.deviationVisibility}>
                        <rect
                            class="vertical-deviation-background"
                            x="-50"
                            y={centerY - 200}
                            width="50"
                            height="400"
                            fill="#1a1d21"
                            fill-opacity="0.25"
                        />
                        <rect
                            class="vertical-deviation-top-background"
                            x="-50"
                            y={centerY - 250}
                            width="50"
                            height="50"
                            fill="#1a1d21"
                        />
                        <text
                            ref={this.verticalDeviationTextRef}
                            x="-25"
                            y={centerY - 210}
                            fill="#d12bc7"
                            font-size="45"
                            font-family={GF_font}
                            text-anchor="middle"
                        >
                            V
                        </text>
                        {[-2, -1, 1, 2].map(i => (
                            <circle
                                class="vertical-deviation-grad"
                                cx="-25"
                                cy={centerY + 66 * i}
                                r="6"
                                stroke="white"
                                stroke-width="3"
                                fill-opacity="0"
                            />
                        ))}
                        <polygon
                            class="vertical-deviation-chevron-bug"
                            points={`-45,${centerY} -10,${centerY - 20} -10,${centerY - 10} -25,${centerY} -10,${centerY + 10} -10,${centerY + 20}`}
                            fill="#d12bc7"
                            display={this.chevronDisplay}
                            transform={this.deviationTransform}
                        />
                        <polygon
                            class="vertical-deviation-diamond-bug"
                            points={`-40,${centerY} -25,${centerY - 15} -10,${centerY} -25,${centerY + 15}`}
                            fill="#10c210"
                            display={this.diamondDisplay}
                            transform={this.deviationTransform}
                        />
                        <polygon
                            class="vertical-deviation-hollow-diamond-bug"
                            points={`-40,${centerY} -25,${centerY - 15} -10,${centerY} -25,${centerY + 15} -25,${centerY + 5} -20,${centerY} -25,${centerY - 5} -30,${centerY} -25,${centerY + 5} -25,${centerY + 15}`}
                            fill="#DFDFDF"
                            display={this.hollowDiamondDisplay}
                            transform={this.deviationTransform}
                        />
                    </g>
                    <rect
                        class="background"
                        x="0"
                        y="-50"
                        width="350"
                        height={this.props.height - 100}
                        fill="#1a1d21"
                        fill-opacity="0.25"
                    />
                    <defs>
                        <linearGradient id="altshadowGradient" gradientTransform="rotate(90)">
                            <stop offset="0%" stop-color="rgb(0,0,0)" stop-opacity="0.8" />
                            <stop offset="15%" stop-color="rgb(0,0,0)" stop-opacity="0" />
                            <stop offset="85%" stop-color="rgb(0,0,0)" stop-opacity="0" />
                            <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0.8" />
                        </linearGradient>
                        <linearGradient id="underShadowGradient" gradientTransform="rotate(90)">
                            <stop offset="0%" stop-color="rgb(0,0,0)" stop-opacity="0.8" />
                            <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="0" />
                        </linearGradient>
                    </defs>
                    <svg
                        id="GraduationSvg"
                        x="0"
                        y="-50"
                        width="235"
                        height={this.props.height - 100}
                        viewBox={`0 0 235 ${this.props.height - 100}`}
                    >
                        {this.buildGraduationGroup()}
                        {this.buildGroundLine()}
                        <g ref={this.bugsGroupRef} class="bugs-group">
                            <polygon
                                class="selected-altitude-bug"
                                points={`0,${center - 50} 25,${center - 50} 25,${center - 22} 0,${center} 25,${center + 22} 25,${center + 50} 0,${center + 50}`}
                                fill="#36c8d2"
                                transform={this.bugTransform}
                            />
                            <polyline
                                ref={this.minimumAltitudeBugRef}
                                class="minimum-altitude-bug"
                                points={`20,${center - 40} 20,${center - 27} 0,${center} 20,${center + 27} 20,${center + 40}`}
                                stroke="#36c8d2"
                                fill="none"
                                display="none"
                                stroke-width="5"
                            />
                        </g>
                    </svg>
                    <rect
                        class="cursor-shadow"
                        fill="url(#altshadowGradient)"
                        x="148"
                        y={this.props.height / 2 - 175}
                        width="74"
                        height="152"
                    />
                    <rect
                        class="selected-altitude-shadow"
                        fill="url(#underShadowGradient)"
                        x="0"
                        y="-36"
                        width={compactVs ? 320 : 200}
                        height="30"
                    />
                    <rect
                        class="selected-altitude-background"
                        x="0"
                        y="-100"
                        width={compactVs ? 320 : 200}
                        height="60"
                        fill={this.alertBgFill}
                        stroke="white"
                        stroke-width="3"
                    />
                    <polygon
                        ref={this.selectedAltitudeFixedBugRef}
                        class="selected-altitude-fixed-bug"
                        points="10,-90 24,-90 24,-76 15,-70 24,-64 24,-50 10,-50"
                        fill="#36c8d2"
                    />
                    <text
                        class="selected-altitude-text"
                        x="250"
                        y="-50"
                        fill={this.alertFill}
                        font-size="56"
                        font-family={GF_font}
                        text-anchor="end"
                    >
                        {this.refAltitude.map(a => Math.round(a).toString())}
                    </text>
                    <rect
                        ref={this.pressureBackgroundRef}
                        class="pressure-background"
                        x="0"
                        y={this.props.height - 100 - 75}
                        width="310"
                        height="70"
                        fill="#1a1d21"
                        stroke="#36c8d2"
                        stroke-width="5"
                    />
                    <text
                        class="pressure-text"
                        x="20"
                        y={this.props.height - 100 - 18}
                        fill="#36c8d2"
                        font-size="56"
                        font-family={GF_font}
                        letter-spacing="0.05em"
                    >
                        {this.baroSetting.map(p => p.toFixed(2))}
                    </text>
                    {compactVs
                        ? this.buildCompactVS(centerY, GF_font)
                        : this.buildDefaultVS(centerY, GF_font)}
                    <rect
                        ref={this.trendElementRef}
                        class="trend-element"
                        x="0"
                        y={this.trendY}
                        width="8"
                        height={this.trendHeight}
                        fill="#d12bc7"
                    />
                </svg>
                <IndicatedAltDisplayBox
                    ref={this.indicatedAltBoxRef}
                    show={this.showIndicatedAltData}
                    indicatedAlt={this.indicatedAltBoxValue}
                />
            </>
        )
    }

    /**
     * Build the graduated tape strip (G3X‑style).
     *
     * Layout (bottom → top): i runs from 0 to totalLen where
     *   totalLen = (MAJOR_TICK_COUNT - 1) * MINOR_TICK_FACTOR.
     * A major (labelled) tick is drawn at i divisible by MINOR_TICK_FACTOR;
     * a minor tick is drawn at every other i.
     * The tape is positioned so that the current indicated altitude lands on
     * the cursor centre after `tapeTransform` is applied.
     */
    private buildGraduationGroup(): VNode {
        const majorSpacingPx = this.MAJOR_TICK_INTERVAL * this.PX_PER_FT
        const minorSpacingPx = majorSpacingPx / this.MINOR_TICK_FACTOR
        const totalLen = (this.MAJOR_TICK_COUNT - 1) * this.MINOR_TICK_FACTOR
        const tapeBottom = this.TAPE_FT * this.PX_PER_FT
        const children: VNode[] = []

        for (let i = 0; i <= totalLen; i++) {
            const y = tapeBottom - i * minorSpacingPx
            const isMajor = i % this.MINOR_TICK_FACTOR === 0

            const tickRef = FSComponent.createRef<SVGElement>()
            this.gradRectRefs.push(tickRef)
            children.push(
                <rect
                    ref={tickRef}
                    class={isMajor ? 'main-grad' : 'grad'}
                    x="0"
                    y={fastToFixed(y - 2, 0)}
                    height="4"
                    width={isMajor ? 40 : 15}
                    fill="white"
                />
            )

            if (isMajor) {
                const labelIdx = i / this.MINOR_TICK_FACTOR
                const gradTextRef = FSComponent.createRef<SVGElement>()
                this.gradTextRefs.push(gradTextRef)
                const gradSubject = this.gradTextSubjects[labelIdx]
                children.push(
                    <text
                        ref={gradTextRef}
                        class="graduation-text"
                        x="50"
                        y={fastToFixed(y + 16, 0)}
                        fill="white"
                        font-size="64"
                        font-family="Montserrat-Bold"
                    >
                        {gradSubject.map(v => v)}
                    </text>
                )
            }
        }

        return (
            <g class="graduation-group" transform={this.tapeTransform}>
                {children}
            </g>
        )
    }

    private buildGroundLine(): VNode {
        const children: VNode[] = []
        for (let i = -5; i <= 25; i++) {
            children.push(
                <rect
                    class="ground-line-hash"
                    fill="white"
                    x="0"
                    y={-50 + i * 30}
                    width="200"
                    height="4"
                    transform="skewY(-30)"
                />
            )
        }
        return (
            <g
                ref={this.groundLineRef}
                class="ground-line"
                transform={`translate(0, ${this.props.height})`}
            >
                <rect
                    ref={this.groundLineBackgroundRef}
                    class="ground-line-background"
                    fill="#654222"
                    stroke="white"
                    stroke-width="4"
                    x="0"
                    y="0"
                    width="196"
                    height={this.props.height - 100}
                />
                <svg
                    ref={this.groundLineScaleRef}
                    class="ground-line-hash-wrapper"
                    x="0"
                    y="0"
                    width="200"
                    height={this.props.height - 100}
                    viewBox={`0 0 200 ${this.props.height - 100}`}
                >
                    {children}
                </svg>
                <text
                    ref={this.groundLineAltRef}
                    x="0"
                    y="0"
                    fill="white"
                    font-size="0"
                    font-family="Montserrat-Bold"
                ></text>
            </g>
        )
    }

    private buildCompactVS(centerY: number, GF_font: string): VNode {
        const dashes = [-240, -200, -160, -80, 80, 160, 200, 240]
        const texts = ['2', '', '1', '.5', '.5', '1', '', '2']
        const height = 2.5
        const width = 20
        const fontSize = 30

        return (
            <g id="VerticalSpeed" transform="translate(52,0)">
                <path
                    class="vertical-speed-background"
                    d={`M200 -50 v${this.props.height - 100} H250 V-${centerY + 25} l-40 -25 l40 -25 V-50 Z`}
                    fill="#1a1d21"
                    fill-opacity="0"
                />
                <rect
                    class="vertical-speed-left-bar"
                    x="210"
                    y={this.vsBarY}
                    height={this.vsBarHeight}
                    width="2"
                    fill="white"
                />
                {dashes.map((d, i) => (
                    <>
                        <rect
                            class="vertical-speed-dash"
                            x="200"
                            y={centerY - d - height / 2}
                            height={height}
                            width={width}
                            fill="white"
                        />
                        {texts[i] !== '' && (
                            <text
                                class="vertical-speed-dash-text"
                                y={centerY - d - height / 2 + fontSize / 3}
                                x="235"
                                fill="white"
                                font-size={fontSize}
                                font-family={GF_font}
                                text-anchor="middle"
                            >
                                {texts[i]}
                            </text>
                        )}
                    </>
                ))}
                <polygon
                    ref={this.selectedVSBugRef}
                    class="selected-VS-bug"
                    points={`200, ${centerY - 20} 220, ${centerY - 20} 220, ${centerY - 15} 210, ${centerY} 220, ${centerY + 15} 220, ${centerY + 20} 200, ${centerY + 20}`}
                    fill="#36c8d2"
                />
                <polygon
                    class="vertical-speed-indicator"
                    points={`180,${centerY + 35} 215,${centerY} 180,${centerY - 35}`}
                    fill="white"
                    stroke="black"
                    stroke-width="2.5"
                    transform={this.vsIndicatorTransform}
                />
            </g>
        )
    }

    private buildDefaultVS(centerY: number, GF_font: string): VNode {
        const dashes = [-200, -150, -100, -50, 50, 100, 150, 200]
        const height = 3
        const width = 10
        const fontSize = 30

        return (
            <g id="VerticalSpeed" transform="translate(52,0)">
                <path
                    class="vertical-speed-background"
                    d={`M200 0 V${this.props.height - 200} H275 V${centerY + 50} L210 ${centerY} L275 ${centerY - 50} V0 Z`}
                    fill="#1a1d21"
                    fill-opacity="0"
                />
                {dashes.map(d => (
                    <>
                        <rect
                            class="vertical-speed-dash"
                            x="200"
                            y={centerY - d - height / 2}
                            height={height}
                            width={d % 100 == 0 ? 2 * width : width}
                            fill="white"
                        />
                        {d % 100 == 0 && (
                            <text
                                class="vertical-speed-dash-text"
                                y={centerY - d - height / 2 + fontSize / 3}
                                x={200 + 3 * width}
                                fill="white"
                                font-size={fontSize}
                                font-family={GF_font}
                            >
                                {d / 100}
                            </text>
                        )}
                    </>
                ))}
                <polygon
                    ref={this.selectedVSBugRef}
                    class="selected-VS-bug"
                    points={`200, ${centerY - 20} 220, ${centerY - 20} 220, ${centerY - 15} 210, ${centerY} 220, ${centerY + 15} 220, ${centerY + 20} 200, ${centerY + 20}`}
                    fill="#36c8d2"
                />
                <g transform={this.vsIndicatorTransform}>
                    <path
                        class="vertical-speed-indicator"
                        d={`M210 ${centerY} L235 ${centerY + 25} H330 V${centerY - 25} H235 Z`}
                        fill="#1a1d21"
                    />
                    <text
                        ref={this.indicatorTextRef}
                        class="vertical-speed-indicator-text"
                        x="235"
                        y={centerY + 10}
                        fill="white"
                        font-size={fontSize}
                        font-family={GF_font}
                    >
                        {this.verticalSpd.map(v =>
                            Math.abs(v) >= 100 ? fastToFixed(Math.round(v / 50) * 50, 0) : ''
                        )}
                    </text>
                </g>
                <rect
                    ref={this.selectedVSBackgroundRef}
                    class="selected-VS-background"
                    x="200"
                    y="-50"
                    width="75"
                    height="50"
                    fill="#1a1d21"
                />
                <text
                    class="selected-VS-text"
                    x="237.5"
                    y="-15"
                    fill="#36c8d2"
                    font-size="25"
                    font-family={GF_font}
                    text-anchor="middle"
                >
                    {this.props.referenceVspeed}
                </text>
            </g>
        )
    }
}
