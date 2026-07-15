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

type IndicatorShape = 'diamond' | 'triangle'

export interface CDIProps extends ComponentProps {
    cdiSource: Subject<number>
    cdiDeviation: Subject<number>
    isVisible: Subject<boolean>
}

interface CDIScaleDotsProps extends ComponentProps {
    cx: number
    cy: number
}

class CDIScaleDots extends DisplayComponent<CDIScaleDotsProps> {
    private static readonly DOTS_PER_SIDE = 2
    private static readonly DOT_SPACING = 20

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

interface CDIDeviationIndicatorProps extends ComponentProps {
    shape: Subscribable<IndicatorShape>
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
    private readonly indicatorShape: MappedSubject<[IndicatorShape], string>

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

        this.indicatorShape = MappedSubject.create(
            ([shape]) => this.buildPath(shape),
            props.shape
        ).pause()
    }

    public onAfterRender(): void {
        this.fill.resume()
        this.transform.resume()
        this.indicatorShape.resume()
    }

    public destroy(): void {
        this.fill.destroy()
        this.transform.destroy()
        this.indicatorShape.destroy()
        super.destroy()
    }

    private buildPath(shape: IndicatorShape): string {
        const { cx, cy, size: w } = this.props
        switch (shape) {
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
                points={this.indicatorShape}
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
    private readonly indicatorShape: MappedSubject<[string], IndicatorShape>

    constructor(props: CDIProps) {
        super(props)

        this.display = MappedSubject.create(
            ([visible]) => (visible ? 'inherit' : 'none'),
            props.isVisible
        ).pause()
        this.indicatorShape = MappedSubject.create(
            ([src]) => (src === 1 || src === 2 ? 'diamond' : 'triangle'),
            props.cdiSource
        ).pause()
    }

    public onAfterRender(): void {
        this.display.resume()
        this.indicatorShape.resume()
    }

    public destroy(): void {
        this.display.destroy()
        this.indicatorShape.destroy()
        super.destroy()
    }

    public render(): VNode {
        const height = 10
        const cx = CDIComponent.CENTER_X
        const cy = height / 2

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
                    fill-opacity="0.5"
                    stroke={Colors.WHITE}
                    stroke-width="0.75"
                />
                <CDIScaleDots cx={cx} cy={cy} />
                <rect x={cx - 0.5} y="0" width="0.5" height={height} fill={Colors.WHITE} />
                <CDIDeviationIndicator
                    shape={this.indicatorShape}
                    cx={cx}
                    cy={cy}
                    size={4}
                    source={this.props.cdiSource}
                    deviation={this.props.cdiDeviation}
                />
            </svg>
        )
    }
}
