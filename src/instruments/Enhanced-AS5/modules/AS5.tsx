import {
    FSComponent,
    DisplayComponent,
    VNode,
    ComponentProps,
    InputAcceleration,
    SimVarValueType,
    Subject,
    Subscription,
    EventBus,
    AdcPublisher,
    AhrsPublisher,
    NavComSimVarPublisher,
    ConsumerSubject,
    AhrsEvents,
} from '@microsoft/msfs-sdk'

import { AirspeedIndicatorComponent } from './AirspeedIndicator'
import { AltimeterComponent } from './Altimeter'
import { APInfoBarComponent, APInfoBarSubjects } from './APInfoBar'
import { AttitudeIndicatorComponent } from './AttitudeIndicator'
import { CDIComponent } from './CDI'
import {
    PFD_AutopilotDisplay,
    PFD_Attitude,
    PFD_Altimeter,
    PFD_Compass,
    AltimeterSubjects,
} from './CommonPFD_MFD'
import { ContextualMenuComponent, ContextualMenuElementData } from './ContextualMenu'
import { G5CustomPublisher } from './G5CustomPublisher'
import { HighlightComponent, HighlightElementRefs } from './Highlight'
import { HorizontalCompassComponent } from './HorizontalCompass'
import { HSIComponent, HSIndicatorDisplayType } from './HSIndicator'
import {
    NavSystem,
    NavSystemPage,
    NavSystemPageGroup,
    NavSystemElement,
    NavSystemElementGroup,
    NavSystemElementContainer,
} from './NavSystem'
import { PFD_Airspeed_Enhanced } from './PFD_Airspeed_Enhanced'
import { SlipSkidIndicatorComponent, TurnRateIndicatorComponent } from './TurnSlipIndicator'

export interface AirspeedSubjects {
    indicatedAirspeed: Subject<number>
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
    hsiComponent: Subject<HSIComponent | null>
}

interface PfdContentProps extends ComponentProps {
    bus: EventBus
    apSubjects: APInfoBarSubjects
    altimeter: AltimeterSubjects
    airspeed: AirspeedSubjects
    cdiSource: Subject<number>
    cdiDeviation: Subject<number>
    cdiVisible: Subject<boolean>
}

class PfdContent extends DisplayComponent<PfdContentProps> {
    private readonly turnRate: ConsumerSubject<number>
    private readonly slipSkid: ConsumerSubject<number>

    constructor(props: PfdContentProps) {
        super(props)
        const sub = props.bus.getSubscriber<AhrsEvents>()
        this.turnRate = ConsumerSubject.create(sub.on('delta_heading_rate').withPrecision(2), 0)
        this.slipSkid = ConsumerSubject.create(sub.on('turn_coordinator_ball').withPrecision(2), 0)
    }

    destroy(): void {
        this.turnRate.destroy()
        this.slipSkid.destroy()
        super.destroy()
    }

    render(): VNode {
        const spd = this.props.airspeed
        const alt = this.props.altimeter
        return (
            <>
                <div id="AP">
                    <APInfoBarComponent {...this.props.apSubjects} />
                </div>
                <div id="Horizon">
                    <AttitudeIndicatorComponent
                        bus={this.props.bus}
                        verticalCenter={true}
                        bankSizeRatio={-12}
                        isBackup={false}
                    />
                </div>
                <div id="Altimeter">
                    <AltimeterComponent
                        bus={this.props.bus}
                        height={1020}
                        verticalDeviationMode={alt.verticalDeviationMode}
                        verticalDeviationValue={alt.verticalDeviationValue}
                    />
                </div>
                <div id="Airspeed">
                    <AirspeedIndicatorComponent
                        bus={this.props.bus}
                        height={1020}
                        noColor={false}
                        indicatedAirspeed={spd.indicatedAirspeed}
                        refSpeed={spd.refSpeed}
                        airspeedTrend={spd.airspeedTrend}
                        maxSpeed={spd.maxSpeed}
                    />
                </div>
                <div id="Compass">
                    <HorizontalCompassComponent
                        bus={this.props.bus}
                        truncateLeft={50}
                        truncateRight={78}
                        spacing={50}
                        groundTrackActive={true}
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
                <div id="BottomIndicators">
                    <SlipSkidIndicatorComponent slipSkid={this.slipSkid} />
                    <TurnRateIndicatorComponent turnRate={this.turnRate} />
                </div>
            </>
        )
    }
}

