import {
    NavSystem,
    NavSystemPage,
    NavSystemPageGroup,
    NavSystemElement,
    NavSystemElementGroup,
    NavSystemElementContainer,
} from './NavSystem'
import {
    ContextualMenu,
    ContextualMenuElementImage,
    ContextualMenuElementValue,
} from './ContextualMenu'
import { PFD_AutopilotDisplay, PFD_Attitude, PFD_Altimeter, PFD_Compass } from './CommonPFD_MFD'
import { PFD_Airspeed_Enhanced } from './PFD_Airspeed_Enhanced'
import { FSComponent, DisplayComponent, VNode, ComponentProps, InputAcceleration, SimVarValueType } from '@microsoft/msfs-sdk'
import { HorizontalCompassComponent, HorizontalCompassElementRefs } from './HorizontalCompass'
import { CDIComponent, CDIElementRefs } from './CDI'
import { HSIComponent, HSIElementRefs, HSIndicatorDisplayType } from './HSIndicator'
import { HighlightComponent, HighlightElementRefs } from './Highlight'
import { APInfoBarComponent, APInfoBarElementRefs } from './APInfoBar'
import { AttitudeIndicatorComponent, AttitudeIndicatorElementRefs, SlipSkidDisplayMode } from './AttitudeIndicator'
import { AltimeterComponent, AltimeterElementRefs } from './Altimeter'
import { AirspeedIndicatorComponent, AirspeedIndicatorElementRefs } from './AirspeedIndicator'

interface PfdRefs {
    ap: APInfoBarElementRefs
    attitude: AttitudeIndicatorElementRefs
    altimeter: AltimeterElementRefs
    airspeed: AirspeedIndicatorElementRefs
    compass: HorizontalCompassElementRefs
    cdi: CDIElementRefs
}

interface PfdContentProps extends ComponentProps {
    onApi: (refs: PfdRefs) => void
}

class PfdContent extends DisplayComponent<PfdContentProps> {
    onAfterRender() {
        this.props.onApi({
            ap: this.apRefs!,
            attitude: this.attRefs!,
            altimeter: this.altRefs!,
            airspeed: this.spdRefs!,
            compass: this.cmpRefs!,
            cdi: this.cdiRefs!,
        })
    }

    private apRefs: APInfoBarElementRefs
    private attRefs: AttitudeIndicatorElementRefs
    private altRefs: AltimeterElementRefs
    private spdRefs: AirspeedIndicatorElementRefs
    private cmpRefs: HorizontalCompassElementRefs
    private cdiRefs: CDIElementRefs

    render(): VNode {
        return (
            <>
                <div id="AP"><APInfoBarComponent onApi={r => this.apRefs = r} /></div>
                <div id="Horizon"><AttitudeIndicatorComponent verticalCenter={true} bottomY={215} slipSkidDisplayMode={SlipSkidDisplayMode.ROUND} showTurnRate={true} bankSizeRatio={-12} isBackup={false} onApi={r => this.attRefs = r} /></div>
                <div id="Altimeter"><AltimeterComponent height={1020} VSStyle="Compact" onApi={r => this.altRefs = r} /></div>
                <div id="Airspeed"><AirspeedIndicatorComponent height={850} noColor={false} onApi={r => this.spdRefs = r} /></div>
                <div id="Compass"><HorizontalCompassComponent truncateLeft={50} truncateRight={78} spacing={50} groundTrackActive={true} onApi={r => this.cmpRefs = r} /></div>
                <div id="CDI"><CDIComponent noScale={true} indicatorShape="Diamond" onApi={r => this.cdiRefs = r} /></div>
            </>
        );
    }
}

interface MfdRefs {
    hsi: HSIElementRefs
    selectedHeadingValue: HTMLElement
    groundSpeedValue: HTMLElement
    waypointDistanceValue: HTMLElement
}

interface MfdContentProps extends ComponentProps {
    onApi: (refs: MfdRefs) => void
}

