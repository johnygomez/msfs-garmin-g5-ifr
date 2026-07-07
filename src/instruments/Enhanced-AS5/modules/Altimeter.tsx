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

export interface AltimeterComponentProps extends ComponentProps {
    bus: EventBus
    height: number
    VSStyle: string
    altitudeAlertState: Subject<string>
    referenceVspeed: Subject<string>
    verticalDeviationMode: Subject<string>
    verticalDeviationValue: Subject<number>
}

export class AltimeterComponent extends DisplayComponent<AltimeterComponentProps> {
    private readonly rootRef = FSComponent.createRef<SVGElement>()
    private readonly cursorRef = FSComponent.createRef<SVGElement>()
    private readonly cursorGroupRef = FSComponent.createRef<SVGElement>()
    private readonly cursorDigit1TopRef = FSComponent.createRef<SVGElement>()
    private readonly cursorDigit1BotRef = FSComponent.createRef<SVGElement>()
    private readonly cursorDigit2TopRef = FSComponent.createRef<SVGElement>()
    private readonly cursorDigit2BotRef = FSComponent.createRef<SVGElement>()
    private readonly cursorDigit3TopRef = FSComponent.createRef<SVGElement>()
    private readonly cursorDigit3BotRef = FSComponent.createRef<SVGElement>()
    private readonly endDigitGroupRef = FSComponent.createRef<SVGElement>()
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
    private endDigitRefs: NodeReference<SVGElement>[] = []

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

