import {
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

import type { AS5 } from '../AS5'

import { ContextualMenuElementData } from '../common/ContextualMenu'
import { NavSystemElement, NavSystemElementGroup, NavSystemPage } from '../common/NavSystem'
import { formatDegrees3 } from '../common/Utils'
import { VerticalDeviationIndicatorComponent } from '../common/VerticalDeviationIndicator'
import { AltimeterSubjects } from '../pfd/AltimeterKnob'
import { NavSource } from '../providers/NavSourceDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import { HSIComponent } from './HSIndicator'

interface SelectedHeadingInfoProps extends ComponentProps {
    bus: EventBus
}

class SelectedHeadingInfo extends DisplayComponent<SelectedHeadingInfoProps> {
    private readonly heading = ConsumerSubject.create(
        this.props.bus.getSubscriber<G5CustomEvents>().on('ap_heading_selected'),
        0
    ).pause()

    private readonly headingText = this.heading.map(formatDegrees3)

    onAfterRender(): void {
        this.heading.resume()
    }

    destroy(): void {
        this.headingText.destroy()
        this.heading.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="SelectedHeading">
                <svg id="SelectedHeadingSymbol" viewBox="0 0 50 100">
                    <path d="M0,0 h50 v30 l-30,20 l30,20 v30 h-50 Z" fill="aqua" />
                </svg>
                <div id="SelectedHeadingValue">{this.headingText}</div>
            </div>
        )
    }
}

interface GroundSpeedInfoProps extends ComponentProps {
    bus: EventBus
}

class GroundSpeedInfo extends DisplayComponent<GroundSpeedInfoProps> {
    private readonly groundSpeed = ConsumerSubject.create(
        this.props.bus.getSubscriber<G5CustomEvents>().on('ground_speed'),
        0
    ).pause()

    private readonly groundSpeedText = this.groundSpeed.map(speed => fastToFixed(speed, 0))

    onAfterRender(): void {
        this.groundSpeed.resume()
    }

    destroy(): void {
        this.groundSpeedText.destroy()
        this.groundSpeed.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="GroundSpeed">
                <div>GS KT</div>
                <div id="GroundSpeedValue">{this.groundSpeedText}</div>
            </div>
        )
    }
}

interface WaypointDistanceInfoProps extends ComponentProps {
    bus: EventBus
    navSource: Subscribable<NavSource>
}

class WaypointDistanceInfo extends DisplayComponent<WaypointDistanceInfoProps> {
    private readonly nav = this.props.bus.getSubscriber<G5NavEvents>()

    private readonly gpsActiveWaypoint = ConsumerSubject.create(
        this.nav.on('gps_active_waypoint'),
        false
    ).pause()
    private readonly gpsDistance = ConsumerSubject.create(this.nav.on('gps_wp_distance'), 0).pause()
    private readonly nav1HasDme = ConsumerSubject.create(this.nav.on('nav1_has_dme'), false).pause()
    private readonly nav1Dme = ConsumerSubject.create(this.nav.on('nav1_dme'), 0).pause()
    private readonly nav2HasDme = ConsumerSubject.create(this.nav.on('nav2_has_dme'), false).pause()
    private readonly nav2Dme = ConsumerSubject.create(this.nav.on('nav2_dme'), 0).pause()

    private readonly mode = this.props.navSource.map(source => (source === 'GPS' ? 'GPS' : 'VOR'))

    private readonly distanceText = MappedSubject.create(
        ([source, gpsActive, gpsDistance, nav1HasDme, nav1Dme, nav2HasDme, nav2Dme]) => {
            switch (source) {
                case 'NAV1':
                    return nav1HasDme ? fastToFixed(nav1Dme, 1) : '---'
                case 'NAV2':
                    return nav2HasDme ? fastToFixed(nav2Dme, 1) : '---'
                default:
                    return gpsActive ? fastToFixed(gpsDistance, 1) : '---'
            }
        },
        this.props.navSource,
        this.gpsActiveWaypoint,
        this.gpsDistance,
        this.nav1HasDme,
        this.nav1Dme,
        this.nav2HasDme,
        this.nav2Dme
    )

    onAfterRender(): void {
        this.gpsActiveWaypoint.resume()
        this.gpsDistance.resume()
        this.nav1HasDme.resume()
        this.nav1Dme.resume()
        this.nav2HasDme.resume()
        this.nav2Dme.resume()
    }

    destroy(): void {
        this.distanceText.destroy()
        this.mode.destroy()
        this.gpsActiveWaypoint.destroy()
        this.gpsDistance.destroy()
        this.nav1HasDme.destroy()
        this.nav1Dme.destroy()
        this.nav2HasDme.destroy()
        this.nav2Dme.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="WaypointDistance">
                <div>DIST NM</div>
                <div id="WaypointDistanceValue" mode={this.mode}>
                    {this.distanceText}
                </div>
            </div>
        )
    }
}

export interface MfdContentProps extends ComponentProps {
    bus: EventBus
    altimeter: AltimeterSubjects
    navSource: Subscribable<NavSource>
    hsiComponent: Subject<HSIComponent | null>
}

export class MfdContent extends DisplayComponent<MfdContentProps> {
    render(): VNode {
        const { bus, altimeter, navSource, hsiComponent } = this.props
        return (
            <>
                <div id="HSICompass">
                    <HSIComponent
                        bus={bus}
                        noCenterText={false}
                        noBackground={false}
                        noAffectSimRadioNav={false}
                        onApi={instance => hsiComponent.set(instance)}
                    />
                </div>
                <div id="Infos">
                    <SelectedHeadingInfo bus={bus} />
                    <GroundSpeedInfo bus={bus} />
                    <WaypointDistanceInfo bus={bus} navSource={navSource} />
                </div>
                <div id="VerticalDeviation">
                    <VerticalDeviationIndicatorComponent
                        mode={altimeter.verticalDeviationMode}
                        deviation={altimeter.verticalDeviationValue}
                    />
                </div>
            </>
        )
    }
}

export class AS5_MFD_HSI extends NavSystemElement {
    readonly hsiComponentSub = Subject.create<HSIComponent | null>(null)

    init(_root: HTMLElement): void {}
    onEnter(): void {}
    onExit(): void {}
    onUpdate(_deltaTime: number): void {}

    onEvent(_event: string): void {
        this.hsiComponentSub.get()?.onEvent(_event)
    }
}

export class AS5_MFD extends NavSystemPage {
    declare gps: AS5

    readonly hsi = new AS5_MFD_HSI()

    constructor() {
        super('MFD', 'MFD', null)
        this.element = new NavSystemElementGroup([this.hsi])
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
                name: 'Course',
                callback: gps.menuCrsEnter.bind(gps),
                isInactive: () => false,
                value: gps.menuCourseTextSub,
            },
            {
                name: 'PFD',
                callback: gps.SwitchToPageName.bind(gps, 'Main', 'PFD'),
                isInactive: () => false,
                imageSrc: '/Pages/VCockpit/Instruments/NavSystems/AS5/Images/PFD.png',
            },
        ]
    }
}
