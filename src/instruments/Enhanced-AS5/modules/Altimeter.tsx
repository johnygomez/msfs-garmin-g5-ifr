import { AltitudeAlertState, AltitudeAlerter } from '@microsoft/msfs-garminsdk'
import {
    AltitudeSelectEvents,
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
    SetSubject,
    DebounceTimer,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'
export interface AltimeterComponentProps extends ComponentProps {
    bus: EventBus
    height: number
    verticalDeviationMode: Subject<string>
    verticalDeviationValue: Subject<number>
    /** Optional callback for the altitude deviation aural alert.
     *  Passed through to {@link SelectedAltitudeBox}. */
    onDeviationAlert?: () => void
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

export interface VerticalSpeedIndicatorProps extends ComponentProps {
    verticalSpeed: Subscribable<number>
}

class VerticalSpeedIndicator extends DisplayComponent<VerticalSpeedIndicatorProps> {
    private readonly vsBarStyleProp: MappedSubject<[number], string>
    private readonly vsBarArrowStyleProp: MappedSubject<[number], string>

    constructor(props: VerticalSpeedIndicatorProps) {
        super(props)

        this.vsBarStyleProp = MappedSubject.create(([vs]) => {
            const clamped = Math.max(-3000, Math.min(3000, vs))
            const barHeight = Math.abs((clamped / 6000) * 100)
            const translateY = clamped < 0 ? 0 : 100
            return `height: ${barHeight}%; transform: translateY(-${translateY}%);`
        }, props.verticalSpeed).pause()

        this.vsBarArrowStyleProp = MappedSubject.create(([vs]) => {
            const top = vs > 0 ? 0 : 100
            return `top: ${top}%`
        }, props.verticalSpeed).pause()
    }

    public destroy(): void {
        this.vsBarStyleProp.destroy()
        this.vsBarArrowStyleProp.destroy()

        super.destroy()
    }

    public onAfterRender(): void {
        this.vsBarStyleProp.resume()
        this.vsBarArrowStyleProp.resume()
    }

    public render(): VNode {
        const numTicks = 31
        const texts = ['', '20', '10', '', '10', '20', '']

        return (
            <div id="VerticalSpeedIndicator" class="vertical-speed-indicator">
                <div class="vertical-speed-indicator-bar" style={this.vsBarStyleProp}>
                    <svg
                        width="10"
                        height="20"
                        class="vertical-speed-indicator-arrow"
                        viewBox="-2 -2 10 20"
                        style={this.vsBarArrowStyleProp}
                    >
                        <polygon points="10,10 0,0 0,20" fill="white" stroke="black" />
                    </svg>
                </div>
                <div class="vertical-speed-ticks">
                    {Array.from({ length: numTicks }).map((_, i) => (
                        <div
                            class="vertical-speed-tick"
                            style={`top: ${(i / (numTicks - 1)) * 100}%`}
                        >
                            {i % 5 === 0 && (
                                <span class="vertical-speed-tick-label">
                                    {texts[Math.floor(i / 5)]}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )
    }
}

interface AltitudeAlerterEvents {
    adc_indicated_alt_1: number
}

export interface SelectedAltitudeBoxProps extends ComponentProps {
    /** The altitude alert state, driven by an {@link AltitudeAlerter}. */
    altitudeAlertState: Subscribable<AltitudeAlertState>
    /** Selected (reference) altitude, in feet. */
    selectedAlt: Subscribable<number>
    /** Callback invoked when the aircraft deviates from the selected altitude
     *  by more than 200 ft after having captured it. Fires the aural alert. */
    onDeviationAlert?: () => void
}

/**
 * The fixed selected-altitude display box at the top of the altimeter tape.
 *
 * Alert state machine is driven by the garminsdk {@link AltitudeAlerter};
 * this component only manages CSS class toggling for the visual alert
 * indications, following the same pattern as the G3X Touch
 * SelectedAltitudeDisplay.
 */
class SelectedAltitudeBox extends DisplayComponent<SelectedAltitudeBoxProps> {
    private static readonly ALERT_FLASH_DURATION = 5000

    private readonly bgClassSet = SetSubject.create(['selected-altitude-bg-overlay'])
    private readonly textClassSet = SetSubject.create(['selected-altitude-text'])

    private readonly animationTimer = new DebounceTimer()

    private lastAlertState: AltitudeAlertState | undefined = undefined

    private alertStateSub?: Subscription

    public onAfterRender(): void {
        this.alertStateSub = this.props.altitudeAlertState.sub(state => {
            this.bgClassSet.delete('alt-alert-within1000-flash')
            this.bgClassSet.delete('alt-alert-within1000')
            this.textClassSet.delete('alt-alert-deviation-flash')
            this.textClassSet.delete('alt-alert-deviation')

            if (
                !(
                    state === AltitudeAlertState.Captured &&
                    this.lastAlertState === AltitudeAlertState.Within200
                )
            ) {
                this.textClassSet.delete('alt-alert-within200-flash')
                this.animationTimer.clear()
            }

            switch (state) {
                case AltitudeAlertState.Within1000:
                    if (this.lastAlertState === AltitudeAlertState.Armed) {
                        this.bgClassSet.add('alt-alert-within1000-flash')
                        this.animationTimer.schedule(() => {
                            this.bgClassSet.delete('alt-alert-within1000-flash')
                            this.bgClassSet.add('alt-alert-within1000')
                        }, SelectedAltitudeBox.ALERT_FLASH_DURATION)
                    } else {
                        this.bgClassSet.add('alt-alert-within1000')
                    }
                    break

                case AltitudeAlertState.Within200:
                    if (this.lastAlertState === AltitudeAlertState.Within1000) {
                        this.textClassSet.add('alt-alert-within200-flash')
                        this.animationTimer.schedule(() => {
                            this.textClassSet.delete('alt-alert-within200-flash')
                        }, SelectedAltitudeBox.ALERT_FLASH_DURATION)
                    }
                    break

                case AltitudeAlertState.Deviation:
                    this.textClassSet.add('alt-alert-deviation-flash')
                    this.animationTimer.schedule(() => {
                        this.textClassSet.delete('alt-alert-deviation-flash')
                        this.textClassSet.add('alt-alert-deviation')
                    }, SelectedAltitudeBox.ALERT_FLASH_DURATION)
                    this.props.onDeviationAlert?.()
                    break
            }

            this.lastAlertState = state
        }, true)
    }

    public destroy(): void {
        this.animationTimer.clear()
        this.alertStateSub?.destroy()
        super.destroy()
    }

    public render(): VNode {
        return (
            <>
                <rect
                    class="selected-altitude-shadow"
                    fill="url(#underShadowGradient)"
                    x="0"
                    y="-36"
                    width={320}
                    height="30"
                />
                <rect
                    class="selected-altitude-background"
                    x="0"
                    y="-100"
                    width={320}
                    height="60"
                    fill="#1a1d21"
                    stroke="white"
                    stroke-width="3"
                />
                <rect class={this.bgClassSet} x="0" y="-100" width={320} height="60" />
                <polygon
                    class="selected-altitude-fixed-bug"
                    points="10,-90 24,-90 24,-76 15,-70 24,-64 24,-50 10,-50"
                    fill="#36c8d2"
                />
                <text
                    class={this.textClassSet}
                    x="250"
                    y="-50"
                    font-size="56"
                    font-family="OpenSans-Bold"
                    text-anchor="end"
                >
                    {this.props.selectedAlt.map(a => Math.round(a).toString())}
                </text>
            </>
        )
    }
}

export class AltimeterComponent extends DisplayComponent<AltimeterComponentProps> {
    private readonly rootRef = FSComponent.createRef<SVGElement>()
    private readonly indicatedAltBoxRef = FSComponent.createRef<IndicatedAltDisplayBox>()
    private readonly minimumAltitudeBugRef = FSComponent.createRef<SVGElement>()
    private readonly verticalDeviationTextRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineBackgroundRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineScaleRef = FSComponent.createRef<SVGElement>()
    private readonly groundLineAltRef = FSComponent.createRef<SVGElement>()
    private readonly bugsGroupRef = FSComponent.createRef<SVGElement>()
    private readonly pressureBackgroundRef = FSComponent.createRef<SVGElement>()

    private gradTextRefs: NodeReference<SVGElement>[] = []
    private gradRectRefs: NodeReference<SVGElement>[] = []

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

    private readonly altitudeAlerter: AltitudeAlerter

    // Derived Subscribables for declarative JSX attribute bindings
    private readonly tapeTransform: MappedSubject<[number], string>
    private readonly bugTransform: MappedSubject<[number, number], string>
    private readonly deviationVisibility: MappedSubject<[string], string>
    private readonly chevronDisplay: MappedSubject<[string], string>
    private readonly diamondDisplay: MappedSubject<[string], string>
    private readonly hollowDiamondDisplay: MappedSubject<[string], string>
    private readonly deviationTransform: MappedSubject<[number], string>

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
        this.verticalSpd = ConsumerSubject.create(sub.on('vertical_speed').withPrecision(1), 0)
        this.refAltitude = ConsumerSubject.create(sub.on('ap_altitude_selected'), 0)
        sub.on('indicated_alt')
            .withPrecision(0)
            .handle(alt =>
                props.bus
                    .getPublisher<AltitudeAlerterEvents>()
                    .pub('adc_indicated_alt_1', alt, true, true)
            )
        sub.on('ap_altitude_selected')
            .withPrecision(1)
            .handle(() =>
                props.bus
                    .getPublisher<AltitudeSelectEvents>()
                    .pub('alt_select_is_initialized', true, true, true)
            )

        this.altitudeAlerter = new AltitudeAlerter(1, this.props.bus, 1)

        this.TAPE_WINDOW_PX = props.height - 100
        this.PX_PER_FT = this.TAPE_WINDOW_PX / this.ALT_WINDOW_FT
        this.MAJOR_TICK_COUNT = Math.ceil(this.ALT_WINDOW_FT / this.MAJOR_TICK_INTERVAL) * 2 + 1
        this.TAPE_FT = (this.MAJOR_TICK_COUNT - 1) * this.MAJOR_TICK_INTERVAL

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

        for (let i = 0; i < this.MAJOR_TICK_COUNT; i++) {
            const idx = i
            this.gradTextSubjects.push(
                MappedSubject.create(
                    ([min]) => fastToFixed(min + idx * this.MAJOR_TICK_INTERVAL, 0),
                    this.currentMinimum
                )
            )
        }

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

        this.bugTransform = MappedSubject.create(
            ([refAlt, indAlt]) => {
                const diffPx = (indAlt - refAlt) * this.PX_PER_FT
                return `translate(0, ${diffPx.toFixed(1)})`
            },
            this.refAltitude,
            this.indicatedAlt
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
    }

    public destroy(): void {
        this.altitudeAlerter.destroy()
        this.indicatedAlt.destroy()
        this.baroSetting.destroy()
        this.verticalSpd.destroy()
        this.refAltitude.destroy()

        this.tapeTransform.destroy()
        this.bugTransform.destroy()
        this.deviationVisibility.destroy()
        this.chevronDisplay.destroy()
        this.diamondDisplay.destroy()
        this.hollowDiamondDisplay.destroy()
        this.deviationTransform.destroy()

        this.gradTextSubjects.forEach(s => s.destroy())
        this.currentMinimumSub.destroy()

        super.destroy()
    }

    onAfterRender(): void {
        this.altitudeAlerter.init()
        this.indicatedAltBoxValue.resume()
    }

    render(): VNode {
        const centerY = this.props.height / 2 - 100
        const center = (this.props.height - 100) / 2
        const GF_font = 'OpenSans-Bold'
        const viewBoxWidth = 300

        return (
            <>
                <VerticalSpeedIndicator verticalSpeed={this.verticalSpd} />
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
                    <SelectedAltitudeBox
                        altitudeAlertState={this.altitudeAlerter.state}
                        selectedAlt={this.refAltitude}
                        onDeviationAlert={this.props.onDeviationAlert}
                    />
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
                        font-family="OpenSans-Bold"
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
                    font-family="OpenSans-Bold"
                ></text>
            </g>
        )
    }
}