class MfdContent extends DisplayComponent<MfdContentProps> {
    private hsiRefs: HSIElementRefs
    private readonly shvRef = FSComponent.createRef<HTMLDivElement>()
    private readonly gsvRef = FSComponent.createRef<HTMLDivElement>()
    private readonly wdvRef = FSComponent.createRef<HTMLDivElement>()

    onAfterRender() {
        this.props.onApi({
            hsi: this.hsiRefs!,
            selectedHeadingValue: this.shvRef.getOrDefault()!,
            groundSpeedValue: this.gsvRef.getOrDefault()!,
            waypointDistanceValue: this.wdvRef.getOrDefault()!,
        })
    }

    render(): VNode {
        return (
            <>
                <div id="HSICompass"><HSIComponent noHeadingValue={true} noCourseValue={true} noCenterText={false} noTurnRateIndicator={false} noBackground={false} noAffectSimRadioNav={false} largeCompass={false} displayStyle={HSIndicatorDisplayType.GlassCockpit} fmsAlias="" onApi={r => this.hsiRefs = r} /></div>
                <div id="Infos">
                    <div id="SelectedHeading">
                        <svg id="SelectedHeadingSymbol" viewBox="0 0 50 100">
                            <path d="M0,0 h50 v30 l-30,20 l30,20 v30 h-50 Z" fill="aqua" />
                        </svg>
                        <div id="SelectedHeadingValue" ref={this.shvRef}>060°</div>
                    </div>
                    <div id="GroundSpeed">
                        <div>GS KT</div>
                        <div id="GroundSpeedValue" ref={this.gsvRef}>202</div>
                    </div>
                    <div id="WaypointDistance">
                        <div>DIST NM</div>
                        <div id="WaypointDistanceValue" ref={this.wdvRef}>371</div>
                    </div>
                </div>
            </>
        );
    }
}

interface InstrumentProps extends ComponentProps {
    onPfdApi: (refs: PfdRefs) => void
    onMfdApi: (refs: MfdRefs) => void
    onHighlightApi: (refs: HighlightElementRefs) => void
}

class AS5Instrument extends DisplayComponent<InstrumentProps> {
    render(): VNode {
        return (
            <>
                <div id="highlight" style="position:absolute; width: 100%; height:100%;">
                    <HighlightComponent onApi={this.props.onHighlightApi} />
                </div>
                <div id="PageContainer">
                    <div id="PFD">
                        <PfdContent onApi={this.props.onPfdApi} />
                    </div>
                    <div id="MFD">
                        <MfdContent onApi={this.props.onMfdApi} />
                    </div>
                </div>
            </>
        );
    }
}

export class AS5 extends NavSystem {
    gps: any
    pagesContainer: any
    highlightRefs: HighlightElementRefs
    selectionValueElement: any
    selectionValueWindow: any
    lastHdgKnobTime: number
    lastHdgKnobSign: number
    hdgKnobAccel: InputAcceleration
    hdgKnobTarget: number
    pageGroups: NavSystemPageGroup[]
    menuMaxElems: number

    constructor() {
        super()
        this.pageGroups = [new NavSystemPageGroup('Main', this, [new AS5_PFD(), new AS5_MFD()])]
    }

    get templateID() {
        return 'AS5'
    }

