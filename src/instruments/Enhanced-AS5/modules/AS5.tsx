import {
    AdcPublisher,
    AhrsPublisher,
    ComponentProps,
    DisplayComponent,
    EventBus,
    FSComponent,
    NavComSimVarPublisher,
    NodeReference,
    SimVarValueType,
    Subject,
    Subscribable,
    Subscription,
    VNode,
} from '@microsoft/msfs-sdk'

import { AvionicsInteractionManager } from './common/AvionicsInteractionManager'
import { AvionicsPage, PageId } from './common/AvionicsPage'
import { MfdContent } from './mfd/MFD'
import { PfdContent } from './pfd/PFD'
import { AirspeedDataProvider } from './providers/AirspeedDataProvider'
import { AutopilotAnnunciationProvider } from './providers/AutopilotAnnunciationProvider'
import { GpsSteerSynchronizer } from './providers/GpsSteerSynchronizer'
import { NavdataStack } from './providers/NavdataStack'
import { NavSourceDataProvider } from './providers/NavSourceDataProvider'
import { G5CustomPublisher } from './publishers/G5CustomPublisher'
import { G5NavPublisher } from './publishers/G5NavPublisher'

interface AS5InstrumentProps extends ComponentProps {
    bus: EventBus
    manager: AvionicsInteractionManager
    switchPage: (id: PageId) => void
    pageState: Subscribable<string>
    pfdRef: NodeReference<PfdContent>
    mfdRef: NodeReference<MfdContent>
    autopilot: AutopilotAnnunciationProvider
    airspeedData: AirspeedDataProvider
    navData: NavSourceDataProvider
}

class AS5Instrument extends DisplayComponent<AS5InstrumentProps> {
    render(): VNode {
        const {
            bus,
            manager,
            switchPage,
            pageState,
            pfdRef,
            mfdRef,
            autopilot,
            airspeedData,
            navData,
        } = this.props
        return (
            <div id="PageContainer" state={pageState}>
                <div id="PFD">
                    <PfdContent
                        ref={pfdRef}
                        bus={bus}
                        manager={manager}
                        switchPage={switchPage}
                        autopilot={autopilot.subjects}
                        airspeed={airspeedData.subjects}
                        altimeter={navData.altimeterSubjects}
                        cdi={navData.cdiSubjects}
                        currentNavCourse={navData.currentNavCourse}
                    />
                </div>
                <div id="MFD">
                    <MfdContent
                        ref={mfdRef}
                        bus={bus}
                        manager={manager}
                        switchPage={switchPage}
                        altimeter={navData.altimeterSubjects}
                        navSource={navData.activeSource}
                        navSourceLabel={navData.navSourceLabel}
                        selectedCourse={navData.selectedCourse}
                        currentNavCourse={navData.currentNavCourse}
                        cdiVisible={navData.cdiSubjects.cdiVisible}
                    />
                </div>
            </div>
        )
    }
}

export class AS5 extends BaseInstrument {
    DecomposeEventFromPrefix!: (args: string[]) => string | undefined

    readonly bus = new EventBus()
    private readonly manager = new AvionicsInteractionManager(this.bus)

    private readonly pfdRef = FSComponent.createRef<PfdContent>()
    private readonly mfdRef = FSComponent.createRef<MfdContent>()
    private readonly pageOrder: PageId[] = ['PFD', 'MFD']
    private readonly activePageId = Subject.create<PageId>('PFD')

    private readonly switchPage = (id: PageId): void => this.setActivePage(id)

    private adcPublisher?: AdcPublisher
    private ahrsPublisher?: AhrsPublisher
    private navComPublisher?: NavComSimVarPublisher
    private customPublisher?: G5CustomPublisher
    private navPublisher?: G5NavPublisher
    private navSourceProvider?: NavSourceDataProvider
    private airspeedProvider?: AirspeedDataProvider
    private navdataStack?: NavdataStack
    private apAnnunciationProvider?: AutopilotAnnunciationProvider
    private gpsSynchronizer?: GpsSteerSynchronizer

    private knobValueSub?: Subscription
    private knobUnitSub?: Subscription

    get templateID(): string {
        return 'AS5'
    }

