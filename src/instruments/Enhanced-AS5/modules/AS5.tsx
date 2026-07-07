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
import {
    PFD_AutopilotDisplay,
    PFD_Attitude,
    PFD_Altimeter,
    PFD_Compass,
    AltimeterSubjects,
} from './CommonPFD_MFD'
import { PFD_Airspeed_Enhanced } from './PFD_Airspeed_Enhanced'
import {
    FSComponent,
    DisplayComponent,
    VNode,
    ComponentProps,
    InputAcceleration,
    SimVarValueType,
    Subject,
    Subscription,
} from '@microsoft/msfs-sdk'
import { HorizontalCompassComponent } from './HorizontalCompass'
import { CDIComponent } from './CDI'
import { HSIComponent, HSIndicatorDisplayType } from './HSIndicator'
import { HighlightComponent, HighlightElementRefs } from './Highlight'
import { APInfoBarComponent, APInfoBarSubjects } from './APInfoBar'
import { AttitudeIndicatorComponent, SlipSkidDisplayMode } from './AttitudeIndicator'
import { AltimeterComponent } from './Altimeter'
import { AirspeedIndicatorComponent } from './AirspeedIndicator'

export interface AttitudeSubjects {
    pitch: Subject<number>
    bank: Subject<number>
    slipSkid: Subject<number>
    fdActive: Subject<boolean>
    fdPitch: Subject<number>
    fdBark: Subject<number>
    lowBankMode: Subject<boolean>
}

export interface AirspeedSubjects {
    indicatedAirspeed: Subject<number>
    trueAirspeed: Subject<number>
    groundSpeed: Subject<number>
    machSpeed: Subject<number>
    displayRefSpeed: Subject<string>
    refSpeedMach: Subject<number>
    refSpeed: Subject<number>
    airspeedTrend: Subject<number>
    maxSpeed: Subject<number>
    displayMach: Subject<boolean>
    noTrueAirspeed: Subject<boolean>
}

export interface HSISubjects {
    heading: Subject<number>
    course: Subject<number>
    cdiDeviation: Subject<number>
    bearing1: Subject<number>
    bearing2: Subject<number>
    dmeDistance: Subject<number>
    turnRate: Subject<number>
    headingValue: Subject<string>
    groundSpeedValue: Subject<string>
    waypointDistanceValue: Subject<string>
    waypointMode: Subject<string>
}

interface PfdContentProps extends ComponentProps {
    apSubjects: APInfoBarSubjects
    attitude: AttitudeSubjects
    altimeter: AltimeterSubjects
    airspeed: AirspeedSubjects
    cdiSource: Subject<number>
    cdiDeviation: Subject<number>
    cdiVisible: Subject<boolean>
    compassHeading: Subject<number>
    compassTrack: Subject<number>
    compassCourse: Subject<number>
}

