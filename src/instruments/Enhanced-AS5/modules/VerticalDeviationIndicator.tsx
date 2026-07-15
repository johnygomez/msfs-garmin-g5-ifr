import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    MappedSubject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { Colors } from './Utils'

export type VerticalDeviationMode = 'None' | 'GS' | 'GP' | 'GSPreview'

type GuidanceMode = Exclude<VerticalDeviationMode, 'None'>

type BugShape = 'chevron' | 'diamond' | 'hollow-diamond'

const BUG_SHAPES: Readonly<Record<GuidanceMode, BugShape>> = {
    GS: 'chevron',
    GP: 'diamond',
    GSPreview: 'hollow-diamond',
}

const DOTS_PER_SIDE = 2
const DOT_SPACING = 20
const MAX_DEFLECTION = 45

const VIEW_WIDTH = 10
const VIEW_HEIGHT = 100

const CENTER_X = VIEW_WIDTH / 2
const CENTER_Y = VIEW_HEIGHT / 2

const BUG_SIZE = 4

export interface VerticalDeviationIndicatorProps extends ComponentProps {
    mode: Subscribable<VerticalDeviationMode>
    deviation: Subscribable<number>
}

interface VerticalDeviationScaleDotsProps extends ComponentProps {
    cx: number
    cy: number
}

class VerticalDeviationScaleDots extends DisplayComponent<VerticalDeviationScaleDotsProps> {
    public render(): VNode {
        const offsets = Array.from(
            { length: DOTS_PER_SIDE * 2 + 1 },
            (_, i) => i - DOTS_PER_SIDE
        ).filter(idx => idx !== 0)

        return (
            <>
                {offsets.map(idx => (
                    <circle
                        class="vertical-deviation-grad"
                        cx={this.props.cx}
                        cy={this.props.cy + DOT_SPACING * idx}
                        r="2.5"
                        fill={Colors.NONE}
                        stroke={Colors.WHITE}
                        stroke-width="0.5"
                    />
                ))}
            </>
        )
    }
}

interface VerticalModeIndicatorProps extends ComponentProps {
    mode: Subscribable<VerticalDeviationMode>
}

class VerticalModeIndicator extends DisplayComponent<VerticalModeIndicatorProps> {
    private readonly style: MappedSubject<[VerticalDeviationMode], string>

    constructor(props: VerticalModeIndicatorProps) {
        super(props)

        this.style = MappedSubject.create(
            ([mode]) => (mode === 'None' ? 'display: none;' : 'display: block;'),
            props.mode
        ).pause()
    }

    public onAfterRender(): void {
        this.style.resume()
    }

    public destroy(): void {
        this.style.destroy()
        super.destroy()
    }

    public render(): VNode {
        return (
            <div class="vertical-deviation-mode-indicator" style={this.style}>
                <span class="vertical-mode">G</span>
            </div>
        )
    }
}

interface VerticalDeviationBugProps extends ComponentProps {
    shape: Subscribable<BugShape | undefined>
    cx: number
    cy: number
    deviation: Subscribable<number>
}

class VerticalDeviationBug extends DisplayComponent<VerticalDeviationBugProps> {
    private readonly points: MappedSubject<[BugShape | undefined], string>
    private readonly fill: MappedSubject<[BugShape | undefined], string>
    private readonly stroke: MappedSubject<[BugShape | undefined], string>
    private readonly transform: MappedSubject<[number], string>

    constructor(props: VerticalDeviationBugProps) {
        super(props)

        this.points = MappedSubject.create(
            ([shape]) => (shape === undefined ? '' : this.buildPoints(shape)),
            props.shape
        ).pause()

        this.fill = MappedSubject.create(([shape]) => {
            switch (shape) {
                case 'diamond':
                    return Colors.GREEN
                case 'hollow-diamond':
                    return Colors.HOLLOW_DIAMOND
                case 'chevron':
                default:
                    return Colors.MAGENTA
            }
        }, props.shape).pause()

        this.stroke = MappedSubject.create(
            ([shape]) => (shape === 'hollow-diamond' ? Colors.NONE : Colors.BLACK),
            props.shape
        ).pause()

        this.transform = MappedSubject.create(([deviation]) => {
            const clamped = Math.min(1, Math.max(-1, deviation))
            return `translate(0, ${clamped * MAX_DEFLECTION})`
        }, props.deviation).pause()
    }

