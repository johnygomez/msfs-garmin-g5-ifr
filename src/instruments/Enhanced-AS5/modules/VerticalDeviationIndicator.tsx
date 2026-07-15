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

type BugShape = 'chevron' | 'diamond' | 'hollow-diamond'

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

    private readonly modeStyles

    constructor(props: VerticalModeIndicatorProps) {
        super(props)

        this.style = MappedSubject.create(
            ([mode]) => this.computeVisbility(mode),
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

    private computeVisbility(mode: VerticalDeviationMode): string {
        switch (mode) {
            case 'None':
                return 'display: none;'
            case 'GS':
                return 'display: none;'
            case 'GP':
                return 'display: block;'
            case 'GSPreview':
                return 'display: block;'
        }
    }
}

interface VerticalDeviationBugProps extends ComponentProps {
    mode: Subscribable<VerticalDeviationMode>
    cx: number
    cy: number
    deviation: Subscribable<number>
}

class VerticalDeviationBug extends DisplayComponent<VerticalDeviationBugProps> {
    private readonly shape: MappedSubject<[VerticalDeviationMode], BugShape | undefined>
    private readonly points: MappedSubject<[BugShape | undefined], string>
    private readonly fill: MappedSubject<[BugShape | undefined], string>
    private readonly stroke: MappedSubject<[BugShape | undefined], string>
    private readonly transform: MappedSubject<[number], string>

    constructor(props: VerticalDeviationBugProps) {
        super(props)

        this.points = MappedSubject.create(([mode]) => this.buildShape(mode), props.mode).pause()

        this.fill = MappedSubject.create(([mode]) => this.computeColor(mode), props.mode).pause()

        this.stroke = MappedSubject.create(
            ([mode]) => (mode === 'None' ? Colors.NONE : Colors.BLACK),
            props.mode
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

    private buildShape(mode: VerticalDeviationMode): string {
        const { cx, cy } = this.props
        const w = BUG_SIZE
        switch (mode) {
            case 'GSPreview':
                return `${cx - w},${cy} ${cx + w * 0.75},${cy - w} ${cx + w * 0.75},${cy - w / 2} ${cx},${cy} ${cx + w * 0.75},${cy + w / 2} ${cx + w * 0.75},${cy + w}`
            case 'GS':
            case 'GP':
                return `${cx - w},${cy} ${cx},${cy - w} ${cx + w},${cy} ${cx},${cy + w}`
            case 'None':
                return `${cx - w},${cy} ${cx},${cy - w} ${cx + w},${cy} ${cx},${cy + w} ${cx},${cy + w / 3} ${cx + w / 3},${cy} ${cx},${cy - w / 3} ${cx - w / 3},${cy} ${cx},${cy + w / 3} ${cx},${cy + w}`
        }
    }

    private computeColor(mode: VerticalDeviationMode): string {
        switch (mode) {
            case 'GSPreview':
                return Colors.MAGENTA
            case 'GS':
                return Colors.GREEN
            case 'GP':
                return Colors.MAGENTA
            case 'None':
                return Colors.HOLLOW_DIAMOND
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

    constructor(props: VerticalDeviationIndicatorProps) {
        super(props)

        this.display = MappedSubject.create(
            ([mode]) => (mode === 'None' ? 'none' : 'inherit'),
            props.mode
        ).pause()
    }

    public onAfterRender(): void {
        this.display.resume()
    }

    public destroy(): void {
        this.display.destroy()
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
                        mode={this.props.mode}
                        cx={CENTER_X}
                        cy={CENTER_Y}
                        deviation={this.props.deviation}
                    />
                </svg>
            </>
        )
    }
}
