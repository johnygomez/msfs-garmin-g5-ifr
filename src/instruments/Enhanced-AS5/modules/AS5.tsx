import {
    AdcEvents,
    AdcPublisher,
    AhrsPublisher,
    ComponentProps,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    InputAcceleration,
    NavComSimVarPublisher,
    SimVarValueType,
    VNode,
} from '@microsoft/msfs-sdk'

import { AirspeedDataProvider } from './AirspeedDataProvider'
import { AutopilotAnnunciationProvider } from './AutopilotAnnunciationProvider'
import { ContextualMenuComponent } from './ContextualMenu'
import { G5CustomEvents, G5CustomPublisher } from './G5CustomPublisher'
import { G5NavPublisher } from './G5NavPublisher'
import { HighlightComponent, HighlightElementRefs } from './Highlight'
import { AS5_MFD, MfdContent } from './MFD'
import { NavdataStack } from './NavdataStack'
import { NavSourceDataProvider } from './NavSourceDataProvider'
import {
    NavSystem,
    NavSystemElement,
    NavSystemElementContainer,
    NavSystemPageGroup,
} from './NavSystem'
import { AS5_PFD, PfdContent } from './PFD'
import { formatDegrees3 } from './Utils'

interface AS5InstrumentProps extends ComponentProps {
    bus: EventBus
    mfd: AS5_MFD
    autopilot: AutopilotAnnunciationProvider
    airspeedData: AirspeedDataProvider
    navData: NavSourceDataProvider
    onHighlightApi: (refs: HighlightElementRefs) => void
}

class AS5Instrument extends DisplayComponent<AS5InstrumentProps> {
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
                            autopilot={this.props.autopilot.subjects}
                            airspeed={this.props.airspeedData.subjects}
                            altimeter={this.props.navData.altimeterSubjects}
                            cdi={this.props.navData.cdiSubjects}
                        />
                    </div>
                    <div id="MFD">
                        <MfdContent
                            bus={this.props.bus}
                            altimeter={this.props.navData.altimeterSubjects}
                            navSource={this.props.navData.activeSource}
                            hsiComponent={this.props.mfd.hsi.hsiComponentSub}
                        />
                    </div>
                </div>
            </>
        )
    }
}

export class AS5 extends NavSystem {
    readonly bus = new EventBus()

    private readonly knobSub = this.bus.getSubscriber<G5CustomEvents & AdcEvents>()
    private readonly apHeadingSelected = ConsumerSubject.create(
        this.knobSub.on('ap_heading_selected'),
        0
    )
    private readonly apAltitudeSelected = ConsumerSubject.create(
        this.knobSub.on('ap_altitude_selected'),
        0
    )
    private readonly nav1Obs = ConsumerSubject.create(this.knobSub.on('nav1_obs'), 0)
    private readonly baroSettingInHg = ConsumerSubject.create(
        this.knobSub.on('altimeter_baro_setting_inhg'),
        29.92
    )

    readonly menuHeadingTextSub = this.apHeadingSelected.map(formatDegrees3)
    readonly menuAltitudeTextSub = this.apAltitudeSelected.map(
        altitude => fastToFixed(altitude, 0) + 'ft'
    )
    readonly menuCourseTextSub = this.nav1Obs.map(formatDegrees3)

    pageGroups: NavSystemPageGroup[]
    highlightRefs: HighlightElementRefs

    private readonly pfdPage = new AS5_PFD()
    private readonly mfdPage = new AS5_MFD()

    private selectionValueElement: AS5_SelectionValueElement
    private selectionValueWindow: NavSystemElementContainer

    private adcPublisher?: AdcPublisher
    private ahrsPublisher?: AhrsPublisher
    private navComPublisher?: NavComSimVarPublisher
    private customPublisher?: G5CustomPublisher
    private navPublisher?: G5NavPublisher
    private navSourceProvider?: NavSourceDataProvider
    private airspeedProvider?: AirspeedDataProvider
    private navdataStack?: NavdataStack
    private apAnnunciationProvider?: AutopilotAnnunciationProvider

    private lastHdgKnobTime: number
    private lastHdgKnobSign: number
    private hdgKnobAccel: InputAcceleration
    private hdgKnobTarget: number

    constructor() {
        super()
        this.pageGroups = [new NavSystemPageGroup('Main', this, [this.pfdPage, this.mfdPage])]
    }

    get templateID() {
        return 'AS5'
    }