    connectedCallback() {
        super.connectedCallback()
        this.menuMaxElems = 4
        this.selectionValueElement = new AS5_SelectionValueElement()
        this.selectionValueWindow = new NavSystemElementContainer(
            'Selection Value',
            'SelectionValueWindow',
            this.selectionValueElement
        )
        this.selectionValueWindow.setGPS(this)

        const pfd = this.pageGroups[0].pages[0] as AS5_PFD;
        const mfd = this.pageGroups[0].pages[1] as AS5_MFD;
        const pfdEls = pfd.element.elements;
        const apDisplay = pfdEls[0] as PFD_AutopilotDisplay;
        const attitude = pfdEls[1] as PFD_Attitude;
        const airspeed = pfdEls[2] as PFD_Airspeed_Enhanced;
        const altimeter = pfdEls[3] as PFD_Altimeter;
        const compass = pfdEls[4] as AS5_PFD_Compass;
        const cdi = pfdEls[5] as AS5_PFD_CDI;
        const hsi = (mfd.element.elements[0] as AS5_MFD_HSI);

        FSComponent.render(
            <AS5Instrument
                onHighlightApi={r => this.highlightRefs = r}
                onPfdApi={r => {
                    apDisplay.AP_LateralActive = r.ap.AP_LateralActive;
                    apDisplay.AP_LateralArmed = r.ap.AP_LateralArmed;
                    apDisplay.AP_Status = r.ap.AP_Status;
                    apDisplay.AP_YDStatus = null;
                    apDisplay.AP_FDIndicatorArrow = null;
                    apDisplay.AP_VerticalActive = r.ap.AP_VerticalActive;
                    apDisplay.AP_ModeReference = r.ap.AP_ModeReference;
                    apDisplay.AP_Armed = r.ap.AP_Armed;
                    apDisplay.AP_ArmedReference = r.ap.AP_ArmedReference;
                    attitude.svg = r.attitude.root;
                    altimeter.altimeterElement = r.altimeter.root;
                    airspeed.airspeedElement = r.airspeed.root;
                    compass.refs = r.compass;
                    compass.bearingTextElement = r.compass.bearingText;
                    compass.movingRibbonElement = r.compass.movingRibbon;
                    compass.courseElement = r.compass.courseElement;
                    compass.groundTrackElement = r.compass.groundTrackElement;
                    compass.digitsElement = r.compass.digits;
                    cdi.refs = r.cdi;
                    cdi.rootElement = r.cdi.root;
                }}
                onMfdApi={r => {
                    hsi.hsi = r.hsi.root;
                    hsi.selectedHeadingValue = r.selectedHeadingValue;
                    hsi.groundSpeedValue = r.groundSpeedValue;
                    hsi.waypointDistanceValue = r.waypointDistanceValue;
                }}
            />,
            this.getChildById('Electricity')
        );

    }

    onUpdate(_deltaTime) {
        this.updateKnobTooltipValue()
    }

