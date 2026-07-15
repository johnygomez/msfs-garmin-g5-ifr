import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    MappedSubject,
    Subject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { Colors } from './Utils'

export interface CDIProps extends ComponentProps {
    noScale: boolean
    indicatorShape: string
    cdiSource: Subject<number>
    cdiDeviation: Subject<number>
    isVisible: Subject<boolean>
}

interface CDIScaleDotsProps extends ComponentProps {
    cx: number
    cy: number
}

class CDIScaleDots extends DisplayComponent<CDIScaleDotsProps> {
    private static readonly DOTS_PER_SIDE = 4
    private static readonly DOT_SPACING = 10

    public render(): VNode {
        const offsets = Array.from(
            { length: CDIScaleDots.DOTS_PER_SIDE * 2 + 1 },
            (_, i) => i - CDIScaleDots.DOTS_PER_SIDE
        ).filter(idx => idx !== 0)

        return (
            <>
                {offsets.map(idx => (
                    <circle
                        cx={this.props.cx + CDIScaleDots.DOT_SPACING * idx}
                        cy={this.props.cy}
                        r="2"
                        fill={Colors.NONE}
                        stroke={Colors.WHITE}
                        stroke-width="0.5"
                    />
                ))}
            </>
        )
    }
}

interface CDIScaleLabelsProps extends ComponentProps {
    y: number
}

class CDIScaleLabels extends DisplayComponent<CDIScaleLabelsProps> {
    public render(): VNode {
        return (
            <>
                <text
                    fill={Colors.WHITE}
                    text-anchor="middle"
                    x="10"
                    y={this.props.y}
                    font-size="5"
                >
                    AUTO
                </text>
                <text
                    fill={Colors.WHITE}
                    text-anchor="middle"
                    x="90"
                    y={this.props.y}
                    font-size="5"
                >
                    5NM
                </text>
            </>
        )
    }
}

interface CDIDeviationIndicatorProps extends ComponentProps {
    shape: string
    cx: number
    cy: number
    size: number
    source: Subscribable<number>
    deviation: Subscribable<number>
}

class CDIDeviationIndicator extends DisplayComponent<CDIDeviationIndicatorProps> {
    private static readonly MAX_DEFLECTION_PX = 45

    private readonly fill: MappedSubject<[number], string>
    private readonly transform: MappedSubject<[number], string>

    constructor(props: CDIDeviationIndicatorProps) {
        super(props)

        this.fill = MappedSubject.create(
            ([source]) => (source === 1 || source === 2 ? Colors.GREEN : Colors.MAGENTA),
            props.source
        ).pause()

        this.transform = MappedSubject.create(([deviation]) => {
            const clamped = Math.min(1, Math.max(-1, deviation))
            return `translate(${clamped * CDIDeviationIndicator.MAX_DEFLECTION_PX}, 0)`
        }, props.deviation).pause()
    }

    public onAfterRender(): void {
        this.fill.resume()
        this.transform.resume()
    }

    public destroy(): void {
        this.fill.destroy()
        this.transform.destroy()
        super.destroy()
    }

    private buildPoints(): string {
        const { cx, cy, size: w } = this.props
        switch (this.props.shape.toLowerCase()) {
            case 'diamond':
                return `${cx - w},${cy} ${cx},${cy + w} ${cx + w},${cy} ${cx},${cy - w}`
            case 'triangle':
            default:
                return `${cx - w},${cy + w} ${cx + w},${cy + w} ${cx},${cy - w}`
        }
    }

    public render(): VNode {
        return (
            <polygon
                points={this.buildPoints()}
                fill={this.fill}
                stroke={Colors.BLACK}
                stroke-width="0.25"
                transform={this.transform}
                transform-origin="center"
            />
        )
    }
}

export class CDIComponent extends DisplayComponent<CDIProps> {
    private static readonly CENTER_X = 50

    private readonly display: MappedSubject<[boolean], string>

    constructor(props: CDIProps) {
        super(props)

        this.display = MappedSubject.create(
            ([visible]) => (visible ? 'inherit' : 'none'),
            props.isVisible
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
        const { noScale, indicatorShape } = this.props
        const height = noScale ? 10 : 15
        const cx = CDIComponent.CENTER_X
        const cy = height / 2
        const indicatorSize = noScale ? 4 : 5

        return (
            <svg
                class="cdi"
                width="100%"
                height="100%"
                viewBox={`0 0 100 ${height}`}
                display={this.display}
            >
                <rect
                    x="0"
                    y="0"
                    width="100"
                    height={height}
                    fill={Colors.PFD_BOX_BG}
                    fill-opacity="0.75"
                    stroke={Colors.WHITE}
                    stroke-width="0.75"
                />
                <CDIScaleDots cx={cx} cy={cy} />
                <rect x={cx - 0.5} y="0" width="0.5" height={height} fill={Colors.WHITE} />
                {!noScale && <CDIScaleLabels y={height - 1} />}
                <CDIDeviationIndicator
                    shape={indicatorShape}
                    cx={cx}
                    cy={cy}
                    size={indicatorSize}
                    source={this.props.cdiSource}
                    deviation={this.props.cdiDeviation}
                />
            </svg>
        )
    }
}
