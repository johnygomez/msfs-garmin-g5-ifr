import { DisplayComponent, FSComponent, VNode, ComponentProps, Subject } from '@microsoft/msfs-sdk'

export enum MarkerBeaconState {
    Inactive = 'Inactive',
    Outer = 'O',
    Middle = 'M',
    Inner = 'I',
}

export interface MarkerBeaconProps extends ComponentProps {
    beaconState: Subject<string>
}

export class MarkerBeaconComponent extends DisplayComponent<MarkerBeaconProps> {
    private readonly rootRef = FSComponent.createRef<HTMLDivElement>()

    onAfterRender(): void {
        const el = this.rootRef.getOrDefault()
        this.props.beaconState.sub(state => {
            el.setAttribute('state', state)
            switch (state) {
                case 'O':
                    el.textContent = 'O'
                    break
                case 'M':
                    el.textContent = 'M'
                    break
                case 'I':
                    el.textContent = 'I'
                    break
                default:
                    el.textContent = ''
                    break
            }
        }, true)
    }

    render(): VNode {
        return <div id="MarkerBeacon" ref={this.rootRef} state="Inactive" />
    }
}

export interface OATProps extends ComponentProps {
    temperature: Subject<string>
}

export class OATComponent extends DisplayComponent<OATProps> {
    private readonly valueRef = FSComponent.createRef<HTMLDivElement>()