class PfdContent extends DisplayComponent<PfdContentProps> {
    render(): VNode {
        const att = this.props.attitude
        const spd = this.props.airspeed
        const alt = this.props.altimeter
        return (
            <>
                <div id="AP">
                    <APInfoBarComponent {...this.props.apSubjects} />
                </div>
                <div id="Horizon">
                    <AttitudeIndicatorComponent
                        verticalCenter={true}
                        bottomY={215}
                        slipSkidDisplayMode={SlipSkidDisplayMode.ROUND}
                        showTurnRate={true}
                        bankSizeRatio={-12}
                        isBackup={false}
                        pitch={att.pitch}
                        bank={att.bank}
                        slipSkid={att.slipSkid}
                        fdActive={att.fdActive}
                        fdPitch={att.fdPitch}
                        fdBark={att.fdBark}
                        lowBankMode={att.lowBankMode}
                    />
                </div>
                <div id="Altimeter">
                    <AltimeterComponent
                        height={1020}
                        VSStyle="Compact"
                        indicatedAltitude={alt.indicatedAltitude}
                        baroPressure={alt.baroPressure}
                        verticalSpeed={alt.verticalSpeed}
                        referenceAltitude={alt.referenceAltitude}
                        altitudeAlertState={alt.altitudeAlertState}
                        referenceVspeed={alt.referenceVspeed}
                        verticalDeviationMode={alt.verticalDeviationMode}
                        verticalDeviationValue={alt.verticalDeviationValue}
                    />
                </div>
                <div id="Airspeed">
                    <AirspeedIndicatorComponent
                        height={850}
                        noColor={false}
                        indicatedAirspeed={spd.indicatedAirspeed}
                        trueAirspeed={spd.trueAirspeed}
                        groundSpeed={spd.groundSpeed}
                        machSpeed={spd.machSpeed}
                        displayRefSpeed={spd.displayRefSpeed}
                        refSpeedMach={spd.refSpeedMach}
                        refSpeed={spd.refSpeed}
                        airspeedTrend={spd.airspeedTrend}
                        maxSpeed={spd.maxSpeed}
                        displayMach={spd.displayMach}
                        noTrueAirspeed={spd.noTrueAirspeed}
                    />
                </div>
                <div id="Compass">
                    <HorizontalCompassComponent
                        truncateLeft={50}
                        truncateRight={78}
                        spacing={50}
                        groundTrackActive={true}
                        heading={this.props.compassHeading}
                        track={this.props.compassTrack}
                        course={this.props.compassCourse}
                    />
                </div>
                <div id="CDI">
                    <CDIComponent
                        noScale={true}
                        indicatorShape="Diamond"
                        cdiSource={this.props.cdiSource}
                        cdiDeviation={this.props.cdiDeviation}
                        isVisible={this.props.cdiVisible}
                    />
                </div>
            </>
        )
    }
}

interface MfdContentProps extends ComponentProps {
    hsi: HSISubjects
    groundSpeedEl: Subject<HTMLElement | null>
    waypointDistanceEl: Subject<HTMLElement | null>
    headingValueEl: Subject<HTMLElement | null>
}

class MfdContent extends DisplayComponent<MfdContentProps> {
    private readonly shvRef = FSComponent.createRef<HTMLDivElement>()
    private readonly gsvRef = FSComponent.createRef<HTMLDivElement>()
    private readonly wdvRef = FSComponent.createRef<HTMLDivElement>()

    private readonly subs: Subscription[] = []

    onAfterRender() {
        this.props.groundSpeedEl.set(this.gsvRef.getOrDefault())
        this.props.waypointDistanceEl.set(this.wdvRef.getOrDefault())
        this.props.headingValueEl.set(this.shvRef.getOrDefault())

        const headingEl = this.shvRef.getOrDefault()!
        const gsEl = this.gsvRef.getOrDefault()!
        const wdEl = this.wdvRef.getOrDefault()!

        this.subs.push(
            this.props.hsi.headingValue.sub(v => {
                headingEl.textContent = v
            }, true),
            this.props.hsi.groundSpeedValue.sub(v => {
                gsEl.textContent = v
            }, true),
            this.props.hsi.waypointDistanceValue.sub(v => {
                wdEl.textContent = v
            }, true),
            this.props.hsi.waypointMode.sub(v => {
                wdEl.setAttribute('mode', v)
            }, true)
        )
    }

    destroy(): void {
        this.subs.forEach(s => s.destroy())
        super.destroy()
    }

