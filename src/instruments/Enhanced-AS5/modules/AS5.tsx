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
    Subject,
    Subscribable,
    Subscription,
    VNode,
} from '@microsoft/msfs-sdk'

import { ContextualMenuComponent, ContextualMenuSettings } from './common/ContextualMenu'
import { NavSystem, NavSystemPageGroup } from './common/NavSystem'
import {
    KnobValueUnit,
    SelectionValueContext,
    SelectionValueElement,
    SelectionValueSubjects,
    SelectionValueWindowComponent,
} from './common/SelectionValueWindow'
import { formatDegrees3, normalizeDegrees360 } from './common/Utils'
import { AS5_MFD, MfdContent } from './mfd/MFD'
import { AS5_PFD, PfdContent } from './pfd/PFD'
import { AirspeedDataProvider } from './providers/AirspeedDataProvider'
import { AutopilotAnnunciationProvider } from './providers/AutopilotAnnunciationProvider'
import { NavdataStack } from './providers/NavdataStack'
import { NavSourceDataProvider } from './providers/NavSourceDataProvider'
import { G5CustomEvents, G5CustomPublisher } from './publishers/G5CustomPublisher'
import { G5NavPublisher } from './publishers/G5NavPublisher'

const HEADING_KNOB_RESET_MS = 600

interface AS5InstrumentProps extends ComponentProps {
    bus: EventBus
    mfd: AS5_MFD
    autopilot: AutopilotAnnunciationProvider
    airspeedData: AirspeedDataProvider
    navData: NavSourceDataProvider
    pageState: Subscribable<string>
    menu: ContextualMenuSettings
    selectionValue: SelectionValueSubjects
}

