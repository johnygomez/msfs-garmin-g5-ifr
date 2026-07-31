import {
    ComponentProps,
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
import { BEARING_POINTERS, BearingPointerValue, NavSource, NavSourceLabel } from '../common/Nav'
import { ReactiveComponent } from '../common/Reactive'
import { SubmenuOverlay } from '../common/SubmenuOverlay'
import { Colors } from '../common/Utils'
import { ValueSelectOverlay } from '../common/ValueSelectOverlay'
import { VerticalDeviationIndicatorComponent } from '../common/VerticalDeviationIndicator'
import { BearingPointerDataProvider } from '../providers/BearingPointerDataProvider'
import { AltimeterSubjects } from '../providers/NavSourceDataProvider'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import { HSIComponent } from './HSIndicator'
import { LeftInfoPanel } from './LeftInfoPanel'
import { RightInfoPanel } from './RightInfoPanel'

const IMAGES = '/Pages/VCockpit/Instruments/NavSystems/AS5/Images'

type MfdOverlay = 'heading' | 'course' | 'obs' | 'setup' | 'bp-1' | 'bp-2'

interface WaypointDistanceInfoProps extends ComponentProps {
    bus: EventBus
    navSource: Subscribable<NavSource>
}

class WaypointDistanceInfo extends ReactiveComponent<WaypointDistanceInfoProps> {
    private readonly nav = this.props.bus.getSubscriber<G5NavEvents>()

    private readonly gpsActiveWaypoint = this.consume(this.nav.on('gps_active_waypoint'), false)
    private readonly gpsDistance = this.consume(this.nav.on('gps_wp_distance'), 0)
    private readonly nav1HasDme = this.consume(this.nav.on('nav1_has_dme'), false)
    private readonly nav1Dme = this.consume(this.nav.on('nav1_dme'), 0)
    private readonly nav2HasDme = this.consume(this.nav.on('nav2_has_dme'), false)
    private readonly nav2Dme = this.consume(this.nav.on('nav2_dme'), 0)

    private readonly mode = this.track(
        this.props.navSource.map(source => (source === NavSource.GPS ? NavSource.GPS : 'VOR'))
    )

    private readonly distanceText = this.track(
        MappedSubject.create(
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
    )

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

interface GPSSIndicatorProps extends ComponentProps {
    gpssEnabled: Subscribable<boolean>
}

class GPSSIndicator extends ReactiveComponent<GPSSIndicatorProps> {
    private readonly state = this.track(
        this.props.gpssEnabled.map(enabled => (enabled ? 'Active' : 'Inactive'))
    )

    render(): VNode {
        return (
            <div id="GPSSIndicator" state={this.state}>
                <svg id="GPSSIndicatorIcon" viewBox="-10 0 20 6">
                    <polygon points="0,3 2,1 7,1 6,5 -6,5 -7,1 -2,1" fill={Colors.CYAN} />
                    <line x1="-9" y1="0" x2="9" y2="6" stroke={Colors.BLACK} stroke-width="1.5" />
                    <line x1="-9" y1="0" x2="9" y2="6" stroke={Colors.WHITE} stroke-width="1" />
                    <line x1="-9" y1="6" x2="9" y2="0" stroke={Colors.BLACK} stroke-width="1.5" />
                    <line x1="-9" y1="6" x2="9" y2="0" stroke={Colors.WHITE} stroke-width="1" />
                </svg>
                <span id="GPSSIndicatorLabel">GPSS</span>
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
    navSourceLabel: Subscribable<NavSourceLabel>
    selectedCourse: Subscribable<number>
    cdiVisible: Subscribable<boolean>
}

export class MfdContent extends ReactiveComponent<MfdContentProps> implements AvionicsPage {
    private readonly menu = FSComponent.createRef<Menu>()
    private readonly setupSubmenu = FSComponent.createRef<SubmenuOverlay>()
    private readonly bp1Selector = FSComponent.createRef<DropdownOverlay<BearingPointerValue>>()
    private readonly bp2Selector = FSComponent.createRef<DropdownOverlay<BearingPointerValue>>()
    private readonly hsi = Subject.create<HSIComponent | null>(null)

    private readonly activeOverlay = Subject.create<MfdOverlay | null>(null)

    readonly knobUnit = Subject.create(KnobValueUnit.Degrees)

    private readonly bearingPointer1 = Subject.create<BearingPointerValue>('VLOC1')
    private readonly bearingPointer2 = Subject.create<BearingPointerValue>('NONE')

    readonly knobValue = this.track(
        MappedSubject.create(
            ([overlay, heading, course]) => (overlay === 'course' ? course : heading),
            this.activeOverlay,
            this.props.manager.selectedHeading,
            this.props.manager.selectedCourse
        )
    )

    private readonly headingActive = this.track(
        this.activeOverlay.map(overlay => overlay === 'heading')
    )
    private readonly courseActive = this.track(
        this.activeOverlay.map(overlay => overlay === 'course')
    )
    private readonly setupActive = this.track(
        this.activeOverlay.map(overlay => overlay === 'setup')
    )
    private readonly obsOverlayActive = this.track(
        this.activeOverlay.map(overlay => overlay === 'obs')
    )
    private readonly bearingPointerSelector1Active = this.track(
        this.activeOverlay.map(overlay => overlay === 'bp-1')
    )
    private readonly bearingPointerSelector2Active = this.track(
        this.activeOverlay.map(overlay => overlay === 'bp-2')
    )

    private readonly obsActive = this.consume(
        this.props.bus.getSubscriber<G5NavEvents>().on('gps_obs_active'),
        false
    )

    private readonly bearingPointerProvider: BearingPointerDataProvider

    constructor(props: MfdContentProps) {
        super(props)

        this.bearingPointerProvider = new BearingPointerDataProvider(
            this.props.bus,
            this.bearingPointer1,
            this.bearingPointer2
        )
    }

    onAfterRender(): void {
        super.onAfterRender()
        this.bearingPointerProvider.resume()
    }

    destroy(): void {
        this.bearingPointerProvider.destroy()
        super.destroy()
    }

    private readonly setHsi = (instance: HSIComponent | null): void => this.hsi.set(instance)
    private readonly closeMenu = (): void => this.menu.instance.close()
    private readonly openHeading = (): void => this.openOverlay('heading')
    private readonly openCourse = (): void => this.openOverlay('course')
    private readonly openOBS = (): void => this.openOverlay('obs')
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

    private readonly toggleGpss = (): void => this.props.manager.toggleGpss()

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
                case 'obs':
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
        const course = this.activeOverlay.get() === 'course'
        const obs = this.activeOverlay.get() === 'obs'
        switch (event) {
            case 'Knob_Inc':
                if (heading) manager.incrementHeading()
                else if (course) manager.incrementCourse()
                else if (obs) manager.incrementOBS()
                break
            case 'Knob_Dec':
                if (heading) manager.decrementHeading()
                else if (course) manager.decrementCourse()
                else if (obs) manager.decrementOBS()
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
        const { bus, manager, altimeter, navSource, navSourceLabel, selectedCourse, cdiVisible } =
            this.props

        return (
            <>
                <div id="HSICompass">
                    <HSIComponent
                        bus={bus}
                        activeSource={navSource}
                        navSourceLabel={navSourceLabel}
                        bearing1State={this.bearingPointerProvider.bearing1}
                        bearing2State={this.bearingPointerProvider.bearing2}
                        cdiVisible={cdiVisible}
                        noCenterText={false}
                        noBackground={false}
                        noAffectSimRadioNav={false}
                        onApi={this.setHsi}
                        gpssEnabled={manager.gpssEnabled}
                    />
                </div>
                <div id="Infos">
                    <GPSSIndicator gpssEnabled={manager.gpssEnabled} />
                    <LeftInfoPanel
                        bus={bus}
                        navSource={navSource}
                        course={selectedCourse}
                        bearing1State={this.bearingPointerProvider.bearing1}
                    />
                    <RightInfoPanel
                        bus={bus}
                        bearing2State={this.bearingPointerProvider.bearing2}
                    />
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
                        color={Colors.GREEN}
                    />
                    <Menu.Item
                        title="GPSS"
                        value={this.props.manager.gpssEnabled}
                        onSelect={this.toggleGpss}
                        isBoolean
                    />
                    <Menu.Item
                        title="OBS"
                        value={manager.obsText}
                        onSelect={this.openOBS}
                        hidden={this.obsActive.map(active => !active)}
                        color={Colors.MAGENTA}
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
                <ValueSelectOverlay
                    title="OBS Course"
                    value={manager.obsText}
                    active={this.obsOverlayActive}
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
