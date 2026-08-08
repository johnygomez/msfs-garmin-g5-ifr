import {
    AhrsEvents,
    ComponentProps,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    MappedSubject,
    Subject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { AvionicsInteractionManager } from '../common/AvionicsInteractionManager'
import { AvionicsPage, KnobValueUnit, PageId } from '../common/AvionicsPage'
import { DropdownOverlay } from '../common/DropdownOverlay'
import { Menu } from '../common/Menu'
import { SubmenuOverlay } from '../common/SubmenuOverlay'
import { BARO_UNITS, BaroUnit } from '../common/Utils'
import { ValueSelectOverlay } from '../common/ValueSelectOverlay'
import { VerticalDeviationIndicatorComponent } from '../common/VerticalDeviationIndicator'
import { AirspeedSubjects } from '../providers/AirspeedDataProvider'
import { AltimeterSubjects, CDISubjects, CourseGuidance } from '../providers/NavSourceDataProvider'
import { AirspeedIndicatorComponent } from './AirspeedIndicator'
import { AltimeterComponent } from './Altimeter'
import { APInfoBarComponent, APInfoBarSubjects } from './APInfoBar'
import { AttitudeIndicatorComponent } from './AttitudeIndicator'
import { CDIComponent } from './CDI'
import { HorizontalCompassComponent } from './HorizontalCompass'
import { SlipSkidIndicatorComponent, TurnRateIndicatorComponent } from './TurnSlipIndicator'

const IMAGES = '/Pages/VCockpit/Instruments/NavSystems/AS5/Images'

type PfdOverlay = 'heading' | 'altitude' | 'setup' | 'baro'

export interface PfdContentProps extends ComponentProps {
    bus: EventBus
    manager: AvionicsInteractionManager
    switchPage: (id: PageId) => void
    autopilot: APInfoBarSubjects
    airspeed: AirspeedSubjects
    altimeter: AltimeterSubjects
    cdi: CDISubjects
    currentNavCourse: Subscribable<CourseGuidance>
}

export class PfdContent extends DisplayComponent<PfdContentProps> implements AvionicsPage {
    private readonly menu = FSComponent.createRef<Menu>()
    private readonly setupSubmenu = FSComponent.createRef<SubmenuOverlay>()
    private readonly baroSelector = FSComponent.createRef<DropdownOverlay<BaroUnit>>()

    private readonly activeOverlay = Subject.create<PfdOverlay | null>(null)

    readonly knobUnit = this.activeOverlay.map(overlay => {
        if (overlay === 'heading') return KnobValueUnit.Degrees
        if (overlay === 'altitude') return KnobValueUnit.Feet
        return KnobValueUnit.InHg
    })

    readonly knobValue = MappedSubject.create(
        ([overlay, heading, altitude, baro]) => {
            if (overlay === 'heading') return heading
            if (overlay === 'altitude') return altitude
            return baro
        },
        this.activeOverlay,
        this.props.manager.selectedHeading,
        this.props.manager.selectedAltitude,
        this.props.manager.baroInHg
    )

    private readonly headingActive = this.activeOverlay.map(overlay => overlay === 'heading')
    private readonly altitudeActive = this.activeOverlay.map(overlay => overlay === 'altitude')
    private readonly setupActive = this.activeOverlay.map(overlay => overlay === 'setup')
    private readonly baroSelectorActive = this.activeOverlay.map(overlay => overlay === 'baro')

    private readonly closeMenu = (): void => this.menu.instance.close()
    private readonly openHeading = (): void => this.openOverlay('heading')
    private readonly openAltitude = (): void => this.openOverlay('altitude')
    private readonly openSetup = (): void => this.openOverlay('setup')
    private readonly openMfd = (): void => this.props.switchPage('MFD')
    private readonly openBaro = (): void => this.openOverlay('baro')
    private readonly closeOverlays = (): void => this.closeModals()
    private readonly onBaroSelected = (unit?: BaroUnit) => {
        if (unit !== undefined && unit !== null) {
            this.props.manager.changeBaroUnits(unit)
        }
        this.closeModals()
    }

    private readonly apBarState = this.props.autopilot.hasAnnunciation.map(annunciating =>
        annunciating ? 'Active' : 'Inactive'
    )

    private readonly turnRate: ConsumerSubject<number>
    private readonly slipSkid: ConsumerSubject<number>

    constructor(props: PfdContentProps) {
        super(props)
        const ahrs = props.bus.getSubscriber<AhrsEvents>()
        this.turnRate = ConsumerSubject.create(
            ahrs.on('delta_heading_rate').withPrecision(2),
            0
        ).pause()
        this.slipSkid = ConsumerSubject.create(
            ahrs.on('turn_coordinator_ball').withPrecision(2),
            0
        ).pause()
    }

    onAfterRender(): void {
        this.turnRate.resume()
        this.slipSkid.resume()
    }

    destroy(): void {
        this.turnRate.destroy()
        this.slipSkid.destroy()
        super.destroy()
    }

    get isModalOpen(): boolean {
        return (
            this.activeOverlay.get() !== null || (this.menu.getOrDefault()?.isOpen.get() ?? false)
        )
    }

    onEvent(event: string): void {
        this.onHardwareEvent(event)

        if (this.activeOverlay.get() !== null) {
            switch (this.activeOverlay.get()) {
                case 'heading':
                case 'altitude':
                    this.onOverlayEvent(event)
                    break
                case 'setup':
                    this.setupSubmenu.instance.onEvent(event)
                    break
                case 'baro':
                    this.baroSelector.instance.onEvent(event)
                    break
            }
        } else if (this.menu.instance.isOpen.get()) {
            this.menu.instance.onEvent(event)
        } else {
            this.onIdleEvent(event)
        }
    }

    closeModals(): void {
        this.menu.instance.close()
        this.activeOverlay.set(null)
    }

    private onHardwareEvent(event: string): void {
        const { manager } = this.props
        if (event === 'BARO_INC') manager.increaseBaro()
        else if (event === 'BARO_DEC') manager.decreaseBaro()
    }

    private onIdleEvent(event: string): void {
        const { manager } = this.props
        switch (event) {
            case 'Knob_Inc':
                manager.increaseBaro()
                break
            case 'Knob_Dec':
                manager.decreaseBaro()
                break
            case 'Knob_Push':
            case 'MENU_Push':
                this.menu.instance.open()
                break
        }
    }

    private onOverlayEvent(event: string): void {
        const { manager } = this.props
        switch (event) {
            case 'Knob_Inc':
                if (this.headingActive.get()) manager.incrementHeading()
                else if (this.altitudeActive.get()) manager.incrementAltitude()
                break
            case 'Knob_Dec':
                if (this.headingActive.get()) manager.decrementHeading()
                else if (this.altitudeActive.get()) manager.decrementAltitude()
                break
            case 'Knob_Long_Push':
                if (this.headingActive.get()) manager.syncHeading()
                else if (this.altitudeActive.get()) manager.syncAltitude()
                break
            case 'Knob_Push':
                this.activeOverlay.set(null)
                break
        }
    }

    private openOverlay(overlay: PfdOverlay): void {
        this.menu.instance.close()
        this.activeOverlay.set(overlay)
    }

    render(): VNode {
        const { bus, manager, autopilot, airspeed, altimeter, cdi, currentNavCourse } = this.props
        return (
            <>
                <div id="PfdWrapper">
                    <div id="AP" state={this.apBarState}>
                        <APInfoBarComponent {...autopilot} />
                    </div>
                    <div id="PfdMain">
                        <div id="Horizon">
                            <AttitudeIndicatorComponent tas={airspeed.trueAirspeed} bus={bus} />
                        </div>
                        <div id="Altimeter">
                            <AltimeterComponent
                                bus={bus}
                                height={1020}
                                baroUnit={manager.baroUnit}
                            />
                        </div>
                        <div id="VerticalDeviation">
                            <VerticalDeviationIndicatorComponent
                                mode={altimeter.verticalDeviationMode}
                                deviation={altimeter.verticalDeviationValue}
                            />
                        </div>
                        <div id="Airspeed">
                            <AirspeedIndicatorComponent
                                bus={bus}
                                height={1020}
                                noColor={false}
                                indicatedAirspeed={airspeed.indicatedAirspeed}
                                refSpeed={airspeed.refSpeed}
                                airspeedTrend={airspeed.airspeedTrend}
                            />
                        </div>
                        <div id="Compass">
                            <HorizontalCompassComponent
                                bus={bus}
                                truncateLeft={50}
                                truncateRight={78}
                                spacing={50}
                                groundTrackActive={true}
                                currentNavCourse={currentNavCourse}
                            />
                        </div>
                        <div id="CDI">
                            <CDIComponent
                                cdiSource={cdi.cdiSource}
                                cdiDeviation={cdi.cdiDeviation}
                                isVisible={cdi.cdiVisible}
                            />
                        </div>
                        <div id="BottomIndicators">
                            <SlipSkidIndicatorComponent slipSkid={this.slipSkid} />
                            <TurnRateIndicatorComponent turnRate={this.turnRate} />
                        </div>
                    </div>
                </div>

                <Menu ref={this.menu}>
                    <Menu.Item
                        title="Back"
                        icon={`${IMAGES}/BACK_ARROW.png`}
                        onSelect={this.closeMenu}
                    />
                    <Menu.Item
                        title="Heading"
                        value={manager.headingText}
                        onSelect={this.openHeading}
                    />
                    <Menu.Item
                        title="Altitude"
                        value={manager.altitudeText}
                        onSelect={this.openAltitude}
                    />
                    <Menu.Item title="MFD" icon={`${IMAGES}/MFD.png`} onSelect={this.openMfd} />
                    <Menu.Item
                        title="Setup"
                        icon={`${IMAGES}/SETUP.png`}
                        onSelect={this.openSetup}
                    />
                </Menu>

                <ValueSelectOverlay
                    title="Select Heading"
                    value={manager.headingText}
                    active={this.headingActive}
                />
                <ValueSelectOverlay
                    title="Select Altitude"
                    value={manager.altitudeText}
                    active={this.altitudeActive}
                />

                <SubmenuOverlay
                    title="Setup"
                    active={this.setupActive}
                    ref={this.setupSubmenu}
                    onLongPush={this.closeOverlays}
                    style="height: 35%;"
                >
                    <SubmenuOverlay.item
                        title="Baro Units"
                        onSelect={this.openBaro}
                        value={manager.baroUnit}
                    />
                </SubmenuOverlay>

                <DropdownOverlay
                    ref={this.baroSelector}
                    title="Baro Units"
                    selected={manager.baroUnit}
                    options={BARO_UNITS}
                    active={this.baroSelectorActive}
                    onSelected={this.onBaroSelected}
                    onLongPush={this.closeOverlays}
                />
            </>
        )
    }
}
