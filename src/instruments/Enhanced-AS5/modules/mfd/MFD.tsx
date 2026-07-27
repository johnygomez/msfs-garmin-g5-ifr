import {
    ComponentProps,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    MappedSubscribable,
    MappedSubject,
    Subject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { AvionicsInteractionManager } from '../common/AvionicsInteractionManager'
import { AvionicsPage, KnobValueUnit, PageId } from '../common/AvionicsPage'
import { DropdownOverlay } from '../common/DropdownOverlay'
import { Menu } from '../common/Menu'
import { BEARING_POINTERS, BearingPointerValue } from '../common/Nav'
import { SubmenuOverlay } from '../common/SubmenuOverlay'
import { formatDegrees3 } from '../common/Utils'
import { ValueSelectOverlay } from '../common/ValueSelectOverlay'
import { VerticalDeviationIndicatorComponent } from '../common/VerticalDeviationIndicator'
import { AltimeterSubjects, NavSource } from '../providers/NavSourceDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import { HSIComponent } from './HSIndicator'

const IMAGES = '/Pages/VCockpit/Instruments/NavSystems/AS5/Images'

type MfdOverlay = 'heading' | 'course' | 'setup' | 'bp-1' | 'bp-2'

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

    private readonly mode = this.props.navSource.map(source =>
        source === NavSource.GPS ? NavSource.GPS : 'VOR'
    )

    private readonly distanceText = MappedSubject.create(
        ([source, gpsActive, gpsDistance, nav1HasDme, nav1Dme, nav2HasDme, nav2Dme]) => {
            switch (source) {
                case NavSource.Nav1:
                    return nav1HasDme ? fastToFixed(nav1Dme, 1) : '---'
                case NavSource.Nav2:
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
    manager: AvionicsInteractionManager
    switchPage: (id: PageId) => void
    altimeter: AltimeterSubjects
    navSource: Subscribable<NavSource>
    cdiVisible: Subscribable<boolean>
}

export class MfdContent extends DisplayComponent<MfdContentProps> implements AvionicsPage {
    private readonly menu = FSComponent.createRef<Menu>()
    private readonly setupSubmenu = FSComponent.createRef<SubmenuOverlay>()
    private readonly bp1Selector = FSComponent.createRef<DropdownOverlay<BearingPointerValue>>()
    private readonly bp2Selector = FSComponent.createRef<DropdownOverlay<BearingPointerValue>>()
    private readonly hsi = Subject.create<HSIComponent | null>(null)

    private readonly activeOverlay = Subject.create<MfdOverlay | null>(null)

    readonly knobUnit = Subject.create(KnobValueUnit.Degrees)

    readonly knobValue: MappedSubject<[MfdOverlay | null, number, number], number>
    private readonly headingActive: MappedSubscribable<boolean>
    private readonly courseActive: MappedSubscribable<boolean>
    private readonly setupActive: MappedSubscribable<boolean>
    private readonly bearingPointerSelector1Active: MappedSubscribable<boolean>
    private readonly bearingPointerSelector2Active: MappedSubscribable<boolean>

    private readonly bearingPointer1 = Subject.create<BearingPointerValue>('NONE')
    private readonly bearingPointer2 = Subject.create<BearingPointerValue>('VLOC2')

    constructor(props: MfdContentProps) {
        super(props)

        this.knobValue = MappedSubject.create(
            ([overlay, heading, course]) => (overlay === 'course' ? course : heading),
            this.activeOverlay,
            this.props.manager.selectedHeading,
            this.props.manager.selectedCourse
        ).pause()

        this.headingActive = this.activeOverlay.map(overlay => overlay === 'heading').pause()
        this.courseActive = this.activeOverlay.map(overlay => overlay === 'course').pause()
        this.setupActive = this.activeOverlay.map(overlay => overlay === 'setup').pause()
        this.bearingPointerSelector1Active = this.activeOverlay
            .map(overlay => overlay === 'bp-1')
            .pause()
        this.bearingPointerSelector2Active = this.activeOverlay
            .map(overlay => overlay === 'bp-2')
            .pause()
    }

    onAfterRender(): void {
        this.knobValue.resume()
        this.headingActive.resume()
        this.courseActive.resume()
        this.setupActive.resume()
        this.bearingPointerSelector1Active.resume()
        this.bearingPointerSelector2Active.resume()
    }

    destroy(): void {
        this.knobValue.destroy()
        this.headingActive.destroy()
        this.courseActive.destroy()
        this.setupActive.destroy()
        this.bearingPointerSelector1Active.destroy()
        this.bearingPointerSelector2Active.destroy()
        super.destroy()
    }

    private readonly setHsi = (instance: HSIComponent | null): void => this.hsi.set(instance)
    private readonly closeMenu = (): void => this.menu.instance.close()
    private readonly openHeading = (): void => this.openOverlay('heading')
    private readonly openCourse = (): void => this.openOverlay('course')
    private readonly openPfd = (): void => this.props.switchPage('PFD')
    private readonly openSetup = (): void => this.openOverlay('setup')
    private readonly openBP1 = (): void => this.openOverlay('bp-1')
    private readonly openBP2 = (): void => this.openOverlay('bp-2')
    private readonly closeOverlays = (): void => this.closeModals()
    private readonly onBearing1Selected = (source?: BearingPointerValue) => {
        if (source !== undefined && source !== null) {
            this.bearingPointer1.set(source)
        }
        this.closeModals()
    }
    private readonly onBearing2Selected = (source?: BearingPointerValue) => {
        if (source !== undefined && source !== null) {
            this.bearingPointer2.set(source)
        }
        this.closeModals()
    }

    get isModalOpen(): boolean {
        return (
            this.activeOverlay.get() !== null || (this.menu.getOrDefault()?.isOpen.get() ?? false)
        )
    }

    closeModals(): void {
        this.menu.instance.close()
        this.activeOverlay.set(null)
    }

    onEvent(event: string): void {
        this.hsi.get()?.onEvent(event)

        if (this.activeOverlay.get() !== null) {
            switch (this.activeOverlay.get()) {
                case 'heading':
                case 'course':
                    this.onOverlayEvent(event)
                    break
                case 'setup':
                    this.setupSubmenu.instance.onEvent(event)
                    break
                case 'bp-1':
                    this.bp1Selector.instance.onEvent(event)
                    break
                case 'bp-2':
                    this.bp2Selector.instance.onEvent(event)
                    break
            }
        } else if (this.menu.instance.isOpen.get()) {
            this.menu.instance.onEvent(event)
        } else {
            this.onIdleEvent(event)
        }
    }

    private onIdleEvent(event: string): void {
        const { manager } = this.props
        switch (event) {
            case 'Knob_Inc':
                manager.incrementHeading()
                break
            case 'Knob_Dec':
                manager.decrementHeading()
                break
            case 'Knob_Long_Push':
                manager.syncHeading()
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
                else manager.incrementCourse()
                break
            case 'Knob_Dec':
                if (heading) manager.decrementHeading()
                else manager.decrementCourse()
                break
            case 'Knob_Long_Push':
                if (heading) manager.syncHeading()
                break
            case 'Knob_Push':
                this.activeOverlay.set(null)
                break
        }
    }

    private openOverlay(overlay: MfdOverlay): void {
        this.menu.instance.close()
        this.activeOverlay.set(overlay)
    }

    render(): VNode {
        const { bus, manager, altimeter, navSource, cdiVisible } = this.props

        return (
            <>
                <div id="HSICompass">
                    <HSIComponent
                        bus={bus}
                        activeSource={navSource}
                        bearing1Source={this.bearingPointer1}
                        bearing2Source={this.bearingPointer2}
                        cdiVisible={cdiVisible}
                        noCenterText={false}
                        noBackground={false}
                        noAffectSimRadioNav={false}
                        onApi={this.setHsi}
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

                <Menu ref={this.menu} onLongPush={this.closeOverlays}>
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
                        title="Course"
                        value={manager.courseText}
                        onSelect={this.openCourse}
                        hidden={navSource.map(source => source === NavSource.GPS)}
                    />
                    <Menu.Item title="PFD" icon={`${IMAGES}/PFD.png`} onSelect={this.openPfd} />
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
                    title="Select Course"
                    value={manager.courseText}
                    active={this.courseActive}
                />

                <SubmenuOverlay
                    title="Setup"
                    active={this.setupActive}
                    ref={this.setupSubmenu}
                    onLongPush={this.closeOverlays}
                >
                    <SubmenuOverlay.item
                        title="Bearing Pointer 1"
                        onSelect={this.openBP1}
                        value={this.bearingPointer1}
                    />
                    <SubmenuOverlay.item
                        title="Bearing Pointer 2"
                        onSelect={this.openBP2}
                        value={this.bearingPointer2}
                    />
                </SubmenuOverlay>

                <DropdownOverlay
                    ref={this.bp1Selector}
                    title="Bearing Pointer 1"
                    selected={this.bearingPointer1}
                    options={BEARING_POINTERS}
                    active={this.bearingPointerSelector1Active}
                    onSelected={this.onBearing1Selected}
                    onLongPush={this.closeOverlays}
                />

                <DropdownOverlay
                    ref={this.bp2Selector}
                    title="Bearing Pointer 2"
                    selected={this.bearingPointer2}
                    options={BEARING_POINTERS}
                    active={this.bearingPointerSelector2Active}
                    onSelected={this.onBearing2Selected}
                    onLongPush={this.closeOverlays}
                />
            </>
        )
    }
}
