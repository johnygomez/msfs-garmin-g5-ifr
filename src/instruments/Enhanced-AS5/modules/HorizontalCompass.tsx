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
import { Colors } from './Utils'

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

    // Ribbon scroll transform
    private readonly ribbonTransform: MappedSubject<[number], string>

    // Bearing text (center display showing current heading, e.g. "270")
    private readonly bearingText: MappedSubject<[number], string>

    // Ribbon digit labels (17 marks spanning ±80° in 10° increments)
    private readonly digitTextSubjects: MappedSubject<[number], string>[] = []

    constructor(props: HorizontalCompassProps) {
        super(props)
        const sub = props.bus.getSubscriber<AhrsEvents & G5CustomEvents>()

        this.heading = ConsumerSubject.create(sub.on('actual_hdg_deg').withPrecision(1), 0)
        this.track = ConsumerSubject.create(sub.on('track_angle_magnetic').withPrecision(1), 0)
        this.course = ConsumerSubject.create(sub.on('ap_heading_selected').withPrecision(1), 0)

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

        // --- Ribbon scroll transform ---
        this.ribbonTransform = MappedSubject.create(([hdg]) => {
            const roundedBearing = Math.round(hdg / 10) * 10
            return `translate(${(roundedBearing - hdg) * pxPerDeg}, 0)`
        }, this.heading)

        // --- Center bearing text (padded to 3 digits) ---
        this.bearingText = MappedSubject.create(([hdg]) => {
            const bearingString = Math.round(hdg) + ''
            return '000'.slice(0, 3 - bearingString.length) + bearingString
        }, this.heading)

        // --- Ribbon digit labels (17 marks at 10° intervals) ---
        for (let i = 0; i < 17; i++) {
            const idx = i - 8 // -8 … +8 → ±80°
            this.digitTextSubjects.push(
                MappedSubject.create(([hdg]) => {
                    const roundedBearing = Math.round(hdg / 10) * 10
                    const digitString = ((roundedBearing + idx * 10 + 360) % 360) + ''
                    return '000'.slice(0, 3 - digitString.length) + digitString
                }, this.heading)
            )
        }
    }

    destroy(): void {
        this.heading.destroy()
        this.track.destroy()
        this.course.destroy()

        this.courseBugTransform.destroy()
        this.trackBugTransform.destroy()
        this.ribbonTransform.destroy()
        this.bearingText.destroy()
        this.digitTextSubjects.forEach(s => s.destroy())

        super.destroy()
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
        return 'OpenSans-Bold'
    }

    render(): VNode {
        const width = this.width
        const center = this.center
        const spacing = this.spacing
        const gradStops = [
            { offset: '0%', stopColor: Colors.SHADOW_COMPASS_BLUE, stopOpacity: '0.8' },
            { offset: '5%', stopColor: Colors.SHADOW_COMPASS_BLUE, stopOpacity: '0' },
            { offset: '95%', stopColor: Colors.SHADOW_COMPASS_BLUE, stopOpacity: '0' },
            { offset: '100%', stopColor: Colors.SHADOW_COMPASS_BLUE, stopOpacity: '0.8' },
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
                    fill={Colors.PFD_BOX_BG}
                    fill-opacity="0.25"
                />
                <g
                    ref={this.movingRibbonRef}
                    class="moving-ribbon"
                    transform={this.ribbonTransform}
                >
                    {[...Array(17)].map((_, i) => {
                        const idx = i - 8
                        return (
                            <text
                                ref={this.digitRefs[i]}
                                key={`digit-${i}`}
                                fill={Colors.WHITE}
                                text-anchor="middle"
                                x={center + spacing * idx}
                                y="13"
                                font-size="8"
                                font-family={this.fontFamily}
                                letter-spacing="0.1em"
                            >
                                {this.digitTextSubjects[i].map(v => v)}
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
                                fill={Colors.WHITE}
                            />
                        )
                    })}
                </g>
                <polygon
                    class="course-bug"
                    points={`${center},20 ${center + 6},16 ${center + 10},16 ${center + 10},20 ${center - 10},20 ${center - 10},16 ${center - 6},16`}
                    fill={Colors.CYAN}
                    transform={this.courseBugTransform}
                />
                <polygon
                    class="ground-track-bug"
                    points={`${center},15 ${center + 5},20 ${center - 5},20`}
                    fill={Colors.MAGENTA}
                    stroke={Colors.BLACK}
                    visibility={this.groundTrackActive ? '' : 'hidden'}
                    transform={this.trackBugTransform}
                />
                <polygon
                    class="bearing-background"
                    points={`${center},20 ${center + 4},16 ${center + 14},16 ${center + 14},0 ${center - 14},0 ${center - 14},16 ${center - 4},16`}
                    fill={Colors.BLACK}
                    stroke={Colors.WHITE}
                    stroke-width="0.5"
                />
                <g class="bearing-text-wrapper" transform="scale(0.85,1) translate(16,0)">
                    <text
                        ref={this.bearingTextRef}
                        class="bearing-text"
                        fill={Colors.WHITE}
                        text-anchor="middle"
                        x={center}
                        y="13"
                        font-size="14"
                        font-family={this.fontFamily}
                    >
                        {this.bearingText.map(v => v)}
                    </text>
                </g>
            </svg>
        )
    }
}