interface MfdContentProps extends ComponentProps {
    bus: EventBus
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

        this.subs.push(
            this.props.hsi.headingValue.sub(v => {
                const el = this.shvRef.getOrDefault()
                if (el) el.textContent = v
            }, true),
            this.props.hsi.groundSpeedValue.sub(v => {
                const el = this.gsvRef.getOrDefault()
                if (el) el.textContent = v
            }, true),
            this.props.hsi.waypointDistanceValue.sub(v => {
                const el = this.wdvRef.getOrDefault()
                if (el) el.textContent = v
            }, true),
            this.props.hsi.waypointMode.sub(v => {
                const el = this.wdvRef.getOrDefault()
                if (el) el.setAttribute('mode', v)
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
                        bus={this.props.bus}
                        noCenterText={false}
                        noBackground={false}
                        noAffectSimRadioNav={false}
                        displayStyle={HSIndicatorDisplayType.GlassCockpit}
                        heading={hsi.heading}
                        onApi={instance => this.props.hsi.hsiComponent.set(instance)}
                    />
                </div>
                <div id="Infos">
                    <div id="SelectedHeading">
                        <svg id="SelectedHeadingSymbol" viewBox="0 0 50 100">
                            <path d="M0,0 h50 v30 l-30,20 l30,20 v30 h-50 Z" fill="aqua" />
                        </svg>
                        <div id="SelectedHeadingValue" ref={this.shvRef}>
                            360°
                        </div>
                    </div>
                    <div id="GroundSpeed">
                        <div>GS KT</div>
                        <div id="GroundSpeedValue" ref={this.gsvRef}>
                            90
                        </div>
                    </div>
                    <div id="WaypointDistance">
                        <div>DIST NM</div>
                        <div id="WaypointDistanceValue" ref={this.wdvRef}>
                            0.0
                        </div>
                    </div>
                </div>
            </>
        )
    }
}

interface InstrumentProps extends ComponentProps {
    bus: EventBus
    apSubjects: APInfoBarSubjects
    altimeter: AltimeterSubjects
    airspeed: AirspeedSubjects
    cdiSource: Subject<number>
    cdiDeviation: Subject<number>
    cdiVisible: Subject<boolean>
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
                            bus={this.props.bus}
                            apSubjects={this.props.apSubjects}
                            altimeter={this.props.altimeter}
                            airspeed={this.props.airspeed}
                            cdiSource={this.props.cdiSource}
                            cdiDeviation={this.props.cdiDeviation}
                            cdiVisible={this.props.cdiVisible}
                        />
                    </div>
                    <div id="MFD">
                        <MfdContent
                            bus={this.props.bus}
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

    readonly bus = new EventBus()
    private adcPublisher?: AdcPublisher
    private ahrsPublisher?: AhrsPublisher
    private navComPublisher?: NavComSimVarPublisher
    private customPublisher?: G5CustomPublisher

    // Reactive Subjects for contextual menu dynamic values
    readonly menuHeadingTextSub = Subject.create('---°')
    readonly menuAltitudeTextSub = Subject.create('-----ft')
    readonly menuCourseTextSub = Subject.create('---°')
    private _lastMenuHeadingText = ''
    private _lastMenuAltitudeText = ''
    private _lastMenuCourseText = ''

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
        const airspeed = pfdEls[2] as PFD_Airspeed_Enhanced
        const altimeter = pfdEls[3] as PFD_Altimeter
        const cdi = pfdEls[5] as AS5_PFD_CDI
        const hsi = mfd.element.elements[0] as AS5_MFD_HSI

