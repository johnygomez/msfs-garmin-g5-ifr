import { DisplayComponent, FSComponent, VNode, ComponentProps } from '@microsoft/msfs-sdk';

export interface CDIElementRefs {
    root: SVGElement;
    scaleText: SVGElement | null;
    deviationIndicator: SVGElement;
}

export interface CDIProps extends ComponentProps {
    noScale: boolean;
    indicatorShape: string;
    onApi: (refs: CDIElementRefs) => void;
}

export class CDIComponent extends DisplayComponent<CDIProps> {
    private readonly rootRef = FSComponent.createRef<SVGElement>();
    private readonly scaleTextRef = FSComponent.createRef<SVGTextElement>();
    private readonly deviationRef = FSComponent.createRef<SVGPolygonElement>();

    get noScale(): boolean { return this.props.noScale; }
    get indicatorShape(): string { return this.props.indicatorShape; }
    get svgHeight(): number { return this.noScale ? 10 : 15; }

    onAfterRender(): void {
        if (this.props.onApi) {
            this.props.onApi({
                root: this.rootRef.getOrDefault(),
                scaleText: this.noScale ? null : this.scaleTextRef.getOrDefault(),
                deviationIndicator: this.deviationRef.getOrDefault(),
            });
        }
    }

    private buildIndicatorShape(cx: number, cy: number, w: number): VNode {
        let points: string;
        switch (this.indicatorShape.toLowerCase()) {
            case 'diamond':
                points = `${cx - w},${cy} ${cx},${cy + w} ${cx + w},${cy} ${cx},${cy - w}`;
                break;
            case 'triangle':
            default:
                points = `${cx - w},${cy + w} ${cx + w},${cy + w} ${cx},${cy - w}`;
                break;
        }
        return <polygon ref={this.deviationRef} points={points} fill="magenta" stroke="black" stroke-width="0.25" transform-origin="center" />;
    }

    render(): VNode {
        const svgHeight = this.svgHeight;
        const cy = svgHeight / 2;
        const cx = 50;
        const w = this.noScale ? 4 : 5;

        return (
            <svg ref={this.rootRef} class="cdi" width="100%" height="100%" viewBox={`0 0 100 ${svgHeight}`}>
                <rect x="0" y="0" width="100" height={`${svgHeight}`} fill="#1a1d21" fill-opacity="0.25" stroke="white" stroke-width="0.75" />
                {[...Array(9)].map((_, i) => {
                    const idx = i - 4;
                    if (idx === 0) return null;
                    return <circle key={i} cx={`${cx + 10 * idx}`} cy={`${cy}`} r="2" fill="none" stroke="white" stroke-width="0.5" />;
                })}
                <rect x={`${cx - 0.5}`} y="0" width="0.5" height={`${svgHeight}`} fill="white" />
                {!this.noScale && (
                    <>
                        <text fill="white" text-anchor="middle" x="10" y={`${svgHeight - 1}`} font-size="5" font-family="Roboto-Bold">AUTO</text>
                        <text ref={this.scaleTextRef} fill="white" text-anchor="middle" x="90" y={`${svgHeight - 1}`} font-size="5" font-family="Roboto-Bold">5NM</text>
                    </>
                )}
                {this.buildIndicatorShape(cx, cy, w)}
            </svg>
        );
    }
}