    render(): VNode {
        const hsi = this.props.hsi
        return (
            <>
                <div id="HSICompass">
                    <HSIComponent
                        noHeadingValue={true}
                        noCourseValue={true}
                        noCenterText={false}
                        noTurnRateIndicator={false}
                        noBackground={false}
                        noAffectSimRadioNav={false}
                        largeCompass={false}
                        displayStyle={HSIndicatorDisplayType.GlassCockpit}
                        fmsAlias=""
                        heading={hsi.heading}
                        course={hsi.course}
                        cdiDeviation={hsi.cdiDeviation}
                        bearing1={hsi.bearing1}
                        bearing2={hsi.bearing2}
                        dmeDistance={hsi.dmeDistance}
                        turnRate={hsi.turnRate}
                        headingValue={hsi.headingValue}
                        groundSpeedValue={hsi.groundSpeedValue}
                        waypointDistanceValue={hsi.waypointDistanceValue}
                        waypointMode={hsi.waypointMode}
                    />
                </div>
                <div id="Infos">
                    <div id="SelectedHeading">
                        <svg id="SelectedHeadingSymbol" viewBox="0 0 50 100">
                            <path d="M0,0 h50 v30 l-30,20 l30,20 v30 h-50 Z" fill="aqua" />
                        </svg>
                        <div id="SelectedHeadingValue" ref={this.shvRef}>
                            060°
                        </div>
                    </div>
                    <div id="GroundSpeed">
                        <div>GS KT</div>
                        <div id="GroundSpeedValue" ref={this.gsvRef}>
                            202
                        </div>
                    </div>
                    <div id="WaypointDistance">
                        <div>DIST NM</div>
                        <div id="WaypointDistanceValue" ref={this.wdvRef}>
                            371
                        </div>
                    </div>
                </div>
            </>
        )
    }
}