        const altimeterSubjects: AltimeterSubjects = {
            indicatedAltitude: Subject.create(0),
            baroPressure: Subject.create(0),
            verticalSpeed: Subject.create(0),
            referenceAltitude: Subject.create(0),
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

        const spdSubjects: AirspeedSubjects = {
            indicatedAirspeed: airspeed.indicatedAirspeedSub,
            displayRefSpeed: airspeed.displayRefSpeedSub,
            refSpeedMach: airspeed.refSpeedMachSub,
            refSpeed: airspeed.refSpeedSub,
            airspeedTrend: airspeed.airspeedTrendSub,
            maxSpeed: airspeed.maxSpeedSub,
            displayMach: airspeed.displayMachSub,
            noTrueAirspeed: airspeed.noTrueAirspeedSub,
        }

        const hsiComponent = Subject.create<HSIComponent | null>(null)

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
            hsiComponent,
        }

        hsi.bindHSIComponent(hsiComponent)

        const groundSpeedEl = Subject.create<HTMLElement | null>(null)
        const waypointDistanceEl = Subject.create<HTMLElement | null>(null)
        const headingValueEl = Subject.create<HTMLElement | null>(null)

        this.adcPublisher = new AdcPublisher(this.bus)
        this.ahrsPublisher = new AhrsPublisher(this.bus)
        this.navComPublisher = new NavComSimVarPublisher(this.bus)
        this.customPublisher = new G5CustomPublisher(this.bus)

        this.adcPublisher.startPublish()
        this.ahrsPublisher.startPublish()
        this.navComPublisher.startPublish()
        this.customPublisher.startPublish()

        FSComponent.render(
            <AS5Instrument
                bus={this.bus}
                apSubjects={apSubjects}
                altimeter={altimeterSubjects}
                airspeed={spdSubjects}
                cdiSource={cdi.cdiSourceSub}
                cdiDeviation={cdi.cdiDeviationSub}
                cdiVisible={cdi.cdiVisibleSub}
                hsi={hsiSubjects}
                groundSpeedEl={groundSpeedEl}
                waypointDistanceEl={waypointDistanceEl}
                headingValueEl={headingValueEl}
                onHighlightApi={r => (this.highlightRefs = r)}
            />,
            this.getChildById('Electricity')
        )

        // Mount the declarative contextual menu component
        FSComponent.render(
            <ContextualMenuComponent
                elements={this.menuElementsSub}
                cursorIndex={this.menuCursorIndexSub}
                displayBeginIndex={this.menuDisplayBeginIndexSub}
                maxVisibleElements={this.menuMaxElems}
                sliderState={this.sliderState}
                sliderCursorStyle={this.sliderCursorStyle}
            />,
            this.getChildById('ContextualMenuElements')
        )
    }

    onUpdate(_deltaTime) {
        this.adcPublisher?.onUpdate()
        this.ahrsPublisher?.onUpdate()
        this.navComPublisher?.onUpdate()
        this.customPublisher?.onUpdate()
        this.updateKnobTooltipValue()

        // Update menu value Subjects (only when value changes)
        const hdg = this.getMenuHeadingText()
        if (hdg !== this._lastMenuHeadingText) {
            this.menuHeadingTextSub.set(hdg)
            this._lastMenuHeadingText = hdg
        }
        const alt = this.getMenuAltitudeText()
        if (alt !== this._lastMenuAltitudeText) {
            this.menuAltitudeTextSub.set(alt)
            this._lastMenuAltitudeText = alt
        }
        const crs = this.getMenuCrsText()
        if (crs !== this._lastMenuCourseText) {
            this.menuCourseTextSub.set(crs)
            this._lastMenuCourseText = crs
        }
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
    defaultMenu: ContextualMenuElementData[]

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
        this.defaultMenu = [
            {
                name: 'Back',
                callback: this.gps.SwitchToInteractionState.bind(this.gps, 0),
                isInactive: () => false,
                imageSrc: '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png',
            },
            {
                name: 'Heading',
                callback: this.gps.menuHeadingEnter.bind(this.gps),
                isInactive: () => false,
                value: (this.gps as AS5).menuHeadingTextSub,
            },
            {
                name: 'Altitude',
                callback: this.gps.menuAltitudeEnter.bind(this.gps),
                isInactive: () => false,
                value: (this.gps as AS5).menuAltitudeTextSub,
            },
            {
                name: 'Pitch',
                callback: () => false,
                isInactive: () => true,
                value: Subject.create('-----°'),
            },
            {
                name: 'MFD',
                callback: this.gps.SwitchToPageName.bind(this.gps, 'Main', 'MFD'),
                isInactive: () => false,
                imageSrc: '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/MFD.png',
            },
        ]
    }