    constructor(props: AltimeterComponentProps) {
        super(props)
        const sub = props.bus.getSubscriber<AdcEvents & G5CustomEvents>()

        this.indicatedAlt = ConsumerSubject.create(sub.on('indicated_alt').withPrecision(0), 0)
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

        // --- Derived transforms for declarative JSX bindings ---

        this.tapeTransform = MappedSubject.create(([alt]) => {
            const graduationSize = 160
            const offset = (alt % 200) * (graduationSize / 200)
            return `translate(0, ${-offset.toFixed(1)})`
        }, this.indicatedAlt)

        this.bugTransform = MappedSubject.create(
            ([refAlt, indAlt]) => {
                const diff = (((refAlt - indAlt) % 200) / 200) * 160
                return `translate(0, ${-diff})`
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
    }

    public destroy(): void {
        this.indicatedAlt.destroy()
        this.baroSetting.destroy()
        this.verticalSpd.destroy()
        this.refAltitude.destroy()

        super.destroy()
    }

    render(): VNode {
        const centerY = this.props.height / 2 - 100
        const center = (this.props.height - 100) / 2
        const compactVs = this.props.VSStyle === 'Compact'
        const GF_font = 'Montserrat-Bold'
        const endDigitSpace = 60
        const viewBoxWidth = compactVs ? 300 : 380

        return (
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
                    width="226"
                    height={this.props.height - 100}
                    viewBox={`0 0 226 ${this.props.height - 100}`}
                >
                    {this.buildGraduationGroup(center)}
                    {this.buildGroundLine()}
                    <path
                        ref={this.cursorRef}
                        class="cursor"
                        d={`M0 ${center} L28 ${center - 20} L28 ${center - 50} L145 ${center - 50} L145 ${center - 80} L226 ${center - 80} L226 ${center + 80} L145 ${center + 80} L145 ${center + 50} L28 ${center + 50} L28 ${center + 20} L0 ${center}Z`}
                        fill="#1a1d21"
                        stroke="white"
                        stroke-width="3"
                    />
                    <svg
                        ref={this.cursorGroupRef}
                        class="cursor-svg"
                        x="30"
                        y={center - 48}
                        width="120"
                        height="80"
                        viewBox="0 0 120 80"
                    >
                        <g class="cursor-static-digit-group" transform="scale(1, 1.25)">
                            <text
                                ref={this.cursorDigit1TopRef}
                                x="4"
                                y="-1"
                                fill="white"
                                font-size="56"
                                font-family={GF_font}
                            >
                                X
                            </text>
                            <text
                                ref={this.cursorDigit1BotRef}
                                x="4"
                                y="57"
                                fill="white"
                                font-size="56"
                                font-family={GF_font}
                            >
                                X
                            </text>
                            <text
                                ref={this.cursorDigit2TopRef}
                                x="42"
                                y="-1"
                                fill="white"
                                font-size="56"
                                font-family={GF_font}
                            >
                                X
                            </text>
                            <text
                                ref={this.cursorDigit2BotRef}
                                x="42"
                                y="57"
                                fill="white"
                                font-size="56"
                                font-family={GF_font}
                            >
                                X
                            </text>
                            <text
                                ref={this.cursorDigit3TopRef}
                                x="80"
                                y="-1"
                                fill="white"
                                font-size="48"
                                font-family={GF_font}
                            >
                                X
                            </text>
                            <text
                                ref={this.cursorDigit3BotRef}
                                x="80"
                                y="54"
                                fill="white"
                                font-size="48"
                                font-family={GF_font}
                            >
                                X
                            </text>
                        </g>
                    </svg>
                    <svg
                        class="cursor-rotatating-group"
                        x="140"
                        y={center - 75}
                        width="80"
                        height="150"
                        viewBox="0 -66 80 150"
                    >
                        <g ref={this.endDigitGroupRef} class="cursor-rotatating-text-group">
                            <g transform="scale(1, 1.15)">
                                {this.buildEndDigits(GF_font, endDigitSpace)}
                            </g>
                        </g>
                    </svg>
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
                    y="-50"
                    width="8"
                    height="0"
                    fill="#d12bc7"
                />
            </svg>
        )
    }

    private buildGraduationGroup(center: number): VNode {
        const graduationSize = 160
        const n = Math.ceil((this.props.height - 100) / 200)
        const children: VNode[] = []

        for (let i = -n; i <= n; i++) {
            const mainGradRef = FSComponent.createRef<SVGElement>()
            this.gradRectRefs.push(mainGradRef)
            children.push(
                <rect
                    ref={mainGradRef}
                    class="main-grad"
                    x="0"
                    y={fastToFixed(center - 2 + i * graduationSize, 0)}
                    height="4"
                    width="40"
                    fill="white"
                />
            )
            const gradTextRef = FSComponent.createRef<SVGElement>()
            this.gradTextRefs.push(gradTextRef)
            children.push(
                <text
                    ref={gradTextRef}
                    class="graduation-text"
                    x="50"
                    y={fastToFixed(center + 16 + i * graduationSize, 0)}
                    fill="white"
                    font-size="60"
                    font-family="Montserrat-Bold"
                >
                    XXXX
                </text>
            )
            for (let j = 1; j < 5; j++) {
                const subGradRef = FSComponent.createRef<SVGElement>()
                this.gradRectRefs.push(subGradRef)
                children.push(
                    <rect
                        ref={subGradRef}
                        class="grad"
                        x="0"
                        y={fastToFixed(
                            center - 2 + i * graduationSize + j * (graduationSize / 5),
                            0
                        )}
                        height="4"
                        width="15"
                        fill="white"
                    />
                )
            }
        }

        return (
            <g class="graduation-group" transform={this.tapeTransform}>
                {children}
            </g>
        )
    }

    private buildEndDigits(GF_font: string, endDigitSpace: number): VNode[] {
        this.endDigitRefs.length = 0
        const children: VNode[] = []
        for (let i = -2; i <= 2; i++) {
            const digitRef = FSComponent.createRef<SVGElement>()
            this.endDigitRefs.push(digitRef)
            children.push(
                <text
                    ref={digitRef}
                    x="46"
                    y={27 + endDigitSpace * i}
                    fill="white"
                    font-size="50"
                    font-family={GF_font}
                    text-anchor="middle"
                >
                    XX
                </text>
            )
        }
        return children
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
                        -0000
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
