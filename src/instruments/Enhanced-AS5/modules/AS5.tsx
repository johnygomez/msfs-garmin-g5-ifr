import {
    AdcPublisher,
    AhrsPublisher,
    ComponentProps,
    DisplayComponent,
    ElectricalPublisher,
    EventBus,
    FSComponent,
    NavComSimVarPublisher,
    NodeReference,
    Subject,
    Subscribable,
    UserSettingSaveManager,
    VNode,
} from '@microsoft/msfs-sdk'

import { G5AutopilotProvider } from './autopilot/G5AutopilotProvider'
import { AvionicsInteractionManager } from './common/AvionicsInteractionManager'
import { AvionicsPage, PageId } from './common/AvionicsPage'
import { BacklightDialog } from './common/BacklightDialog'
import { BootScreen } from './common/BootScreen'
import { CountdownDialog } from './common/CountdownDialog'
import { createG5Settings, G5Settings, loadAndAutoSaveG5Settings } from './common/G5Settings'
import { MfdContent } from './mfd/MFD'
import { PfdContent } from './pfd/PFD'
import { AirspeedDataProvider } from './providers/AirspeedDataProvider'
import { G5Backlight } from './providers/G5Backlight'
import { G5PowerSwitch } from './providers/G5PowerSwitch'
import { G5StartupSystem, StartupPhase } from './providers/G5StartupSystem'
import { GpsSteerSynchronizer } from './providers/GpsSteerSynchronizer'
import { NavdataStack } from './providers/NavdataStack'
import { NavSourceDataProvider } from './providers/NavSourceDataProvider'
import { G5CustomPublisher } from './publishers/G5CustomPublisher'
import { G5ModelVarWriter } from './publishers/G5ModelVarWriter'
import { G5NavPublisher } from './publishers/G5NavPublisher'

interface AS5InstrumentProps extends ComponentProps {
    bus: EventBus
    manager: AvionicsInteractionManager
    settings: G5Settings
    switchPage: (id: PageId) => void
    pageState: Subscribable<string>
    startupPhase: Subscribable<StartupPhase>
    powerOffCountdown: Subscribable<number | null>
    shutdownCountdown: Subscribable<number | null>
    backlight: G5Backlight
    pfdRef: NodeReference<PfdContent>
    mfdRef: NodeReference<MfdContent>
    autopilot: G5AutopilotProvider
    airspeedData: AirspeedDataProvider
    navData: NavSourceDataProvider
}

class AS5Instrument extends DisplayComponent<AS5InstrumentProps> {
    render(): VNode {
        const {
            bus,
            manager,
            settings,
            switchPage,
            pageState,
            startupPhase,
            powerOffCountdown,
            shutdownCountdown,
            backlight,
            pfdRef,
            mfdRef,
            autopilot,
            airspeedData,
            navData,
        } = this.props
        return (
            <>
                <div id="PageContainer" state={pageState}>
                    <div id="PFD">
                        <PfdContent
                            ref={pfdRef}
                            bus={bus}
                            manager={manager}
                            settings={settings}
                            switchPage={switchPage}
                            startupPhase={startupPhase}
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
                            settings={settings}
                            switchPage={switchPage}
                            altimeter={navData.altimeterSubjects}
                            navSource={navData.activeSource}
                            navSourceLabel={navData.navSourceLabel}
                            selectedCourse={navData.selectedCourse}
                            currentNavCourse={navData.currentNavCourse}
                            cdi={navData.cdiSubjects}
                        />
                    </div>
                </div>
                <BacklightDialog
                    isOpen={backlight.isPageOpen}
                    isManual={backlight.isManual}
                    level={backlight.level}
                />
                <CountdownDialog
                    id="PowerOffDialog"
                    title="Power Off"
                    hint="Hold To Power Off"
                    countdown={powerOffCountdown}
                />
                <CountdownDialog
                    id="ShutdownDialog"
                    title="External Power Lost"
                    prompt="Shutting down in:"
                    hint="Press any key to continue on battery power"
                    countdown={shutdownCountdown}
                />
                <BootScreen phase={startupPhase} />
            </>
        )
    }
}

export class AS5 extends BaseInstrument {
    DecomposeEventFromPrefix!: (args: string[]) => string | undefined

    readonly bus = new EventBus()
    private readonly settings = createG5Settings(this.bus)
    private readonly manager = new AvionicsInteractionManager(this.bus, this.settings)

    private readonly pfdRef = FSComponent.createRef<PfdContent>()
    private readonly mfdRef = FSComponent.createRef<MfdContent>()
    private readonly pageOrder: PageId[] = ['PFD', 'MFD']
    private readonly activePageId = Subject.create<PageId>('PFD')

    private readonly switchPage = (id: PageId): void => this.setActivePage(id)