    syncCrs() {}
    computeEvent(_event) {
        const popUpWasOpen = this.popUpElement != null
        super.computeEvent(_event)
        switch (_event) {
            case 'Knob_Inc':
                if (this.currentInteractionState == 2) {
                    this.computeEvent('NavigationSmallInc')
                } else if (this.pageGroups?.[0]?.pageIndex == 1 && !popUpWasOpen) {
                    this.incrementHeading()
                } else if (!popUpWasOpen) {
                    this.computeEvent('BARO_INC')
                }
                break
            case 'Knob_Dec':
                if (this.currentInteractionState == 2) {
                    this.computeEvent('NavigationSmallDec')
                } else if (this.pageGroups?.[0]?.pageIndex == 1 && !popUpWasOpen) {
                    this.decrementHeading()
                } else if (!popUpWasOpen) {
                    this.computeEvent('BARO_DEC')
                }
                break
            case 'Knob_Push':
                if (this.currentInteractionState == 2) this.computeEvent('ENT_Push')
                else if (!popUpWasOpen) this.computeEvent('MENU_Push')
                break
        }
    }
    onPowerOn() {
        super.onPowerOn()
        if (this.instrumentIndex == 2) this.SwitchToPageName('Main', 'MFD')
        else this.SwitchToPageName('Main', 'PFD')
    }
    updateKnobTooltipValue() {
        let value, unit
        if (
            this.popUpElement === this.selectionValueWindow &&
            this.selectionValueElement.rawValue
        ) {
            value = this.selectionValueElement.rawValue()
            unit = this.selectionValueElement.unit
        } else if (this.pageGroups?.[0]?.pageIndex == 1) {
            value = this.getMenuHeadingRawValue()
            unit = 0
        } else {
            value = SimVar.GetSimVarValue('KOHLSMAN SETTING HG:1', SimVarValueType.InHG)
            unit = 2
        }
        SimVar.SetSimVarValue('L:AS5_' + this.instrumentIndex + '_Knob_Value', SimVarValueType.Number, value)
        SimVar.SetSimVarValue('L:AS5_' + this.instrumentIndex + '_Knob_Unit', SimVarValueType.Number, unit)
    }
    UpdateSlider(_slider, _cursor, _index, _nbElem, _maxElems) {
        if (_nbElem > _maxElems) {
            const cursorWidth = (_maxElems * 100) / _nbElem
            const pct = _index / (_nbElem - _maxElems)
            const cursorLeft = Math.min(pct, 1.0) * (100 - cursorWidth)
            diffAndSetAttribute(_slider, 'state', 'Active')
            diffAndSetAttribute(
                _cursor,
                'style',
                'width:' + cursorWidth + '%; left:' + cursorLeft + '%'
            )
        } else {
            diffAndSetAttribute(_slider, 'state', 'Inactive')
        }
    }
    getMenuHeadingText() {
        let hdg = fastToFixed(Simplane.getAutoPilotHeadingLockValueDegrees(), 0)
        let headingValue = parseFloat(hdg)
        if (headingValue == 0) {
            headingValue = 360
        }
        hdg = headingValue + ''
        return '000'.slice(hdg.length) + hdg + Avionics.Utils.DEGREE_SYMBOL
    }
    getMenuHeadingRawValue() {
        const heading = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees())
        return heading == 0 ? 360 : heading
    }
    changeHeading(_sign) {
        const now = Date.now()
        const dt = now - (this.lastHdgKnobTime || 0)
        this.hdgKnobAccel = this.hdgKnobAccel || new InputAcceleration({ increment: 1 })
        if (dt > 600 || _sign != this.lastHdgKnobSign) {
            this.hdgKnobTarget = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees())
            this.hdgKnobAccel.resume()
        }
        this.lastHdgKnobTime = now
        this.lastHdgKnobSign = _sign
        const step = this.hdgKnobAccel.doStep()
        this.hdgKnobTarget = (((this.hdgKnobTarget + _sign * step) % 360) + 360) % 360
        SimVar.SetSimVarValue('K:HEADING_BUG_SET', SimVarValueType.Number, this.hdgKnobTarget)
    }
    incrementHeading() { this.changeHeading(1) }
    decrementHeading() { this.changeHeading(-1) }
    syncHeading() {
        SimVar.SetSimVarValue('K:HEADING_BUG_SET', SimVarValueType.Number, Math.round(Simplane.getHeadingMagnetic()))
    }
    menuHeadingEnter() {
        this.selectionValueElement.setContext('Select Heading', this.getMenuHeadingText.bind(this), this.incrementHeading.bind(this), this.decrementHeading.bind(this), this.syncHeading.bind(this))
        this.selectionValueElement.rawValue = this.getMenuHeadingRawValue.bind(this)
        this.selectionValueElement.unit = 0
        this.switchToPopUpPage(this.selectionValueWindow)
    }
    getMenuCrsText() {
        let crs = fastToFixed(Simplane.getNavObs(1), 0)
        let crsValue = parseFloat(crs)
        if (crsValue == 0) crsValue = 360
        crs = crsValue + ''
        return '000'.slice(crs.length) + crs + Avionics.Utils.DEGREE_SYMBOL
    }
    getMenuCrsRawValue() {
        const crs = Math.round(Simplane.getNavObs(1))
        return crs == 0 ? 360 : crs
    }
    incrementCrs() { SimVar.SetSimVarValue('K:VOR1_OBI_INC', SimVarValueType.Number, 0) }
    decrementCrs() { SimVar.SetSimVarValue('K:VOR1_OBI_DEC', SimVarValueType.Number, 0) }
    menuCrsEnter() {
        this.selectionValueElement.setContext('Select Course', this.getMenuCrsText.bind(this), this.incrementCrs.bind(this), this.decrementCrs.bind(this), this.syncCrs.bind(this))
        this.selectionValueElement.rawValue = this.getMenuCrsRawValue.bind(this)
        this.selectionValueElement.unit = 0
        this.switchToPopUpPage(this.selectionValueWindow)
    }
    getMenuAltitudeText() {
        return fastToFixed(SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK VAR', SimVarValueType.Feet), 0) + 'ft'
    }
    getMenuAltitudeRawValue() {
        return SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK VAR', SimVarValueType.Feet)
    }
    incrementAltitude() { SimVar.SetSimVarValue('K:AP_ALT_VAR_INC', SimVarValueType.Number, 100) }
    decrementAltitude() { SimVar.SetSimVarValue('K:AP_ALT_VAR_DEC', SimVarValueType.Number, 100) }
    syncAltitude() {
        SimVar.SetSimVarValue('K:AP_ALT_VAR_SET_ENGLISH', SimVarValueType.Number, Math.round(Simplane.getAltitude() / 100) * 100)
    }
    menuAltitudeEnter() {
        this.selectionValueElement.setContext('Select Altitude', this.getMenuAltitudeText.bind(this), this.incrementAltitude.bind(this), this.decrementAltitude.bind(this), this.syncAltitude.bind(this))
        this.selectionValueElement.rawValue = this.getMenuAltitudeRawValue.bind(this)
        this.selectionValueElement.unit = 1
        this.switchToPopUpPage(this.selectionValueWindow)
    }
}
export class AS5_PFD extends NavSystemPage {
    gps: any
    element: NavSystemElementGroup
    defaultMenu: ContextualMenu

