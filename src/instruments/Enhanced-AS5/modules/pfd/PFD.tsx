import {
    AhrsEvents,
    ComponentProps,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    MappedSubject,
    Subject,
    VNode,
} from '@microsoft/msfs-sdk'

import { AvionicsInteractionManager } from '../common/AvionicsInteractionManager'
import { AvionicsPage, KnobValueUnit, PageId } from '../common/AvionicsPage'
import { Menu } from '../common/Menu'
import { ValueSelectOverlay } from '../common/ValueSelectOverlay'
import { VerticalDeviationIndicatorComponent } from '../common/VerticalDeviationIndicator'
import { AirspeedSubjects } from '../providers/AirspeedDataProvider'
import { AltimeterSubjects, CDISubjects } from '../providers/NavSourceDataProvider'
import { AirspeedIndicatorComponent } from './AirspeedIndicator'
import { AltimeterComponent } from './Altimeter'
import { APInfoBarComponent, APInfoBarSubjects } from './APInfoBar'
import { AttitudeIndicatorComponent } from './AttitudeIndicator'
import { CDIComponent } from './CDI'
import { HorizontalCompassComponent } from './HorizontalCompass'
import { SlipSkidIndicatorComponent, TurnRateIndicatorComponent } from './TurnSlipIndicator'

const IMAGES = '/Pages/VCockpit/Instruments/NavSystems/AS5/Images'

type PfdOverlay = 'heading' | 'altitude'

export interface PfdContentProps extends ComponentProps {
    bus: EventBus
    manager: AvionicsInteractionManager
    switchPage: (id: PageId) => void
    autopilot: APInfoBarSubjects
    airspeed: AirspeedSubjects
    altimeter: AltimeterSubjects
    cdi: CDISubjects
}

export class PfdContent extends DisplayComponent<PfdContentProps> implements AvionicsPage {
    private readonly menu = FSComponent.createRef<Menu>()

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
    private readonly pitchValue = Subject.create('-----°')

    private readonly closeMenu = (): void => this.menu.instance.close()
    private readonly openHeading = (): void => this.openOverlay('heading')
    private readonly openAltitude = (): void => this.openOverlay('altitude')
    private readonly openMfd = (): void => this.props.switchPage('MFD')

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
            this.onOverlayEvent(event)
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
        const heading = this.activeOverlay.get() === 'heading'
        switch (event) {
            case 'Knob_Inc':
                if (heading) manager.incrementHeading()
                else manager.incrementAltitude()
                break
            case 'Knob_Dec':
                if (heading) manager.decrementHeading()
                else manager.decrementAltitude()
                break
            case 'Knob_Long_Push':
                if (heading) manager.syncHeading()
                else manager.syncAltitude()
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
        const { bus, manager, autopilot, airspeed, altimeter, cdi } = this.props
        return (
            <>
                <div id="AP">
                    <APInfoBarComponent {...autopilot} />
                </div>
                <div id="Horizon">
                    <AttitudeIndicatorComponent tas={airspeed.trueAirspeed} bus={bus} />
                </div>
                <div id="Altimeter">
                    <AltimeterComponent bus={bus} height={1020} />
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
                    <Menu.Item title="Pitch" value={this.pitchValue} inactive />
                    <Menu.Item title="MFD" icon={`${IMAGES}/MFD.png`} onSelect={this.openMfd} />
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
            </>
        )
    }
}