    private adcPublisher?: AdcPublisher
    private ahrsPublisher?: AhrsPublisher
    private navComPublisher?: NavComSimVarPublisher
    private electricalPublisher?: ElectricalPublisher
    private customPublisher?: G5CustomPublisher
    private navPublisher?: G5NavPublisher
    private navSourceProvider?: NavSourceDataProvider
    private airspeedProvider?: AirspeedDataProvider
    private navdataStack?: NavdataStack
    private apAnnunciationProvider?: G5AutopilotProvider
    private gpsSynchronizer?: GpsSteerSynchronizer
    private powerSwitch?: G5PowerSwitch
    private backlight?: G5Backlight
    private startupSystem?: G5StartupSystem
    private modelVarWriter?: G5ModelVarWriter

    private settingsSaveManager?: UserSettingSaveManager

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
        this.apAnnunciationProvider = new G5AutopilotProvider(this.bus)
        this.apAnnunciationProvider.resume()

        this.adcPublisher = new AdcPublisher(this.bus)
        this.ahrsPublisher = new AhrsPublisher(this.bus)
        this.navComPublisher = new NavComSimVarPublisher(this.bus)
        this.electricalPublisher = new ElectricalPublisher(this.bus)
        this.customPublisher = new G5CustomPublisher(this.bus)
        this.navPublisher = new G5NavPublisher(this.bus)

        this.adcPublisher.startPublish()
        this.ahrsPublisher.startPublish()
        this.navComPublisher.startPublish()
        this.electricalPublisher.startPublish()
        this.customPublisher.startPublish()
        this.navPublisher.startPublish()

        this.powerSwitch = new G5PowerSwitch(this.bus)
        const backlight = new G5Backlight(this.bus, this.instrumentIndex, this.powerSwitch.isOn)
        this.powerSwitch.shortPressed.on(() => backlight.pressPowerButton())
        this.backlight = backlight
        this.modelVarWriter = new G5ModelVarWriter(
            this.instrumentIndex,
            this.powerSwitch.isOn,
            backlight
        )
        this.startupSystem = new G5StartupSystem(
            this.instrumentIndex,
            this.bus,
            this.powerSwitch.isOn
        )

        FSComponent.render(
            <AS5Instrument
                bus={this.bus}
                manager={this.manager}
                settings={this.settings}
                switchPage={this.switchPage}
                pageState={this.activePageId}
                startupPhase={this.startupSystem.phase}
                powerOffCountdown={this.powerSwitch.powerOffCountdown}
                shutdownCountdown={this.powerSwitch.shutdownCountdown}
                backlight={backlight}
                pfdRef={this.pfdRef}
                mfdRef={this.mfdRef}
                autopilot={this.apAnnunciationProvider}
                airspeedData={this.airspeedProvider}
                navData={this.navSourceProvider}
            />,
            this.getChildById('Electricity')
        )

        this.activePageId.sub(() => this.modelVarWriter?.showKnobTooltipOf(this.activePage), true)
    }

    protected Update(): void {
        super.Update()

        this.adcPublisher?.onUpdate()
        this.ahrsPublisher?.onUpdate()
        this.navComPublisher?.onUpdate()
        this.electricalPublisher?.onUpdate()
        this.customPublisher?.onUpdate()
        this.navPublisher?.onUpdate()
        this.startupSystem?.onUpdate()
        this.navdataStack?.onUpdate()
        this.airspeedProvider?.onUpdate(this.deltaTime)
        if (this.isElectricityAvailable()) {
            this.gpsSynchronizer?.onUpdate()
        }
    }

    protected isElectricityAvailable(): boolean {
        return this.powerSwitch?.isOn.get() ?? false
    }

    onInteractionEvent(args: string[]): void {
        const event = this.DecomposeEventFromPrefix(args)
        if (this.handlePowerEvent(event) || !this.isElectricityAvailable()) return

        if (event === 'ElementSetAttribute' && args.length >= 4) {
            this.getChildById(args[1])?.setAttribute(args[2], args[3])
        } else if (event) {
            this.dispatch(event)
        } else if (args[0].startsWith('NavSystem_')) {
            this.dispatch(args[0].slice('NavSystem_'.length))
        }
    }

    protected onFlightStart(): void {
        super.onFlightStart()
        this.settingsSaveManager?.destroy()
        this.settingsSaveManager = loadAndAutoSaveG5Settings(this.settings)
    }

    onPowerOn(): void {
        super.onPowerOn()
        this.setActivePage(this.isMfdInstrument ? 'MFD' : 'PFD')
    }

    private handlePowerEvent(event: string | undefined): boolean {
        switch (event) {
            case 'Power_Push':
                this.powerSwitch?.press()
                return true
            case 'Power_Release':
                this.powerSwitch?.release()
                return true
        }
        return false
    }

    private dispatch(event: string): void {
        if (this.powerSwitch?.continueOnBattery()) return
        if (!this.isBootProcedureComplete() || this.startupSystem?.isBooting) return
        if (this.backlight?.handleKnobEvent(event)) return

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
}

registerInstrument('as5-element', AS5)