    constructor() {
        super('PFD', 'PFD', null)
        this.element = new NavSystemElementGroup([
            new PFD_AutopilotDisplay(),
            new PFD_Attitude(),
            new PFD_Airspeed_Enhanced(),
            new PFD_Altimeter(),
            new AS5_PFD_Compass(),
            new AS5_PFD_CDI(),
        ])
    }

    init() {
        super.init()
        this.defaultMenu = new ContextualMenu('', [
            new ContextualMenuElementImage('Back', this.gps.SwitchToInteractionState.bind(this.gps, 0), '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png', false),
            new ContextualMenuElementValue('Heading', this.gps.menuHeadingEnter.bind(this.gps), this.gps.getMenuHeadingText.bind(this.gps), false),
            new ContextualMenuElementValue('Altitude', this.gps.menuAltitudeEnter.bind(this.gps), this.gps.getMenuAltitudeText.bind(this.gps), false),
            new ContextualMenuElementValue('Pitch', null, () => '-----°', true),
            new ContextualMenuElementImage('MFD', this.gps.SwitchToPageName.bind(this.gps, 'Main', 'MFD'), '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/MFD.png', false),
        ])
    }

    onUpdate(deltaTime) { super.onUpdate(deltaTime) }
}
export class AS5_MFD extends NavSystemPage {
    gps: any
    element: NavSystemElementGroup
    defaultMenu: ContextualMenu

    constructor() {
        super('MFD', 'MFD', null)
        this.element = new NavSystemElementGroup([new AS5_MFD_HSI('HSICompass')])
    }