    public onAfterRender(): void {
        this.points.resume()
        this.fill.resume()
        this.stroke.resume()
        this.transform.resume()
    }

    public destroy(): void {
        this.points.destroy()
        this.fill.destroy()
        this.stroke.destroy()
        this.transform.destroy()
        super.destroy()
    }

    private buildPoints(shape: BugShape): string {
        const { cx, cy } = this.props
        const w = BUG_SIZE
        switch (shape) {
            case 'chevron':
                return `${cx - w},${cy} ${cx + w * 0.75},${cy - w} ${cx + w * 0.75},${cy - w / 2} ${cx},${cy} ${cx + w * 0.75},${cy + w / 2} ${cx + w * 0.75},${cy + w}`
            case 'diamond':
                return `${cx - w},${cy} ${cx},${cy - w} ${cx + w},${cy} ${cx},${cy + w}`
            case 'hollow-diamond':
                return `${cx - w},${cy} ${cx},${cy - w} ${cx + w},${cy} ${cx},${cy + w} ${cx},${cy + w / 3} ${cx + w / 3},${cy} ${cx},${cy - w / 3} ${cx - w / 3},${cy} ${cx},${cy + w / 3} ${cx},${cy + w}`
        }
    }

    public render(): VNode {
        return (
            <polygon
                class="vertical-deviation-bug"
                points={this.points}
                fill={this.fill}
                stroke={this.stroke}
                stroke-width="0.5"
                transform={this.transform}
            />
        )
    }
}

export class VerticalDeviationIndicatorComponent extends DisplayComponent<VerticalDeviationIndicatorProps> {
    private readonly display: MappedSubject<[VerticalDeviationMode], string>
    private readonly bugShape: MappedSubject<[VerticalDeviationMode], BugShape | undefined>

    constructor(props: VerticalDeviationIndicatorProps) {
        super(props)

        this.display = MappedSubject.create(
            ([mode]) => (mode === 'None' ? 'none' : 'inherit'),
            props.mode
        ).pause()

        this.bugShape = MappedSubject.create(
            ([mode]) => (mode === 'None' ? undefined : BUG_SHAPES[mode]),
            props.mode
        ).pause()
    }

    public onAfterRender(): void {
        this.display.resume()
        this.bugShape.resume()
    }

    public destroy(): void {
        this.display.destroy()
        this.bugShape.destroy()
        super.destroy()
    }

    public render(): VNode {
        return (
            <>
                <VerticalModeIndicator mode={this.props.mode} />
                <svg
                    class="vertical-deviation"
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                    display={this.display}
                >
                    <rect
                        class="vertical-deviation-background"
                        x="0"
                        y={0}
                        width={VIEW_WIDTH}
                        height={VIEW_HEIGHT}
                        fill={Colors.PFD_BOX_BG}
                        fill-opacity="0.5"
                        stroke={Colors.WHITE}
                        stroke-width="0.75"
                    />
                    <rect
                        class="vertical-deviation-centre-line"
                        x="0"
                        y={VIEW_HEIGHT / 2 - 0.25}
                        width={VIEW_WIDTH}
                        height="0.5"
                        fill={Colors.WHITE}
                    />
                    <VerticalDeviationScaleDots cx={CENTER_X} cy={CENTER_Y} />
                    <VerticalDeviationBug
                        shape={this.bugShape}
                        cx={CENTER_X}
                        cy={CENTER_Y}
                        deviation={this.props.deviation}
                    />
                </svg>
            </>
        )
    }
}
