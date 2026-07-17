import { AdcSystemEvents, AltitudeAlertState, AltitudeAlerter } from '@microsoft/msfs-garminsdk'
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
    MappedSubscribable,
    AdcEvents,
    Subscribable,
    DigitScroller,
    SubscribableMapFunctions,
    ArrayUtils,
    SetSubject,
    DebounceTimer,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from '../publishers/G5CustomPublisher'

export interface AltimeterComponentProps extends ComponentProps {
    bus: EventBus
    height: number
    onDeviationAlert?: () => void
}

interface IndicatedAltDisplayBoxProps extends ComponentProps {
    indicatedAlt: Subscribable<number>
}

class IndicatedAltDisplayBox extends DisplayComponent<IndicatedAltDisplayBoxProps> {
    private readonly scrollerRefs: NodeReference<DigitScroller>[] = []

    private readonly indicatedAlt: MappedSubscribable<number>
    private readonly negativeSignHidden: MappedSubscribable<boolean>[]

    constructor(props: IndicatedAltDisplayBoxProps) {
        super(props)

        this.indicatedAlt = props.indicatedAlt.map(SubscribableMapFunctions.identity()).pause()

        this.negativeSignHidden = ArrayUtils.create(3, index => {
            const topThreshold = index === 0 ? 0 : Math.pow(10, index + 1) - 20
            const bottomThreshold = Math.pow(10, index + 2) - 20

            return this.indicatedAlt.map(indicatedAlt => {
                return indicatedAlt >= -topThreshold || indicatedAlt < -bottomThreshold
            })
        })
    }

    public onAfterRender(): void {
        this.indicatedAlt.resume()
    }

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
            <div class="altimeter-indicatedalt-box">
                <svg
                    viewBox="0 0 88 60"
                    class="altimeter-indicatedalt-box-bg"
                    preserveAspectRatio="none"
                >
                    <path
                        vector-effect="non-scaling-stroke"
                        d="M 0 30 L 7 23 L 7 13 L 58 13 L 58 0 L 88 0 L 88 60 L 58 60 L 58 48 L 7 48 L 7 37 Z"
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

    public destroy(): void {
        for (const hidden of this.negativeSignHidden) {
            hidden.destroy()
        }

        for (const ref of this.scrollerRefs) {
            ref.getOrDefault()?.destroy()
        }

        this.indicatedAlt.destroy()

        super.destroy()
    }
}

interface VerticalSpeedIndicatorProps extends ComponentProps {
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

    public onAfterRender(): void {
        this.vsBarStyleProp.resume()
        this.vsBarArrowStyleProp.resume()
    }