    init() {
        super.init()
        this.defaultMenu = new ContextualMenu('', [
            new ContextualMenuElementImage('Back', this.gps.SwitchToInteractionState.bind(this.gps, 0), '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png', false),
            new ContextualMenuElementValue('Heading', this.gps.menuHeadingEnter.bind(this.gps), this.gps.getMenuHeadingText.bind(this.gps), false),
            new ContextualMenuElementValue('Course', this.gps.menuCrsEnter.bind(this.gps), this.gps.getMenuCrsText.bind(this.gps), false),
            new ContextualMenuElementImage('PFD', this.gps.SwitchToPageName.bind(this.gps, 'Main', 'PFD'), '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/PFD.png', false),
        ])
    }
}
export class AS5_PFD_Compass extends NavSystemElement {
    refs: HorizontalCompassElementRefs | undefined
    course: number = 0
    bearingTextElement: SVGElement | undefined
    movingRibbonElement: SVGElement | undefined
    courseElement: SVGElement | undefined
    groundTrackElement: SVGElement | undefined
    digitsElement: SVGElement[] | undefined
    spacing: number = 50

    init(_root) {}
    onEnter() {}
    onUpdate(_deltaTime) {
        if (!this.movingRibbonElement) return
        const bearing = Simplane.getHeadingMagnetic();
        const track = Simplane.getTrackAngle();
        const roundedBearing = Math.round(bearing / 10) * 10;
        const bearingString = Math.round(bearing) + '';
        diffAndSetText(this.bearingTextElement, '000'.slice(0, 3 - bearingString.length) + bearingString);
        for (let i = -8; i <= 8; i++) {
            const string = ((roundedBearing + i * 10 + 360) % 360) + '';
            diffAndSetText(this.digitsElement[i + 8], '000'.slice(0, 3 - string.length) + string);
        }
        diffAndSetAttribute(this.movingRibbonElement, 'transform', 'translate(' + (roundedBearing - bearing) * (this.spacing / 10) + ',0)');
        this.course = parseFloat(Simplane.getAutoPilotDisplayedHeadingLockValueDegrees() + '');
        diffAndSetAttribute(this.courseElement, 'transform', 'translate(' + Avionics.Utils.diffAngle(bearing, this.course) * (this.spacing / 10) + ',0)');
        diffAndSetAttribute(this.groundTrackElement, 'transform', 'translate(' + Avionics.Utils.diffAngle(bearing, track) * (this.spacing / 10) + ',0)');
    }
    onExit() {}
    onEvent(_event) {}
}
export class AS5_PFD_CDI extends NavSystemElement {
    refs: CDIElementRefs | undefined
    rootElement: SVGElement | undefined

    init(_root) {}
    onEnter() {}
    onUpdate(_deltaTime) {
        if (!this.rootElement) return
        const cdiSource = SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool) ? 3 : Simplane.getAutoPilotSelectedNav()
        switch (cdiSource) {
            case 1: case 2:
                diffAndSetStyle(this.rootElement, StyleProperty.display, Simplane.getNavHasNav(cdiSource) ? 'inherit' : 'none')
                diffAndSetAttribute(this.rootElement, 'deviation', SimVar.GetSimVarValue('NAV CDI:' + cdiSource, SimVarValueType.Number) / 127 + '')
                diffAndSetAttribute(this.refs.deviationIndicator, 'fill', 'lime')
                break
            case 3:
                diffAndSetStyle(this.rootElement, StyleProperty.display, SimVar.GetSimVarValue('GPS WP NEXT ID', SimVarValueType.String) != '' ? 'inherit' : 'none')
                diffAndSetAttribute(this.rootElement, 'deviation', SimVar.GetSimVarValue('GPS WP CROSS TRK', SimVarValueType.NM))
                diffAndSetAttribute(this.refs.deviationIndicator, 'fill', 'magenta')
                break
        }
        const needleValue = SimVar.GetSimVarValue('HSI CDI NEEDLE', SimVarValueType.Number) || 0
        const clampedPosition = (needleValue / 127) * 45
        diffAndSetAttribute(this.refs.deviationIndicator, 'transform', `translate(${clampedPosition}, 0)`)
    }
    onExit() {}
    onEvent(_event) {}
}
export class AS5_MFD_HSI extends PFD_Compass {
    selectedHeadingValue: HTMLElement
    groundSpeedValue: HTMLElement
    waypointDistanceValue: HTMLElement
    private _cdiSource: number = 0
    private _dmeSource: number = 0