    onUpdate(deltaTime) {
        super.onUpdate(deltaTime)
    }
}
export class AS5_MFD extends NavSystemPage {
    gps: any
    element: NavSystemElementGroup
    defaultMenu: ContextualMenuElementData[]

    constructor() {
        super('MFD', 'MFD', null)
        this.element = new NavSystemElementGroup([new AS5_MFD_HSI('HSICompass')])
    }

    init() {
        super.init()
        this.defaultMenu = [
            {
                name: 'Back',
                callback: this.gps.SwitchToInteractionState.bind(this.gps, 0),
                isInactive: () => false,
                imageSrc: '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png',
            },
            {
                name: 'Heading',
                callback: this.gps.menuHeadingEnter.bind(this.gps),
                isInactive: () => false,
                value: (this.gps as AS5).menuHeadingTextSub,
            },
            {
                name: 'Course',
                callback: this.gps.menuCrsEnter.bind(this.gps),
                isInactive: () => false,
                value: (this.gps as AS5).menuCourseTextSub,
            },
            {
                name: 'PFD',
                callback: this.gps.SwitchToPageName.bind(this.gps, 'Main', 'PFD'),
                isInactive: () => false,
                imageSrc: '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/PFD.png',
            },
        ]
    }
}
export class AS5_PFD_Compass extends NavSystemElement {
    headingSub = Subject.create(0)
    trackSub = Subject.create(0)
    courseSub = Subject.create(0)

    init(_root) {}
    onEnter() {}
    onUpdate(_deltaTime) {
        // Data is published to the EventBus by AhrsPublisher + G5CustomPublisher.
        // Display components read from the bus via ConsumerSubject.
        // Subject fields (headingSub, trackSub, courseSub) retained for backward
        // compatibility until Phase F cleanup.
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

    bindHSIComponent(hsiComponentSub: Subject<HSIComponent | null>): void {
        this._subs.push(
            hsiComponentSub.sub(instance => {
                this._hsiComponent = instance
            })
        )
    }

    init(_root) {}
    private _hsiComponent: HSIComponent | null = null
    private readonly _subs: Subscription[] = []

    onEvent(_event: any) {
        // Forward events to the FSComponent HSI so CDI switching, bearing
        // selection, etc. still work. Override inherited PFD_Compass.onEvent()
        // which would crash trying to access this.hsi.onEvent().
        if (this._hsiComponent) {
            this._hsiComponent.onEvent(_event)
        }
    }

    onUpdate(_deltaTime) {
        this.headingSub.set(Simplane.getAutoPilotHeadingLockValueDegrees())
        this.courseSub.set(Simplane.getNavObs(1))

        let headingValue = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees())
        if (headingValue == 0) headingValue = 360
        const hdg = fastToFixed(headingValue, 0)
        this.headingValueSub.set('000'.slice(hdg.length) + hdg + '\u00B0')

        this.groundSpeedValueSub.set(fastToFixed(Simplane.getGroundSpeed(), 0) + '')

        // HSIComponent.update() must be called explicitly here because it reads
        // SimVars that are not published to the EventBus (CDI, bearing, DME data).
        // The declarative transforms (rose, heading bug, etc.) are driven by
        // ConsumerSubjects / MappedSubjects bound in JSX.
        if (this._hsiComponent) {
            this._hsiComponent.update(_deltaTime)
        }

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