    public destroy(): void {
        this.vsBarStyleProp.destroy()
        this.vsBarArrowStyleProp.destroy()

        super.destroy()
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

interface SelectedAltitudeBoxProps extends ComponentProps {
    altitudeAlertState: Subscribable<AltitudeAlertState>
    selectedAlt: Subscribable<number>
    onDeviationAlert?: () => void
}

class SelectedAltitudeBox extends DisplayComponent<SelectedAltitudeBoxProps> {
    private static readonly ALERT_FLASH_DURATION = 5000

    private readonly bgClassSet: SetSubject<string>
    private readonly textClassSet: SetSubject<string>

    private readonly animationTimer = new DebounceTimer()

    private lastAlertState: AltitudeAlertState | undefined = undefined

    private readonly alertStateSub: Subscription

    constructor(props: SelectedAltitudeBoxProps) {
        super(props)

        this.bgClassSet = SetSubject.create(['selected-altitude-bg-overlay'])
        this.textClassSet = SetSubject.create(['selected-altitude-text'])

        this.alertStateSub = props.altitudeAlertState.sub(
            state => this.onAlertStateChanged(state),
            false,
            true
        )
    }

    public onAfterRender(): void {
        this.alertStateSub.resume(true)
    }

    private onAlertStateChanged(state: AltitudeAlertState): void {
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
    }

    public destroy(): void {
        this.animationTimer.clear()
        this.alertStateSub.destroy()
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
    private readonly ALT_WINDOW_FT = 400
    private readonly MAJOR_TICK_INTERVAL = 100
    private readonly MINOR_TICK_FACTOR = 5

    private readonly TAPE_FT: number
    private readonly MAJOR_TICK_COUNT: number
    private readonly TAPE_WINDOW_PX: number
    private readonly PX_PER_FT: number

    private readonly indicatedAlt: ConsumerSubject<number>
    private readonly baroSetting: ConsumerSubject<number>
    private readonly verticalSpd: ConsumerSubject<number>
    private readonly refAltitude: ConsumerSubject<number>

    private readonly altitudeAlerter: AltitudeAlerter
    private readonly indicatedAltPubSub: Subscription
    private readonly altSelectInitializedSub: Subscription

    private readonly tapeTransform: MappedSubject<[number, number], string>
    private readonly bugTransform: MappedSubject<[number, number], string>

    private readonly gradTextSubjects: MappedSubject<[number], string>[] = []

    private readonly currentMinimum = Subject.create(0)
    private readonly currentMinimumSub: Subscription

    constructor(props: AltimeterComponentProps) {
        super(props)
        const sub = props.bus.getSubscriber<AdcEvents & G5CustomEvents>()

        this.TAPE_WINDOW_PX = props.height - 100
        this.PX_PER_FT = this.TAPE_WINDOW_PX / this.ALT_WINDOW_FT
        this.MAJOR_TICK_COUNT = Math.ceil(this.ALT_WINDOW_FT / this.MAJOR_TICK_INTERVAL) * 2 + 1
        this.TAPE_FT = (this.MAJOR_TICK_COUNT - 1) * this.MAJOR_TICK_INTERVAL

        this.indicatedAlt = ConsumerSubject.create(
            sub.on('indicated_alt').withPrecision(0),
            0
        ).pause()
        this.baroSetting = ConsumerSubject.create(
            sub.on('altimeter_baro_setting_mb').withPrecision(0),
            1013
        ).pause()
        this.verticalSpd = ConsumerSubject.create(
            sub.on('vertical_speed').withPrecision(1),
            0
        ).pause()
        this.refAltitude = ConsumerSubject.create(sub.on('ap_altitude_selected'), 0).pause()

        this.indicatedAltPubSub = this.indicatedAlt.sub(
            alt =>
                props.bus
                    .getPublisher<AdcSystemEvents>()
                    .pub('adc_indicated_alt_1', alt, true, true),
            false,
            true
        )
        this.altSelectInitializedSub = sub.on('ap_altitude_selected').handle(() => {
            props.bus
                .getPublisher<AltitudeSelectEvents>()
                .pub('alt_select_is_initialized', true, true, true)
            this.altSelectInitializedSub.destroy()
        }, true)

        this.altitudeAlerter = new AltitudeAlerter(1, props.bus, 1)

        const recenterThreshold = this.TAPE_FT * 0.25
        this.currentMinimumSub = this.indicatedAlt.sub(
            alt => {
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
            },
            false,
            true
        )

        for (let i = 0; i < this.MAJOR_TICK_COUNT; i++) {
            const idx = i
            this.gradTextSubjects.push(
                MappedSubject.create(
                    ([min]) => fastToFixed(min + idx * this.MAJOR_TICK_INTERVAL, 0),
                    this.currentMinimum
                ).pause()
            )
        }

        const centerPx = this.TAPE_WINDOW_PX / 2
        this.tapeTransform = MappedSubject.create(
            ([alt, min]) => {
                const yIndicated = (min + this.TAPE_FT - alt) * this.PX_PER_FT
                const offset = centerPx - yIndicated
                return `translate(0, ${offset.toFixed(1)})`
            },
            this.indicatedAlt,
            this.currentMinimum
        ).pause()

        this.bugTransform = MappedSubject.create(
            ([refAlt, indAlt]) => {
                const diffPx = (indAlt - refAlt) * this.PX_PER_FT
                return `translate(0, ${diffPx.toFixed(1)})`
            },
            this.refAltitude,
            this.indicatedAlt
        ).pause()
    }

    public onAfterRender(): void {
        this.indicatedAlt.resume()
        this.baroSetting.resume()
        this.verticalSpd.resume()
        this.refAltitude.resume()

        this.currentMinimumSub.resume(true)
        this.gradTextSubjects.forEach(s => s.resume())

        this.tapeTransform.resume()
        this.bugTransform.resume()

        this.indicatedAltPubSub.resume(true)
        this.altSelectInitializedSub.resume(true)

        this.altitudeAlerter.init()
    }

    public destroy(): void {
        this.altitudeAlerter.destroy()

        this.indicatedAlt.destroy()
        this.baroSetting.destroy()
        this.verticalSpd.destroy()
        this.refAltitude.destroy()

        this.tapeTransform.destroy()
        this.bugTransform.destroy()

        this.gradTextSubjects.forEach(s => s.destroy())
        this.currentMinimumSub.destroy()
        this.indicatedAltPubSub.destroy()
        this.altSelectInitializedSub.destroy()

        super.destroy()
    }

    public render(): VNode {
        const tapeCenterY = this.TAPE_WINDOW_PX / 2
        const GF_font = 'OpenSans-Bold'
        const viewBoxWidth = 300

        return (
            <>
                <VerticalSpeedIndicator verticalSpeed={this.verticalSpd} />
                <svg
                    class="altimeter"
                    width="100%"
                    height="100%"
                    id="AltimeterRoot"
                    viewBox={`-55 -100 ${viewBoxWidth} ${this.props.height}`}
                >
                    <rect
                        class="background"
                        x="0"
                        y="-50"
                        width="350"
                        height={this.TAPE_WINDOW_PX}
                        fill="#1a1d21"
                        fill-opacity="0.25"
                    />
                    <defs>
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
                        height={this.TAPE_WINDOW_PX}
                        viewBox={`0 0 235 ${this.TAPE_WINDOW_PX}`}
                    >
                        {this.buildGraduationGroup()}
                        <polygon
                            class="selected-altitude-bug"
                            points={`0,${tapeCenterY - 50} 25,${tapeCenterY - 50} 25,${tapeCenterY - 22} 0,${tapeCenterY} 25,${tapeCenterY + 22} 25,${tapeCenterY + 50} 0,${tapeCenterY + 50}`}
                            fill="#36c8d2"
                            transform={this.bugTransform}
                        />
                    </svg>
                    <SelectedAltitudeBox
                        altitudeAlertState={this.altitudeAlerter.state}
                        selectedAlt={this.refAltitude}
                        onDeviationAlert={this.props.onDeviationAlert}
                    />
                    <g
                        width="310"
                        height="70"
                        transform={`translate(0, ${this.TAPE_WINDOW_PX - 75})`}
                    >
                        <rect
                            class="pressure-background"
                            width="310"
                            height="70"
                            fill="#1a1d21"
                            stroke="#36c8d2"
                            stroke-width="5"
                        />
                        <text
                            x="155"
                            y="35"
                            class="pressure-text"
                            fill="#36c8d2"
                            font-size="56"
                            font-family={GF_font}
                            letter-spacing="0.05em"
                            text-anchor="middle"
                            dominant-baseline="central"
                        >
                            {this.baroSetting.map(p => p.toFixed(0))}
                        </text>
                    </g>
                </svg>
                <IndicatedAltDisplayBox indicatedAlt={this.indicatedAlt} />
            </>
        )
    }

    private buildGraduationGroup(): VNode {
        const majorSpacingPx = this.MAJOR_TICK_INTERVAL * this.PX_PER_FT
        const minorSpacingPx = majorSpacingPx / this.MINOR_TICK_FACTOR
        const totalLen = (this.MAJOR_TICK_COUNT - 1) * this.MINOR_TICK_FACTOR
        const tapeBottom = this.TAPE_FT * this.PX_PER_FT
        const children: VNode[] = []

        for (let i = 0; i <= totalLen; i++) {
            const y = tapeBottom - i * minorSpacingPx
            const isMajor = i % this.MINOR_TICK_FACTOR === 0

            children.push(
                <rect
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
                const gradSubject = this.gradTextSubjects[labelIdx]
                children.push(
                    <text
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
}