    set cdiSource(_val: number) { this._cdiSource = _val }
    get cdiSource(): number { return this._cdiSource }
    set dmeSource(_val: number) { this._dmeSource = _val }
    get dmeSource(): number { return this._dmeSource }

    init(_root) {}

    onUpdate(_deltaTime) {
        if (!this.hsi) return
        if (this.selectedHeadingValue) {
            let headingValue = parseFloat(this.hsi.getAttribute('heading_bug_rotation'))
            if (headingValue == 0) headingValue = 360
            const hdg = fastToFixed(headingValue, 0)
            diffAndSetText(this.selectedHeadingValue, '000'.slice(hdg.length) + hdg + '°')
        }
        if (this.groundSpeedValue) {
            diffAndSetText(this.groundSpeedValue, fastToFixed(Simplane.getGroundSpeed(), 0) + '')
        }
        if ((this.cdiSource == 1 || this.cdiSource == 2) && this.dmeSource != this.cdiSource) {
            this.dmeSource = this.cdiSource
        } else {
            if (this.waypointDistanceValue) {
                let distanceText = '---'
                switch (this.cdiSource) {
                    case 1: case 2:
                        const distance = parseFloat(this.hsi.getAttribute('dme_distance'))
                        if (!isNaN(distance)) distanceText = fastToFixed(distance, 1)
                        diffAndSetText(this.waypointDistanceValue, distanceText)
                        diffAndSetAttribute(this.waypointDistanceValue, 'mode', 'VOR')
                        break
                    case 3:
                        if (SimVar.GetSimVarValue('GPS IS ACTIVE WAY POINT', SimVarValueType.Bool) == true)
                            distanceText = fastToFixed(SimVar.GetSimVarValue('GPS WP DISTANCE', SimVarValueType.NM), 1)
                        diffAndSetText(this.waypointDistanceValue, distanceText)
                        diffAndSetAttribute(this.waypointDistanceValue, 'mode', 'GPS')
                        break
                }
            }
        }
    }
}
export class AS5_SelectionValueElement extends NavSystemElement {
    window: HTMLElement
    title: HTMLElement
    value: HTMLElement
    getCallback: any
    incCallback: any
    decCallback: any
    syncCallback: any
    rawValue: any
    unit: number

    init(_root) {
        this.window = _root
        this.title = this.gps.getChildById('SelectionValueWindowTitle')
        this.value = this.gps.getChildById('SelectionValueWindowValue')
    }

    onEnter() {
        if (this.getCallback && this.value) diffAndSetText(this.value, this.getCallback())
        diffAndSetAttribute(this.window, 'state', 'Active')
    }
    onUpdate(_deltaTime) {
        if (this.getCallback && this.value) diffAndSetText(this.value, this.getCallback())
    }
    onExit() { diffAndSetAttribute(this.window, 'state', 'Inactive') }
    onEvent(_event) {
        switch (_event) {
            case 'Knob_Inc': if (this.incCallback) this.incCallback(); break
            case 'Knob_Dec': if (this.decCallback) this.decCallback(); break
            case 'Knob_Push': this.gps.closePopUpElement(); break
            case 'Knob_Long_Push': if (this.syncCallback) this.syncCallback(); break
        }
    }

    setContext(_titleText, _getCallback, _incCallback = EmptyCallback.Void, _decCallback = EmptyCallback.Void, _syncCallback = EmptyCallback.Void) {
        diffAndSetText(this.title, _titleText)
        this.getCallback = _getCallback
        this.incCallback = _incCallback
        this.decCallback = _decCallback
        this.syncCallback = _syncCallback
    }
}
registerInstrument('as5-element', AS5)