    onAfterRender(): void {
        this.props.temperature.sub(v => {
            const el = this.valueRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
    }

    render(): VNode {
        return <div id="OAT_Value" ref={this.valueRef} />
    }
}

export interface XPDRProps extends ComponentProps {
    xpdrCode: Subject<string>
    xpdrMode: Subject<string>
    localTime: Subject<string>
}

export class XPDRComponent extends DisplayComponent<XPDRProps> {
    private readonly valueRef = FSComponent.createRef<HTMLDivElement>()
    private readonly modeRef = FSComponent.createRef<HTMLDivElement>()
    private readonly timeRef = FSComponent.createRef<HTMLDivElement>()

    onAfterRender(): void {
        this.props.xpdrCode.sub(v => {
            const el = this.valueRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.xpdrMode.sub(v => {
            const el = this.modeRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.localTime.sub(v => {
            const el = this.timeRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
    }

    render(): VNode {
        return (
            <>
                <div id="XPDRValue" ref={this.valueRef} />
                <div id="XPDRMode" ref={this.modeRef} />
                <div id="LocalTime" ref={this.timeRef} />
            </>
        )
    }
}

export interface NavStatusProps extends ComponentProps {
    legFrom: Subject<string>
    legTo: Subject<string>
    legSymbol: Subject<number>
    legDistance: Subject<string>
    legBearing: Subject<string>
}

export class NavStatusComponent extends DisplayComponent<NavStatusProps> {
    private readonly legFromRef = FSComponent.createRef<HTMLDivElement>()
    private readonly legSymbolRef = FSComponent.createRef<HTMLDivElement>()
    private readonly legToRef = FSComponent.createRef<HTMLDivElement>()
    private readonly legDistanceRef = FSComponent.createRef<HTMLDivElement>()
    private readonly legBearingRef = FSComponent.createRef<HTMLDivElement>()

    onAfterRender(): void {
        this.props.legFrom.sub(v => {
            const el = this.legFromRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.legTo.sub(v => {
            const el = this.legToRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.legDistance.sub(v => {
            const el = this.legDistanceRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.legBearing.sub(v => {
            const el = this.legBearingRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.legSymbol.sub(symbol => {
            const el = this.legSymbolRef.getOrDefault()
            if (!el) return
            el.innerHTML =
                symbol === 1
                    ? '<img src="/Pages/VCockpit/Instruments/NavSystems/Shared/Images/GPS/direct_to.png" class="imgSizeM"/>'
                    : symbol === 2
                      ? '<img src="/Pages/VCockpit/Instruments/NavSystems/Shared/Images/GPS/course_to.png" class="imgSizeM"/>'
                      : ''
        }, true)
    }

    render(): VNode {
        return (
            <>
                <div id="CurrentLegFrom" ref={this.legFromRef} />
                <div id="CurrentLegSymbol" ref={this.legSymbolRef} />
                <div id="CurrentLegTo" ref={this.legToRef} />
                <div id="CurrentLegDistance" ref={this.legDistanceRef} />
                <div id="CurrentLegBearing" ref={this.legBearingRef} />
            </>
        )
    }
}

export interface WindDataProps extends ComponentProps {
    windMode: Subject<number>
    windDirection: Subject<number>
    windTrueDirection: Subject<number>
    windStrength: Subject<number>
}

export class WindDataComponent extends DisplayComponent<WindDataProps> {
    private readonly svgRef = FSComponent.createRef<SVGElement>()

    onAfterRender(): void {
        const svg = this.svgRef.getOrDefault()
        this.props.windMode.sub(m => {
            svg.setAttribute('wind-mode', String(m))
        }, true)
        this.props.windDirection.sub(d => {
            svg.setAttribute('wind-direction', String(d))
        }, true)
        this.props.windTrueDirection.sub(d => {
            svg.setAttribute('wind-true-direction', String(d))
        }, true)
        this.props.windStrength.sub(s => {
            svg.setAttribute('wind-strength', String(s))
        }, true)
    }

    render(): VNode {
        return <svg id="WindData" ref={this.svgRef} />
    }
}

export interface MinimumsProps extends ComponentProps {
    windowState: Subject<string>
    sourceLabel: Subject<string>
    valueText: Subject<string>
    bugAltitude: Subject<string>
    valueState: Subject<string>
}

export class MinimumsComponent extends DisplayComponent<MinimumsProps> {
    private readonly windowRef = FSComponent.createRef<HTMLDivElement>()
    private readonly sourceRef = FSComponent.createRef<HTMLDivElement>()
    private readonly valueRef = FSComponent.createRef<HTMLDivElement>()

    onAfterRender(): void {
        this.props.windowState.sub(s => {
            const el = this.windowRef.getOrDefault()
            if (el) el.setAttribute('state', s)
        }, true)
        this.props.sourceLabel.sub(v => {
            const el = this.sourceRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.valueText.sub(v => {
            const el = this.valueRef.getOrDefault()
            if (el) el.textContent = v
        }, true)
        this.props.valueState.sub(s => {
            const el = this.valueRef.getOrDefault()
            if (el) el.setAttribute('state', s)
        }, true)
        this.props.bugAltitude.sub(alt => {
            const altEl = document.getElementById('Altimeter')
            if (altEl) altEl.setAttribute('minimum-altitude', alt)
        })
    }

    render(): VNode {
        return (
            <div id="Minimums" ref={this.windowRef} state="Inactive">
                <div id="Minimums_Source" ref={this.sourceRef} />
                <div id="Minimums_Value">
                    <div class="value" ref={this.valueRef} />
                </div>
            </div>
        )
    }
}

export interface RadarAltitudeProps extends ComponentProps {
    radarAltitude: Subject<number>
    isActive: Subject<boolean>
    windowState: Subject<string>
    display: Subject<string>
}

export class RadarAltitudeComponent extends DisplayComponent<RadarAltitudeProps> {
    private readonly windowRef = FSComponent.createRef<HTMLDivElement>()
    private readonly valueRef = FSComponent.createRef<HTMLDivElement>()

    onAfterRender(): void {
        this.props.display.sub(d => {
            const el = this.windowRef.getOrDefault()
            if (el) el.style.display = d
        }, true)
        this.props.windowState.sub(state => {
            const el = this.windowRef.getOrDefault()
            if (el) el.setAttribute('state', state)
            const altEl = document.getElementById('Altimeter')
            if (altEl) altEl.setAttribute('radar-altitude', String(this.props.radarAltitude.get()))
        }, true)
        this.props.radarAltitude.sub(alt => {
            const el = this.valueRef.getOrDefault()
            if (el) el.textContent = alt > 0 ? String(Math.round(alt)) : ''
            const altEl = document.getElementById('Altimeter')
            if (altEl) altEl.setAttribute('radar-altitude', String(alt))
        }, true)
    }

    render(): VNode {
        return (
            <div id="RadarAltitude" ref={this.windowRef} state="Inactive">
                <div id="RA_Value" ref={this.valueRef} />
            </div>
        )
    }
}