interface InstrumentProps extends ComponentProps {
    apSubjects: APInfoBarSubjects
    attitude: AttitudeSubjects
    altimeter: AltimeterSubjects
    airspeed: AirspeedSubjects
    cdiSource: Subject<number>
    cdiDeviation: Subject<number>
    cdiVisible: Subject<boolean>
    compassHeading: Subject<number>
    compassTrack: Subject<number>
    compassCourse: Subject<number>
    hsi: HSISubjects
    groundSpeedEl: Subject<HTMLElement | null>
    waypointDistanceEl: Subject<HTMLElement | null>
    headingValueEl: Subject<HTMLElement | null>
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
                        <PfdContent
                            apSubjects={this.props.apSubjects}
                            attitude={this.props.attitude}
                            altimeter={this.props.altimeter}
                            airspeed={this.props.airspeed}
                            cdiSource={this.props.cdiSource}
                            cdiDeviation={this.props.cdiDeviation}
                            cdiVisible={this.props.cdiVisible}
                            compassHeading={this.props.compassHeading}
                            compassTrack={this.props.compassTrack}
                            compassCourse={this.props.compassCourse}
                        />
                    </div>
                    <div id="MFD">
                        <MfdContent
                            hsi={this.props.hsi}
                            groundSpeedEl={this.props.groundSpeedEl}
                            waypointDistanceEl={this.props.waypointDistanceEl}
                            headingValueEl={this.props.headingValueEl}
                        />
                    </div>
                </div>
            </>
        )
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

        const pfd = this.pageGroups[0].pages[0] as AS5_PFD
        const mfd = this.pageGroups[0].pages[1] as AS5_MFD
        const pfdEls = pfd.element.elements
        const apDisplay = pfdEls[0] as PFD_AutopilotDisplay
        const attitude = pfdEls[1] as PFD_Attitude
        const airspeed = pfdEls[2] as PFD_Airspeed_Enhanced
        const altimeter = pfdEls[3] as PFD_Altimeter
        const compass = pfdEls[4] as AS5_PFD_Compass
        const cdi = pfdEls[5] as AS5_PFD_CDI
        const hsi = mfd.element.elements[0] as AS5_MFD_HSI

        const altimeterSubjects: AltimeterSubjects = {
            indicatedAltitude: Subject.create(0),
            baroPressure: Subject.create(0),
            verticalSpeed: Subject.create(0),
            referenceAltitude: Subject.create(0),
            altitudeAlertState: Subject.create('BlueText'),
            referenceVspeed: Subject.create('----'),
            verticalDeviationMode: Subject.create('None'),
            verticalDeviationValue: Subject.create(0),
        }
        altimeter.subjects = altimeterSubjects

        const apSubjects: APInfoBarSubjects = {
            apStatus: apDisplay.apStatusSubject,
            apStatusDisplay: apDisplay.apStatusDisplaySubject,
            apLateralActive: apDisplay.apLateralActiveSubject,
            apLateralArmed: apDisplay.apLateralArmedSubject,
            apVerticalActive: apDisplay.apVerticalActiveSubject,
            apModeReference: apDisplay.apModeReferenceSubject,
            apArmed: apDisplay.apArmedSubject,
            apArmedReference: apDisplay.apArmedReferenceSubject,
            apYDStatus: apDisplay.apYDStatusSubject,
        }

        const attSubjects: AttitudeSubjects = {
            pitch: attitude.pitchSub,
            bank: attitude.bankSub,
            slipSkid: attitude.slipSkidSub,
            fdActive: attitude.fdActiveSub,
            fdPitch: attitude.fdPitchSub,
            fdBark: attitude.fdBarkSub,
            lowBankMode: attitude.lowBankModeSub,
        }

        const spdSubjects: AirspeedSubjects = {
            indicatedAirspeed: airspeed.indicatedAirspeedSub,
            trueAirspeed: airspeed.trueAirspeedSub,
            groundSpeed: airspeed.groundSpeedSub,
            machSpeed: airspeed.machSpeedSub,
            displayRefSpeed: airspeed.displayRefSpeedSub,
            refSpeedMach: airspeed.refSpeedMachSub,
            refSpeed: airspeed.refSpeedSub,
            airspeedTrend: airspeed.airspeedTrendSub,
            maxSpeed: airspeed.maxSpeedSub,
            displayMach: airspeed.displayMachSub,
            noTrueAirspeed: airspeed.noTrueAirspeedSub,
        }

        const hsiSubjects: HSISubjects = {
            heading: hsi.headingSub,
            course: hsi.courseSub,
            cdiDeviation: hsi.cdiDeviationSub,
            bearing1: hsi.bearing1Sub,
            bearing2: hsi.bearing2Sub,
            dmeDistance: hsi.dmeDistanceSub,
            turnRate: hsi.turnRateSub,
            headingValue: hsi.headingValueSub,
            groundSpeedValue: hsi.groundSpeedValueSub,
            waypointDistanceValue: hsi.waypointDistanceValueSub,
            waypointMode: hsi.waypointModeSub,
        }

        const groundSpeedEl = Subject.create<HTMLElement | null>(null)
        const waypointDistanceEl = Subject.create<HTMLElement | null>(null)
        const headingValueEl = Subject.create<HTMLElement | null>(null)

        FSComponent.render(
            <AS5Instrument
                apSubjects={apSubjects}
                attitude={attSubjects}
                altimeter={altimeterSubjects}
                airspeed={spdSubjects}
                cdiSource={cdi.cdiSourceSub}
                cdiDeviation={cdi.cdiDeviationSub}
                cdiVisible={cdi.cdiVisibleSub}
                compassHeading={compass.headingSub}
                compassTrack={compass.trackSub}
                compassCourse={compass.courseSub}
                hsi={hsiSubjects}
                groundSpeedEl={groundSpeedEl}
                waypointDistanceEl={waypointDistanceEl}
                headingValueEl={headingValueEl}
                onHighlightApi={r => (this.highlightRefs = r)}
            />,
            this.getChildById('Electricity')
        )
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
        SimVar.SetSimVarValue(
            'L:AS5_' + this.instrumentIndex + '_Knob_Value',
            SimVarValueType.Number,
            value
        )
        SimVar.SetSimVarValue(
            'L:AS5_' + this.instrumentIndex + '_Knob_Unit',
            SimVarValueType.Number,
            unit
        )
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
    incrementHeading() {
        this.changeHeading(1)
    }
    decrementHeading() {
        this.changeHeading(-1)
    }
    syncHeading() {
        SimVar.SetSimVarValue(
            'K:HEADING_BUG_SET',
            SimVarValueType.Number,
            Math.round(Simplane.getHeadingMagnetic())
        )
    }
    menuHeadingEnter() {
        this.selectionValueElement.setContext(
            'Select Heading',
            this.getMenuHeadingText.bind(this),
            this.incrementHeading.bind(this),
            this.decrementHeading.bind(this),
            this.syncHeading.bind(this)
        )
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
    incrementCrs() {
        SimVar.SetSimVarValue('K:VOR1_OBI_INC', SimVarValueType.Number, 0)
    }
    decrementCrs() {
        SimVar.SetSimVarValue('K:VOR1_OBI_DEC', SimVarValueType.Number, 0)
    }
    menuCrsEnter() {
        this.selectionValueElement.setContext(
            'Select Course',
            this.getMenuCrsText.bind(this),
            this.incrementCrs.bind(this),
            this.decrementCrs.bind(this),
            this.syncCrs.bind(this)
        )
        this.selectionValueElement.rawValue = this.getMenuCrsRawValue.bind(this)
        this.selectionValueElement.unit = 0
        this.switchToPopUpPage(this.selectionValueWindow)
    }
    getMenuAltitudeText() {
        return (
            fastToFixed(
                SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK VAR', SimVarValueType.Feet),
                0
            ) + 'ft'
        )
    }
    getMenuAltitudeRawValue() {
        return SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK VAR', SimVarValueType.Feet)
    }
    incrementAltitude() {
        SimVar.SetSimVarValue('K:AP_ALT_VAR_INC', SimVarValueType.Number, 100)
    }
    decrementAltitude() {
        SimVar.SetSimVarValue('K:AP_ALT_VAR_DEC', SimVarValueType.Number, 100)
    }
    syncAltitude() {
        SimVar.SetSimVarValue(
            'K:AP_ALT_VAR_SET_ENGLISH',
            SimVarValueType.Number,
            Math.round(Simplane.getAltitude() / 100) * 100
        )
    }
    menuAltitudeEnter() {
        this.selectionValueElement.setContext(
            'Select Altitude',
            this.getMenuAltitudeText.bind(this),
            this.incrementAltitude.bind(this),
            this.decrementAltitude.bind(this),
            this.syncAltitude.bind(this)
        )
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
            new ContextualMenuElementImage(
                'Back',
                this.gps.SwitchToInteractionState.bind(this.gps, 0),
                '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png',
                false
            ),
            new ContextualMenuElementValue(
                'Heading',
                this.gps.menuHeadingEnter.bind(this.gps),
                this.gps.getMenuHeadingText.bind(this.gps),
                false
            ),
            new ContextualMenuElementValue(
                'Altitude',
                this.gps.menuAltitudeEnter.bind(this.gps),
                this.gps.getMenuAltitudeText.bind(this.gps),
                false
            ),
            new ContextualMenuElementValue('Pitch', null, () => '-----°', true),
            new ContextualMenuElementImage(
                'MFD',
                this.gps.SwitchToPageName.bind(this.gps, 'Main', 'MFD'),
                '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/MFD.png',
                false
            ),
        ])
    }

    onUpdate(deltaTime) {
        super.onUpdate(deltaTime)
    }
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
            new ContextualMenuElementImage(
                'Back',
                this.gps.SwitchToInteractionState.bind(this.gps, 0),
                '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png',
                false
            ),
            new ContextualMenuElementValue(
                'Heading',
                this.gps.menuHeadingEnter.bind(this.gps),
                this.gps.getMenuHeadingText.bind(this.gps),
                false
            ),
            new ContextualMenuElementValue(
                'Course',
                this.gps.menuCrsEnter.bind(this.gps),
                this.gps.getMenuCrsText.bind(this.gps),
                false
            ),
            new ContextualMenuElementImage(
                'PFD',
                this.gps.SwitchToPageName.bind(this.gps, 'Main', 'PFD'),
                '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/PFD.png',
                false
            ),
        ])
    }
}
export class AS5_PFD_Compass extends NavSystemElement {
    headingSub = Subject.create(0)
    trackSub = Subject.create(0)
    courseSub = Subject.create(0)

