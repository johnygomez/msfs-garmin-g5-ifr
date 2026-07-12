import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    Subject,
    Subscription,
} from '@microsoft/msfs-sdk'
import { Colors } from './Utils'

export type APDisplayMode = 'RedFlash' | 'YellowFlash' | 'Red' | 'Yellow' | ''

const DISPLAY_COLORS: Record<string, string> = {
    '': Colors.GREEN,
    Red: Colors.RED,
    Yellow: Colors.YELLOW,
    RedFlash: Colors.RED,
    YellowFlash: Colors.YELLOW,
}

export interface APInfoBarSubjects {
    apStatus: Subject<string>
    apStatusDisplay: Subject<string>
    apLateralActive: Subject<string>
    apLateralArmed: Subject<string>
    apVerticalActive: Subject<string>
    apModeReference: Subject<string>
    apArmed: Subject<string>
    apArmedReference: Subject<string>
    apYDStatus: Subject<string>
}

export interface APInfoBarProps extends APInfoBarSubjects, ComponentProps {}

export class APInfoBarComponent extends DisplayComponent<APInfoBarProps> {
    private readonly lateralArmedRef = FSComponent.createRef<SVGTextElement>()
    private readonly lateralActiveRef = FSComponent.createRef<SVGTextElement>()
    private readonly statusRef = FSComponent.createRef<SVGTextElement>()
    private readonly verticalActiveRef = FSComponent.createRef<SVGTextElement>()
    private readonly modeReferenceRef = FSComponent.createRef<SVGTextElement>()
    private readonly armedRef = FSComponent.createRef<SVGTextElement>()
    private readonly armedReferenceRef = FSComponent.createRef<SVGTextElement>()

    private readonly subs: Subscription[] = []

    onAfterRender(): void {
        const statusEl = this.statusRef.getOrDefault()!

        this.subs.push(
            this.props.apStatus.sub(v => {
                statusEl.textContent = v
            }, true),
            this.props.apStatusDisplay.sub(v => {
                statusEl.style.fill = DISPLAY_COLORS[v] || DISPLAY_COLORS['']
            }, true),
            this.props.apLateralActive.sub(v => {
                this.lateralActiveRef.getOrDefault()!.textContent = v
            }, true),
            this.props.apLateralArmed.sub(v => {
                this.lateralArmedRef.getOrDefault()!.textContent = v
            }, true),
            this.props.apVerticalActive.sub(v => {
                this.verticalActiveRef.getOrDefault()!.textContent = v
            }, true),
            this.props.apModeReference.sub(v => {
                this.modeReferenceRef.getOrDefault()!.textContent = v
            }, true),
            this.props.apArmed.sub(v => {
                this.armedRef.getOrDefault()!.textContent = v
            }, true),
            this.props.apArmedReference.sub(v => {
                this.armedReferenceRef.getOrDefault()!.textContent = v
            }, true)
        )
    }

    destroy(): void {
        this.subs.forEach(s => s.destroy())
        super.destroy()
    }

    render(): VNode {
        const width = 512
        const height = 18
        const fontFamily = 'OpenSans-Bold'
        const fontSize = 18
        const textBase = 15

        return (
            <svg
                ref={FSComponent.createRef<SVGElement>()}
                class="ap-infobar"
                width="100%"
                height={`${height}px`}
                viewBox={`0 0 ${width} ${height}`}
            >
                <rect
                    class="ap-background"
                    x="0"
                    y="0"
                    width={`${width}`}
                    height={`${height}`}
                    fill={Colors.BLACK}
                />
                <rect
                    class="underline"
                    x="0"
                    y={`${height - 1}`}
                    height="1"
                    width={`${width}`}
                    fill={Colors.WHITE}
                />
                <rect
                    class="divider"
                    x="160"
                    y="2"
                    height={`${height - 6}`}
                    width="1"
                    fill={Colors.WHITE}
                />
                <rect
                    class="divider"
                    x="256"
                    y="2"
                    height={`${height - 6}`}
                    width="1"
                    fill={Colors.WHITE}
                />
                <text
                    ref={this.lateralArmedRef}
                    id="AP_LateralArmed"
                    fill={Colors.WHITE}
                    x="20"
                    y={`${textBase}`}
                    font-size={`${fontSize}`}
                    font-family={fontFamily}
                >
                    GPS
                </text>
                <text
                    ref={this.lateralActiveRef}
                    id="AP_LateralActive"
                    fill={Colors.GREEN}
                    x="95"
                    y={`${textBase}`}
                    font-size={`${fontSize}`}
                    font-family={fontFamily}
                >
                    HDG
                </text>
                <text
                    ref={this.statusRef}
                    id="AP_Status"
                    fill={Colors.GREEN}
                    x="195"
                    y={`${textBase}`}
                    font-size={`${fontSize}`}
                    font-family={fontFamily}
                >
                    AP
                </text>
                <text
                    ref={this.verticalActiveRef}
                    id="AP_VerticalActive"
                    fill={Colors.GREEN}
                    x="280"
                    y={`${textBase}`}
                    font-size={`${fontSize}`}
                    font-family={fontFamily}
                >
                    ALT
                </text>
                <text
                    ref={this.modeReferenceRef}
                    id="AP_ModeReference"
                    fill={Colors.GREEN}
                    x="330"
                    y={`${textBase}`}
                    font-size={`${fontSize}`}
                    font-family={fontFamily}
                >
                    200
                </text>
                <text
                    ref={this.armedRef}
                    id="AP_Armed"
                    fill={Colors.WHITE}
                    x="410"
                    y={`${textBase}`}
                    font-size={`${fontSize}`}
                    font-family={fontFamily}
                >
                    ALT
                </text>
                <text
                    ref={this.armedReferenceRef}
                    id="AP_ArmedReference"
                    fill={Colors.WHITE}
                    x="480"
                    y={`${textBase}`}
                    font-size={`${fontSize}`}
                    font-family={fontFamily}
                >
                    GP
                </text>
            </svg>
        )
    }
}
