import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    EventBus,
    ConsumerSubject,
    MappedSubject,
    AhrsEvents,
} from '@microsoft/msfs-sdk'
import { G5CustomEvents } from './G5CustomPublisher'

export interface HorizontalCompassProps extends ComponentProps {
    bus: EventBus
    truncateLeft: number
    truncateRight: number
    spacing: number
    groundTrackActive: boolean
}

export class HorizontalCompassComponent extends DisplayComponent<HorizontalCompassProps> {
    private readonly movingRibbonRef = FSComponent.createRef<SVGGElement>()
    private readonly courseRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly groundTrackRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly bearingTextRef = FSComponent.createRef<SVGTextElement>()
    private readonly digitRefs = [...Array(17)].map(() => FSComponent.createRef<SVGTextElement>())

    // ConsumerSubjects from the EventBus — reactive values for compass geometry
    private readonly heading: ConsumerSubject<number>
    private readonly track: ConsumerSubject<number>
    private readonly course: ConsumerSubject<number>

    // Derived Subscribables for declarative JSX attribute bindings
    private readonly courseBugTransform: MappedSubject<[number, number], string>
    private readonly trackBugTransform: MappedSubject<[number, number], string>

    constructor(props: HorizontalCompassProps) {
        super(props)
        const sub = props.bus.getSubscriber<AhrsEvents & G5CustomEvents>()

        this.heading = ConsumerSubject.create(sub.on('hdg_deg').withPrecision(0), 0)
        this.track = ConsumerSubject.create(sub.on('track_angle_magnetic').withPrecision(0), 0)
        this.course = ConsumerSubject.create(sub.on('ap_heading_selected').withPrecision(0), 0)

        const pxPerDeg = props.spacing / 10

        this.courseBugTransform = MappedSubject.create(
            ([hdg, crs]) => `translate(${Avionics.Utils.diffAngle(hdg, crs) * pxPerDeg}, 0)`,
            this.heading,
            this.course
        )

        this.trackBugTransform = MappedSubject.create(
            ([hdg, trk]) => `translate(${Avionics.Utils.diffAngle(hdg, trk) * pxPerDeg}, 0)`,
            this.heading,
            this.track
        )
    }

    get spacing(): number {
        return this.props.spacing
    }
    get truncateLeft(): number {
        return this.props.truncateLeft
    }
    get truncateRight(): number {
        return this.props.truncateRight
    }
    get groundTrackActive(): boolean {
        return this.props.groundTrackActive
    }
    get width(): number {
        return 288 - this.truncateLeft - this.truncateRight
    }
    get center(): number {
        return (this.width + (this.truncateRight - this.truncateLeft) / 2) / 2
    }
    get fontFamily(): string {
        return 'Montserrat-Bold'
    }

    onAfterRender(): void {
        this.heading.sub(() => {
            this.updateBearingDisplay()
        })
    }

    private updateBearingDisplay(): void {
        const heading = this.heading.get()
        const roundedBearing = Math.round(heading / 10) * 10
        const bearingString = Math.round(heading) + ''

        const bearingText = this.bearingTextRef.getOrDefault()
        if (bearingText)
            bearingText.textContent = '000'.slice(0, 3 - bearingString.length) + bearingString

        for (let i = -8; i <= 8; i++) {
            const digitString = ((roundedBearing + i * 10 + 360) % 360) + ''
            const digitEl = this.digitRefs[i + 8].getOrDefault()
            if (digitEl) digitEl.textContent = '000'.slice(0, 3 - digitString.length) + digitString
        }

        const movingRibbon = this.movingRibbonRef.getOrDefault()
        if (movingRibbon)
            movingRibbon.setAttribute(
                'transform',
                'translate(' + (roundedBearing - heading) * (this.props.spacing / 10) + ',0)'
            )
    }

    render(): VNode {
        const width = this.width
        const center = this.center
        const spacing = this.spacing
        const gradStops = [
            { offset: '0%', stopColor: 'rgb(9, 39, 61)', stopOpacity: '0.8' },
            { offset: '5%', stopColor: 'rgb(9, 39, 61)', stopOpacity: '0' },
            { offset: '95%', stopColor: 'rgb(9, 39, 61)', stopOpacity: '0' },
            { offset: '100%', stopColor: 'rgb(9, 39, 61)', stopOpacity: '0.8' },
        ]

        return (
            <svg class="horizontal-compass" width="100%" height="100%" viewBox={`0 0 ${width} 20`}>
                <defs>
                    <linearGradient id="horizshadowGradient">
                        {gradStops.map((s, i) => (
                            <stop
                                key={i}
                                offset={s.offset}
                                stop-color={s.stopColor}
                                stop-opacity={s.stopOpacity}
                            />
                        ))}
                    </linearGradient>
                </defs>
                <rect
                    class="compass-shadows"
                    fill="url(#horizshadowGradient)"
                    x="0"
                    y="0"
                    width={width}
                    height="20"
                />
                <rect
                    class="compass-background"
                    x="0"
                    y="0"
                    width={width}
                    height="20"
                    fill="#1a1d21"
                    fill-opacity="0.25"
                />
                <g ref={this.movingRibbonRef} class="moving-ribbon">
                    {[...Array(17)].map((_, i) => {
                        const idx = i - 8
                        return (
                            <text
                                ref={this.digitRefs[i]}
                                key={`digit-${i}`}
                                fill="white"
                                text-anchor="middle"
                                x={center + spacing * idx}
                                y="13"
                                font-size="8"
                                font-family={this.fontFamily}
                                letter-spacing="0.1em"
                            >
                                XXX
                            </text>
                        )
                    })}
                    {[...Array(161)].map((_, i) => {
                        const idx = i - 80
                        return (
                            <rect
                                key={`tick-${i}`}
                                x={center - 0.5 + (spacing / 10) * idx}
                                y={idx % 5 === 0 ? '15' : '18.5'}
                                width="1"
                                height={idx % 5 === 0 ? '5' : '1.5'}
                                fill="white"
                            />
                        )
                    })}
                </g>
                <polygon
                    class="course-bug"
                    points={`${center},20 ${center + 6},16 ${center + 10},16 ${center + 10},20 ${center - 10},20 ${center - 10},16 ${center - 6},16`}
                    fill="aqua"
                    transform={this.courseBugTransform}
                />
                <polygon
                    class="ground-track-bug"
                    points={`${center},15 ${center + 5},20 ${center - 5},20`}
                    fill="magenta"
                    stroke="black"
                    visibility={this.groundTrackActive ? '' : 'hidden'}
                    transform={this.trackBugTransform}
                />
                <polygon
                    class="bearing-background"
                    points={`${center},20 ${center + 4},16 ${center + 14},16 ${center + 14},0 ${center - 14},0 ${center - 14},16 ${center - 4},16`}
                    fill="black"
                    stroke="white"
                    stroke-width="0.5"
                />
                <g class="bearing-text-wrapper" transform="scale(0.85,1) translate(16,0)">
                    <text
                        ref={this.bearingTextRef}
                        class="bearing-text"
                        fill="white"
                        text-anchor="middle"
                        x={center}
                        y="13"
                        font-size="14"
                        font-family={this.fontFamily}
                    >
                        XXX
                    </text>
                </g>
            </svg>
        )
    }
}