class AS5Instrument extends DisplayComponent<AS5InstrumentProps> {
    render(): VNode {
        return (
            <>
                <div id="PageContainer" state={this.props.pageState}>
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
                <ContextualMenuComponent {...this.props.menu} />
                <SelectionValueWindowComponent {...this.props.selectionValue} />
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

    private readonly selectedHeadingDegrees = this.apHeadingSelected.map(normalizeDegrees360)
    private readonly selectedCourseDegrees = this.nav1Obs.map(normalizeDegrees360)

    readonly menuHeadingTextSub = this.selectedHeadingDegrees.map(formatDegrees3)
    readonly menuAltitudeTextSub = this.apAltitudeSelected.map(
        altitude => fastToFixed(altitude, 0) + 'ft'
    )
    readonly menuCourseTextSub = this.selectedCourseDegrees.map(formatDegrees3)

    private readonly knobValue = Subject.create(0)
    private readonly knobUnit = Subject.create<KnobValueUnit>(KnobValueUnit.Degrees)
    private knobValuePipe?: Subscription

    pageGroups: NavSystemPageGroup[]

    private readonly pfdPage = new AS5_PFD()
    private readonly mfdPage = new AS5_MFD()

    private readonly selectionValueElement = new SelectionValueElement()

    private adcPublisher?: AdcPublisher
    private ahrsPublisher?: AhrsPublisher
    private navComPublisher?: NavComSimVarPublisher
    private customPublisher?: G5CustomPublisher
    private navPublisher?: G5NavPublisher
    private navSourceProvider?: NavSourceDataProvider
    private airspeedProvider?: AirspeedDataProvider
    private navdataStack?: NavdataStack
    private apAnnunciationProvider?: AutopilotAnnunciationProvider

    private readonly headingKnobAccel = new InputAcceleration({ increment: 1 })
    private lastHeadingKnobTime = 0
    private lastHeadingKnobSign = 0
    private headingKnobTarget = 0

    constructor() {
        super()
        this.pageGroups = [new NavSystemPageGroup('Main', this, [this.pfdPage, this.mfdPage])]
    }

    get templateID() {
        return 'AS5'
    }

    private get isMfdInstrument(): boolean {
        return this.instrumentIndex == 2
    }

    connectedCallback() {
        super.connectedCallback()
        this.menuMaxElems = 4
        this.registerOverlayElement(this.selectionValueElement)

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

        this.bindKnobTooltip()

        FSComponent.render(
            <AS5Instrument
                bus={this.bus}
                mfd={this.mfdPage}
                autopilot={this.apAnnunciationProvider}
                airspeedData={this.airspeedProvider}
                navData={this.navSourceProvider}
                pageState={this.pageState}
                menu={{
                    state: this.contextualMenuState,
                    elements: this.menuElementsSub,
                    cursorIndex: this.menuCursorIndexSub,
                    displayBeginIndex: this.menuDisplayBeginIndexSub,
                    maxVisibleElements: this.menuMaxElems,
                }}
                selectionValue={this.selectionValueElement.subjects}
            />,
            this.getChildById('Electricity')
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
    }

    computeEvent(_event: string) {
        const popUpWasOpen = this.activeOverlay != null
        super.computeEvent(_event)
        this.apAnnunciationProvider?.onEvent(_event)
        switch (_event) {
            case 'Knob_Inc':
                if (this.currentInteractionState == 2) {
                    this.computeEvent('NavigationSmallInc')
                } else if (this.isMfdInstrument && !popUpWasOpen) {
                    this.incrementHeading()
                } else if (!popUpWasOpen) {
                    this.computeEvent('BARO_INC')
                }
                break
            case 'Knob_Dec':
                if (this.currentInteractionState == 2) {
                    this.computeEvent('NavigationSmallDec')
                } else if (this.isMfdInstrument && !popUpWasOpen) {
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
                if (this.currentInteractionState == 0 && this.isMfdInstrument && !popUpWasOpen) {
                    this.syncHeading()
                }
                break
        }
    }

    onPowerOn() {
        super.onPowerOn()
        if (this.isMfdInstrument) this.SwitchToPageName('Main', 'MFD')
        else this.SwitchToPageName('Main', 'PFD')
    }

    menuHeadingEnter() {
        this.openSelectionValueWindow({
            title: 'Select Heading',
            displayValue: this.menuHeadingTextSub,
            knobValue: this.selectedHeadingDegrees,
            knobUnit: KnobValueUnit.Degrees,
            onIncrement: () => this.incrementHeading(),
            onDecrement: () => this.decrementHeading(),
            onSync: () => this.syncHeading(),
        })
    }

    menuCrsEnter() {
        this.openSelectionValueWindow({
            title: 'Select Course',
            displayValue: this.menuCourseTextSub,
            knobValue: this.selectedCourseDegrees,
            knobUnit: KnobValueUnit.Degrees,
            onIncrement: () => this.incrementCourse(),
            onDecrement: () => this.decrementCourse(),
        })
    }

    menuAltitudeEnter() {
        this.openSelectionValueWindow({
            title: 'Select Altitude',
            displayValue: this.menuAltitudeTextSub,
            knobValue: this.apAltitudeSelected,
            knobUnit: KnobValueUnit.Feet,
            onIncrement: () => this.incrementAltitude(),
            onDecrement: () => this.decrementAltitude(),
            onSync: () => this.syncAltitude(),
        })
    }

    private openSelectionValueWindow(context: SelectionValueContext) {
        this.openOverlay(this.selectionValueElement.createOverlay(context))
    }

    private bindKnobTooltip() {
        this.selectionValueElement.activeContext.sub(
            context => this.rebindKnobValueSource(context),
            true
        )
        this.knobValue.sub(value => this.setKnobSimVar('Knob_Value', value), true)
        this.knobUnit.sub(unit => this.setKnobSimVar('Knob_Unit', unit), true)
    }

    private rebindKnobValueSource(context: SelectionValueContext | null) {
        this.knobValuePipe?.destroy()
        if (context) {
            this.knobUnit.set(context.knobUnit)
            this.knobValuePipe = context.knobValue.pipe(this.knobValue)
        } else if (this.isMfdInstrument) {
            this.knobUnit.set(KnobValueUnit.Degrees)
            this.knobValuePipe = this.selectedHeadingDegrees.pipe(this.knobValue)
        } else {
            this.knobUnit.set(KnobValueUnit.InHg)
            this.knobValuePipe = this.baroSettingInHg.pipe(this.knobValue)
        }
    }

    private setKnobSimVar(name: string, value: number) {
        SimVar.SetSimVarValue(
            `L:AS5_${this.instrumentIndex}_${name}`,
            SimVarValueType.Number,
            value
        )
    }

    private changeHeading(sign: number) {
        const now = Date.now()
        const elapsed = now - this.lastHeadingKnobTime
        if (elapsed > HEADING_KNOB_RESET_MS || sign != this.lastHeadingKnobSign) {
            this.headingKnobTarget = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees())
            this.headingKnobAccel.resume()
        }
        this.lastHeadingKnobTime = now
        this.lastHeadingKnobSign = sign
        const step = this.headingKnobAccel.doStep()
        this.headingKnobTarget = (((this.headingKnobTarget + sign * step) % 360) + 360) % 360
        SimVar.SetSimVarValue('K:HEADING_BUG_SET', SimVarValueType.Number, this.headingKnobTarget)
    }

    private incrementHeading() {
        this.changeHeading(1)
    }

    private decrementHeading() {
        this.changeHeading(-1)
    }

    private syncHeading() {
        if (!this.isMfdInstrument) return
        SimVar.SetSimVarValue(
            'K:HEADING_BUG_SET',
            SimVarValueType.Number,
            Math.round(Simplane.getHeadingMagnetic())
        )
    }

    private incrementCourse() {
        SimVar.SetSimVarValue('K:VOR1_OBI_INC', SimVarValueType.Number, 0)
    }

    private decrementCourse() {
        SimVar.SetSimVarValue('K:VOR1_OBI_DEC', SimVarValueType.Number, 0)
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
}

registerInstrument('as5-element', AS5)