    init(_root) {}
    onEnter() {}
    onUpdate(_deltaTime) {
        this.headingSub.set(Simplane.getHeadingMagnetic())
        this.trackSub.set(Simplane.getTrackAngle())
        this.courseSub.set(parseFloat(Simplane.getAutoPilotDisplayedHeadingLockValueDegrees() + ''))
    }
    onExit() {}
    onEvent(_event) {}
}
export class AS5_PFD_CDI extends NavSystemElement {
    cdiSourceSub = Subject.create(3)
    cdiDeviationSub = Subject.create(0)
    cdiVisibleSub = Subject.create(false)

    init(_root) {}
    onEnter() {}
    onUpdate(_deltaTime) {
        const cdiSource = SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)
            ? 3
            : Simplane.getAutoPilotSelectedNav()
        switch (cdiSource) {
            case 1:
            case 2:
                this.cdiVisibleSub.set(Simplane.getNavHasNav(cdiSource))
                this.cdiDeviationSub.set(
                    SimVar.GetSimVarValue('NAV CDI:' + cdiSource, SimVarValueType.Number) / 127
                )
                this.cdiSourceSub.set(cdiSource)
                break
            case 3:
                this.cdiVisibleSub.set(
                    SimVar.GetSimVarValue('GPS WP NEXT ID', SimVarValueType.String) != ''
                )
                this.cdiDeviationSub.set(
                    SimVar.GetSimVarValue('GPS WP CROSS TRK', SimVarValueType.NM)
                )
                this.cdiSourceSub.set(3)
                break
        }
    }
    onExit() {}
    onEvent(_event) {}
}
export class AS5_MFD_HSI extends PFD_Compass {
    headingValueSub = Subject.create('---°')
    groundSpeedValueSub = Subject.create('0')
    waypointDistanceValueSub = Subject.create('---')
    waypointModeSub = Subject.create('GPS')

