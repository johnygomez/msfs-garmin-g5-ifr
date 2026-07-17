import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    EventBus,
    ConsumerSubject,
    MappedSubject,
    Subscribable,
    AhrsEvents,
    NavMath,
} from '@microsoft/msfs-sdk'

import { Colors } from '../common/Utils'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'

// The ribbon spans ±80° around the current heading, with a labelled mark every
// 10° and a tick every 1°.
const RIBBON_HALF_SPAN_DEG = 80
const DIGIT_HALF_COUNT = RIBBON_HALF_SPAN_DEG / 10
const DIGIT_COUNT = DIGIT_HALF_COUNT * 2 + 1
const TICK_COUNT = RIBBON_HALF_SPAN_DEG * 2 + 1

const pad3 = (deg: number): string => deg.toString().padStart(3, '0')
const roundTo10 = (deg: number): number => Math.round(deg / 10) * 10

export interface HorizontalCompassProps extends ComponentProps {
    bus: EventBus
    truncateLeft: number
    truncateRight: number
    spacing: number
    groundTrackActive: boolean
}

export class HorizontalCompassComponent extends DisplayComponent<HorizontalCompassProps> {
    private readonly heading: ConsumerSubject<number>
    private readonly track: ConsumerSubject<number>
    private readonly course: ConsumerSubject<number>

    private readonly courseBugTransform: MappedSubject<[number, number], string>
    private readonly trackBugTransform: MappedSubject<[number, number], string>
    private readonly ribbonTransform: MappedSubject<[number], string>
    private readonly bearingText: MappedSubject<[number], string>
    private readonly digitTextSubjects: MappedSubject<[number], string>[] = []

    constructor(props: HorizontalCompassProps) {
        super(props)
        const sub = props.bus.getSubscriber<AhrsEvents & G5CustomEvents>()

        this.heading = ConsumerSubject.create(sub.on('actual_hdg_deg').withPrecision(1), 0)
        this.track = ConsumerSubject.create(sub.on('track_angle_magnetic').withPrecision(1), 0)
        this.course = ConsumerSubject.create(sub.on('ap_heading_selected').withPrecision(1), 0)

        const pxPerDeg = props.spacing / 10

        // A bug sits at its angular offset from the current heading, scaled to pixels.
        const bugTransform = (
            target: Subscribable<number>
        ): MappedSubject<[number, number], string> =>
            MappedSubject.create(
                ([hdg, deg]) => `translate(${NavMath.diffAngle(hdg, deg) * pxPerDeg}, 0)`,
                this.heading,
                target
            )

        this.courseBugTransform = bugTransform(this.course)
        this.trackBugTransform = bugTransform(this.track)

        this.ribbonTransform = MappedSubject.create(
            ([hdg]) => `translate(${(roundTo10(hdg) - hdg) * pxPerDeg}, 0)`,
            this.heading
        )

        this.bearingText = MappedSubject.create(([hdg]) => pad3(Math.round(hdg)), this.heading)

        for (let i = 0; i < DIGIT_COUNT; i++) {
            const idx = i - DIGIT_HALF_COUNT
            this.digitTextSubjects.push(
                MappedSubject.create(
                    ([hdg]) => pad3((roundTo10(hdg) + idx * 10 + 360) % 360),
                    this.heading
                )
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

    get width(): number {
        return 288 - this.props.truncateLeft - this.props.truncateRight
    }
    get center(): number {
        return (this.width + (this.props.truncateRight - this.props.truncateLeft) / 2) / 2
    }
    get fontFamily(): string {
        return 'OpenSans-Bold'
    }

    render(): VNode {
        const width = this.width
        const center = this.center
        const spacing = this.props.spacing
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
                <g class="moving-ribbon" transform={this.ribbonTransform}>
                    {[...Array(DIGIT_COUNT)].map((_, i) => {
                        const idx = i - DIGIT_HALF_COUNT
                        return (
                            <text
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
                    {[...Array(TICK_COUNT)].map((_, i) => {
                        const idx = i - RIBBON_HALF_SPAN_DEG
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
                    points={`${center},18 ${center + 2},16 ${center + 7},16 ${center + 6},20 ${center - 6},20 ${center - 7},16 ${center - 2},16`}
                    fill={Colors.CYAN}
                    stroke={Colors.BLACK}
                    transform={this.courseBugTransform}
                />
                <polygon
                    class="ground-track-bug"
                    points={`${center},17 ${center + 3},20 ${center - 3},20`}
                    fill={Colors.MAGENTA}
                    stroke={Colors.BLACK}
                    visibility={this.props.groundTrackActive ? '' : 'hidden'}
                    transform={this.trackBugTransform}
                />
                <polygon
                    class="bearing-background"
                    points={`${center},18 ${center + 4},14 ${center + 14},14 ${center + 14},0 ${center - 14},0 ${center - 14},14 ${center - 4},14`}
                    fill={Colors.BLACK}
                    stroke={Colors.WHITE}
                    stroke-width="0.5"
                />
                <g class="bearing-text-wrapper" transform="translate(-0.5,0)">
                    <text
                        class="bearing-text"
                        fill={Colors.WHITE}
                        text-anchor="middle"
                        x={center}
                        y="11"
                        font-size="13"
                        font-family={this.fontFamily}
                    >
                        {this.bearingText.map(v => v)}
                    </text>
                </g>
            </svg>
        )
    }
}