    private get isMfdInstrument(): boolean {
        return this.instrumentIndex === 2
    }

    private get activePage(): AvionicsPage | null {
        return (this.activePageId.get() === 'PFD' ? this.pfdRef : this.mfdRef).getOrDefault()
    }

    connectedCallback(): void {
        super.connectedCallback()

        this.navSourceProvider = new NavSourceDataProvider(this.bus)
        this.navSourceProvider.resume()
        this.airspeedProvider = new AirspeedDataProvider(this.bus)
        this.airspeedProvider.resume()
        if (!this.isMfdInstrument) {
            this.navdataStack = new NavdataStack(this.bus)
            this.navdataStack.init().catch(e => console.error('NavdataStack init failed', e))
            this.gpsSynchronizer = new GpsSteerSynchronizer(this.bus)
            this.gpsSynchronizer.resume()
        }
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
                manager={this.manager}
                switchPage={this.switchPage}
                pageState={this.activePageId}
                pfdRef={this.pfdRef}
                mfdRef={this.mfdRef}
                autopilot={this.apAnnunciationProvider}
                airspeedData={this.airspeedProvider}
                navData={this.navSourceProvider}
            />,
            this.getChildById('Electricity')
        )

        this.bindKnobTooltip()
    }

    protected Update(): void {
        super.Update()

        this.adcPublisher?.onUpdate()
        this.ahrsPublisher?.onUpdate()
        this.navComPublisher?.onUpdate()
        this.customPublisher?.onUpdate()
        this.navPublisher?.onUpdate()
        this.navdataStack?.onUpdate()
        this.airspeedProvider?.onUpdate(this.deltaTime)
        this.apAnnunciationProvider?.onUpdate()
        if (this.isElectricityAvailable()) {
            this.gpsSynchronizer?.onUpdate()
        }
    }

    protected isElectricityAvailable(): boolean {
        return (
            SimVar.GetSimVarValue(`L:AS5_${this.instrumentIndex}_Power`, SimVarValueType.Bool) !== 0
        )
    }

    onInteractionEvent(args: string[]): void {
        if (!this.isElectricityAvailable()) return

        const event = this.DecomposeEventFromPrefix(args)
        if (event === 'ElementSetAttribute' && args.length >= 4) {
            this.getChildById(args[1])?.setAttribute(args[2], args[3])
        } else if (event) {
            this.dispatch(event)
        } else if (args[0].startsWith('NavSystem_')) {
            this.dispatch(args[0].slice('NavSystem_'.length))
        }
    }

    onPowerOn(): void {
        super.onPowerOn()
        this.setActivePage(this.isMfdInstrument ? 'MFD' : 'PFD')
    }

    private dispatch(event: string): void {
        if (!this.isBootProcedureComplete()) return

        this.apAnnunciationProvider?.onEvent(event)

        const page = this.activePage
        if (!page) return
        page.onEvent(event)

        if (!page.isModalOpen) {
            switch (event) {
                case 'NavigationSmallInc':
                    this.cyclePage(1)
                    break
                case 'NavigationSmallDec':
                    this.cyclePage(-1)
                    break
            }
        }
    }

    private setActivePage(id: PageId): void {
        if (id === this.activePageId.get()) return
        this.activePage?.closeModals()
        this.activePageId.set(id)
    }

    private cyclePage(direction: 1 | -1): void {
        const count = this.pageOrder.length
        const index = this.pageOrder.indexOf(this.activePageId.get())
        this.setActivePage(this.pageOrder[(index + direction + count) % count])
    }

    private bindKnobTooltip(): void {
        this.activePageId.sub(() => {
            const page = this.activePage
            this.knobValueSub?.destroy()
            this.knobUnitSub?.destroy()
            this.knobValueSub = page?.knobValue.sub(v => this.setKnobSimVar('Knob_Value', v), true)
            this.knobUnitSub = page?.knobUnit.sub(u => this.setKnobSimVar('Knob_Unit', u), true)
        }, true)
    }

    private setKnobSimVar(name: string, value: number): void {
        SimVar.SetSimVarValue(
            `L:AS5_${this.instrumentIndex}_${name}`,
            SimVarValueType.Number,
            value
        )
    }
}

registerInstrument('as5-element', AS5)