    private _cdiSource: number = 0
    private _dmeSource: number = 0

    set cdiSource(_val: number) {
        this._cdiSource = _val
    }
    get cdiSource(): number {
        return this._cdiSource
    }
    set dmeSource(_val: number) {
        this._dmeSource = _val
    }
    get dmeSource(): number {
        return this._dmeSource
    }

    init(_root) {}

    onUpdate(_deltaTime) {
        let headingValue = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees())
        if (headingValue == 0) headingValue = 360
        const hdg = fastToFixed(headingValue, 0)
        this.headingValueSub.set('000'.slice(hdg.length) + hdg + '\u00B0')

        this.groundSpeedValueSub.set(fastToFixed(Simplane.getGroundSpeed(), 0) + '')

        if ((this.cdiSource == 1 || this.cdiSource == 2) && this.dmeSource != this.cdiSource) {
            this.dmeSource = this.cdiSource
        } else {
            let distanceText = '---'
            let mode = 'GPS'
            switch (this.cdiSource) {
                case 1:
                case 2: {
                    const dmeDist = Simplane.getNavDme(this.cdiSource)
                    if (!isNaN(dmeDist)) distanceText = fastToFixed(dmeDist, 1)
                    mode = 'VOR'
                    break
                }
                case 3:
                    if (
                        SimVar.GetSimVarValue('GPS IS ACTIVE WAY POINT', SimVarValueType.Bool) ==
                        true
                    )
                        distanceText = fastToFixed(
                            SimVar.GetSimVarValue('GPS WP DISTANCE', SimVarValueType.NM),
                            1
                        )
                    mode = 'GPS'
                    break
            }
            this.waypointDistanceValueSub.set(distanceText)
            this.waypointModeSub.set(mode)
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
    onExit() {
        diffAndSetAttribute(this.window, 'state', 'Inactive')
    }
    onEvent(_event) {
        switch (_event) {
            case 'Knob_Inc':
                if (this.incCallback) this.incCallback()
                break
            case 'Knob_Dec':
                if (this.decCallback) this.decCallback()
                break
            case 'Knob_Push':
                this.gps.closePopUpElement()
                break
            case 'Knob_Long_Push':
                if (this.syncCallback) this.syncCallback()
                break
        }
    }

    setContext(
        _titleText,
        _getCallback,
        _incCallback = EmptyCallback.Void,
        _decCallback = EmptyCallback.Void,
        _syncCallback = EmptyCallback.Void
    ) {
        diffAndSetText(this.title, _titleText)
        this.getCallback = _getCallback
        this.incCallback = _incCallback
        this.decCallback = _decCallback
        this.syncCallback = _syncCallback
    }
}
registerInstrument('as5-element', AS5)