    private get isMfdPageActive(): boolean {
        return this.pageGroups?.[0]?.pageIndex == 1
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

        this.navSourceProvider = new NavSourceDataProvider(this.bus)
        this.navSourceProvider.resume()
        this.airspeedProvider = new AirspeedDataProvider(this.bus)
        this.airspeedProvider.resume()
        this.navdataStack = new NavdataStack(this.bus)
        this.navdataStack.init().catch(e => console.error('NavdataStack init failed', e))
        this.apAnnunciationProvider = new AutopilotAnnunciationProvider()

        this.adcPublisher = new AdcPublisher(this.bus)
        this.ahrsPublisher = new AhrsPublisher(this.bus)
        this.navComPublisher = new NavComSimVarPublisher(this.bus)
        this.customPublisher = new G5CustomPublisher(this.bus)
        this.navPublisher = new G5NavPublisher(this.bus)

        this.adcPublisher.startPublish()
        this.ahrsPublisher.startPublish()
        this.navComPublisher.startPublish()
        this.customPublisher.startPublish()
        this.navPublisher.startPublish()

        FSComponent.render(
            <AS5Instrument
                bus={this.bus}
                mfd={this.mfdPage}
                autopilot={this.apAnnunciationProvider}
                airspeedData={this.airspeedProvider}
                navData={this.navSourceProvider}
                onHighlightApi={refs => (this.highlightRefs = refs)}
            />,
            this.getChildById('Electricity')
        )

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

    onUpdate(_deltaTime: number) {
        this.adcPublisher?.onUpdate()
        this.ahrsPublisher?.onUpdate()
        this.navComPublisher?.onUpdate()
        this.customPublisher?.onUpdate()
        this.navPublisher?.onUpdate()
        this.navdataStack?.onUpdate()
        this.airspeedProvider?.onUpdate(_deltaTime)
        this.apAnnunciationProvider?.onUpdate()
        this.updateKnobTooltipValue()
    }

    computeEvent(_event: string) {
        const popUpWasOpen = this.popUpElement != null
        super.computeEvent(_event)
        this.apAnnunciationProvider?.onEvent(_event)
        switch (_event) {
            case 'Knob_Inc':
                if (this.currentInteractionState == 2) {
                    this.computeEvent('NavigationSmallInc')
                } else if (this.isMfdPageActive && !popUpWasOpen) {
                    this.incrementHeading()
                } else if (!popUpWasOpen) {
                    this.computeEvent('BARO_INC')
                }
                break
            case 'Knob_Dec':
                if (this.currentInteractionState == 2) {
                    this.computeEvent('NavigationSmallDec')
                } else if (this.isMfdPageActive && !popUpWasOpen) {
                    this.decrementHeading()
                } else if (!popUpWasOpen) {
                    this.computeEvent('BARO_DEC')
                }
                break
            case 'Knob_Push':
                if (this.currentInteractionState == 2) this.computeEvent('ENT_Push')
                else if (!popUpWasOpen) this.computeEvent('MENU_Push')
                break
            case 'Knob_Long_Push':
                if (this.currentInteractionState == 0 && this.isMfdPageActive && !popUpWasOpen) {
                    this.syncHeading()
                }
                break
        }
    }

    onPowerOn() {
        super.onPowerOn()
        if (this.instrumentIndex == 2) this.SwitchToPageName('Main', 'MFD')
        else this.SwitchToPageName('Main', 'PFD')
    }

    private updateKnobTooltipValue() {
        let value, unit
        if (
            this.popUpElement === this.selectionValueWindow &&
            this.selectionValueElement.rawValue
        ) {
            value = this.selectionValueElement.rawValue()
            unit = this.selectionValueElement.unit
        } else if (this.isMfdPageActive) {
            value = this.getMenuHeadingRawValue()
            unit = 0
        } else {
            value = this.baroSettingInHg.get()
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

    private getMenuHeadingText() {
        return this.menuHeadingTextSub.get()
    }

    private getMenuHeadingRawValue() {
        const heading = Math.round(this.apHeadingSelected.get())
        return heading == 0 ? 360 : heading
    }

    private changeHeading(_sign: number) {
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

    private incrementHeading() {
        this.changeHeading(1)
    }

    private decrementHeading() {
        this.changeHeading(-1)
    }

    private syncHeading() {
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

    private getMenuCrsText() {
        return this.menuCourseTextSub.get()
    }

    private getMenuCrsRawValue() {
        const crs = Math.round(this.nav1Obs.get())
        return crs == 0 ? 360 : crs
    }

    private incrementCrs() {
        SimVar.SetSimVarValue('K:VOR1_OBI_INC', SimVarValueType.Number, 0)
    }

    private decrementCrs() {
        SimVar.SetSimVarValue('K:VOR1_OBI_DEC', SimVarValueType.Number, 0)
    }

    private syncCrs() {}

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

    private getMenuAltitudeText() {
        return this.menuAltitudeTextSub.get()
    }

    private getMenuAltitudeRawValue() {
        return this.apAltitudeSelected.get()
    }

    private incrementAltitude() {
        SimVar.SetSimVarValue('K:AP_ALT_VAR_INC', SimVarValueType.Number, 100)
    }

    private decrementAltitude() {
        SimVar.SetSimVarValue('K:AP_ALT_VAR_DEC', SimVarValueType.Number, 100)
    }

    private syncAltitude() {
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

    init(_root: HTMLElement) {
        this.window = _root
        this.title = this.gps.getChildById('SelectionValueWindowTitle')
        this.value = this.gps.getChildById('SelectionValueWindowValue')
    }

    onEnter() {
        if (this.getCallback && this.value) diffAndSetText(this.value, this.getCallback())
        diffAndSetAttribute(this.window, 'state', 'Active')
    }

    onUpdate(_deltaTime: number) {
        if (this.getCallback && this.value) diffAndSetText(this.value, this.getCallback())
    }

    onExit() {
        diffAndSetAttribute(this.window, 'state', 'Inactive')
    }

    onEvent(_event: string) {
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
        _titleText: string,
        _getCallback: () => string,
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
