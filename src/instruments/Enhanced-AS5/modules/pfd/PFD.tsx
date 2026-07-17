import {
    AhrsEvents,
    ComponentProps,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    Subject,
    VNode,
} from '@microsoft/msfs-sdk'

import type { AS5 } from '../AS5'

import { ContextualMenuElementData } from '../common/ContextualMenu'
import { NavSystemElementGroup, NavSystemPage } from '../common/NavSystem'
import { VerticalDeviationIndicatorComponent } from '../common/VerticalDeviationIndicator'
import { AirspeedSubjects } from '../providers/AirspeedDataProvider'
import { CDISubjects } from '../providers/NavSourceDataProvider'
import { AirspeedIndicatorComponent } from './AirspeedIndicator'
import { AltimeterComponent } from './Altimeter'
import { AltimeterSubjects, PFD_Altimeter, PFD_Attitude } from './AltimeterKnob'
import { APInfoBarComponent, APInfoBarSubjects } from './APInfoBar'
import { AttitudeIndicatorComponent } from './AttitudeIndicator'
import { CDIComponent } from './CDI'
import { HorizontalCompassComponent } from './HorizontalCompass'
import { SlipSkidIndicatorComponent, TurnRateIndicatorComponent } from './TurnSlipIndicator'

export interface PfdContentProps extends ComponentProps {
    bus: EventBus
    autopilot: APInfoBarSubjects
    airspeed: AirspeedSubjects
    altimeter: AltimeterSubjects
    cdi: CDISubjects
}

export class PfdContent extends DisplayComponent<PfdContentProps> {
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

    render(): VNode {
        const { bus, autopilot, airspeed, altimeter, cdi } = this.props
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
            </>
        )
    }
}

export class AS5_PFD extends NavSystemPage {
    declare gps: AS5

    constructor() {
        super('PFD', 'PFD', null)
        this.element = new NavSystemElementGroup([new PFD_Attitude(), new PFD_Altimeter()])
    }

    init(): void {
        super.init()
        this.defaultMenu = this.buildDefaultMenu()
    }

    private buildDefaultMenu(): ContextualMenuElementData[] {
        const gps = this.gps
        return [
            {
                name: 'Back',
                callback: gps.SwitchToInteractionState.bind(gps, 0),
                isInactive: () => false,
                imageSrc: '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png',
            },
            {
                name: 'Heading',
                callback: gps.menuHeadingEnter.bind(gps),
                isInactive: () => false,
                value: gps.menuHeadingTextSub,
            },
            {
                name: 'Altitude',
                callback: gps.menuAltitudeEnter.bind(gps),
                isInactive: () => false,
                value: gps.menuAltitudeTextSub,
            },
            {
                name: 'Pitch',
                callback: () => false,
                isInactive: () => true,
                value: Subject.create('-----°'),
            },
            {
                name: 'MFD',
                callback: gps.SwitchToPageName.bind(gps, 'Main', 'MFD'),
                isInactive: () => false,
                imageSrc: '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/MFD.png',
            },
        ]
    }
}
