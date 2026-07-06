import { DisplayComponent, FSComponent, VNode, ComponentProps } from '@microsoft/msfs-sdk';

export type APDisplayMode = 'RedFlash' | 'YellowFlash' | 'Red' | 'Yellow' | '';

export interface APInfoBarElementRefs {
    AP_LateralArmed: SVGElement;
    AP_LateralActive: SVGElement;
    AP_Status: SVGElement;
    AP_VerticalActive: SVGElement;
    AP_ModeReference: SVGElement;
    AP_Armed: SVGElement;
    AP_ArmedReference: SVGElement;
}

export interface APInfoBarProps extends ComponentProps {
    onApi: (refs: APInfoBarElementRefs) => void;
}

export class APInfoBarComponent extends DisplayComponent<APInfoBarProps> {
    private readonly lateralArmedRef = FSComponent.createRef<SVGTextElement>();
    private readonly lateralActiveRef = FSComponent.createRef<SVGTextElement>();
    private readonly statusRef = FSComponent.createRef<SVGTextElement>();
    private readonly verticalActiveRef = FSComponent.createRef<SVGTextElement>();
    private readonly modeReferenceRef = FSComponent.createRef<SVGTextElement>();
    private readonly armedRef = FSComponent.createRef<SVGTextElement>();
    private readonly armedReferenceRef = FSComponent.createRef<SVGTextElement>();

    constructor(props: APInfoBarProps) {
        super(props);
    }

    onAfterRender(): void {
        if (this.props.onApi) {
            this.props.onApi({
                AP_LateralArmed: this.lateralArmedRef.getOrDefault(),
                AP_LateralActive: this.lateralActiveRef.getOrDefault(),
                AP_Status: this.statusRef.getOrDefault(),
                AP_VerticalActive: this.verticalActiveRef.getOrDefault(),
                AP_ModeReference: this.modeReferenceRef.getOrDefault(),
                AP_Armed: this.armedRef.getOrDefault(),
                AP_ArmedReference: this.armedReferenceRef.getOrDefault(),
            });
        }
    }

    render(): VNode {
        const width = 512;
        const height = 18;
        const white = '#F3F3F3';
        const green = '#32bd28';
        const black = '#020202';
        const fontFamily = 'Montserrat-Bold';
        const fontSize = 18;
        const textBase = 15;

        return (
            <svg ref={FSComponent.createRef<SVGElement>()} class="ap-infobar" width="100%" height={`${height}px`} viewBox={`0 0 ${width} ${height}`}>
                <rect class="ap-background" x="0" y="0" width={`${width}`} height={`${height}`} fill={black} />
                <rect class="underline" x="0" y={`${height - 1}`} height="1" width={`${width}`} fill={white} />
                <rect class="divider" x="160" y="2" height={`${height - 6}`} width="1" fill={white} />
                <rect class="divider" x="256" y="2" height={`${height - 6}`} width="1" fill={white} />
                <text ref={this.lateralArmedRef} id="AP_LateralArmed" fill={white} x="20" y={`${textBase}`} font-size={`${fontSize}`} font-family={fontFamily}>GPS</text>
                <text ref={this.lateralActiveRef} id="AP_LateralActive" fill={green} x="95" y={`${textBase}`} font-size={`${fontSize}`} font-family={fontFamily}>HDG</text>
                <text ref={this.statusRef} id="AP_Status" fill={green} x="195" y={`${textBase}`} font-size={`${fontSize}`} font-family={fontFamily}>AP</text>
                <text ref={this.verticalActiveRef} id="AP_VerticalActive" fill={green} x="280" y={`${textBase}`} font-size={`${fontSize}`} font-family={fontFamily}>ALT</text>
                <text ref={this.modeReferenceRef} id="AP_ModeReference" fill={green} x="330" y={`${textBase}`} font-size={`${fontSize}`} font-family={fontFamily}>200</text>
                <text ref={this.armedRef} id="AP_Armed" fill={white} x="410" y={`${textBase}`} font-size={`${fontSize}`} font-family={fontFamily}>ALT</text>
                <text ref={this.armedReferenceRef} id="AP_ArmedReference" fill={white} x="480" y={`${textBase}`} font-size={`${fontSize}`} font-family={fontFamily}>GP</text>
            </svg>
        );
    }
}
