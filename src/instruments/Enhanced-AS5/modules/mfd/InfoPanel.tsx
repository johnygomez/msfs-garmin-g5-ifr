import {
    ComponentProps,
    Consumer,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    MappedSubject,
    MappedSubscribable,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { NavSource, resolveNavSourceLabel } from '../common/Nav'
import { Colors } from '../common/Utils'
import { BearingState } from '../providers/BearingPointerDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'

const NO_COURSE = '---'

const formatCourse = (course: number): string => fastToFixed(course, 0).padStart(3, '0')

interface BearingInfoPanelProps extends ComponentProps {
    bus: EventBus
    state: Subscribable<BearingState>
}

class LeftBearingInfoPanel extends DisplayComponent<BearingInfoPanelProps> {
    private readonly navSourceLabel: MappedSubscribable<string>
    private readonly nav1loc: ConsumerSubject<boolean>
    private readonly nav2loc: ConsumerSubject<boolean>
    private readonly style: MappedSubscribable<string>

    constructor(props: BearingInfoPanelProps) {
        super(props)

        const nav = this.props.bus.getSubscriber<G5NavEvents>()
        this.nav1loc = ConsumerSubject.create(nav.on('nav1_has_loc'), false).pause()
        this.nav2loc = ConsumerSubject.create(nav.on('nav2_has_loc'), false).pause()
        // NOTE: TACAN is not supported for the bearing state
        this.navSourceLabel = MappedSubject.create(
            ([state, loc1, loc2]) => resolveNavSourceLabel(state.source, false, loc1, loc2),
            this.props.state,
            this.nav1loc,
            this.nav2loc
        ).pause()

        this.style = MappedSubject.create(
            ([state]) => (state.visible ? '' : 'display: none;'),
            this.props.state
        ).pause()
    }

    onAfterRender(): void {
        this.nav1loc.resume()
        this.nav2loc.resume()
        this.navSourceLabel.resume()
        this.style.resume()
    }

    destroy(): void {
        this.nav1loc.destroy()
        this.nav2loc.destroy()
        this.navSourceLabel.destroy()
        this.style.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="BearingInfoPanel" style={this.style ?? ''}>
                <svg class="LeftBearingInfo-shape" viewBox="0 0 120 60">
                    <path
                        d="M 1 1 H 85 Q 98 30 119 45 V 59 H 1 Z"
                        fill={Colors.BLACK}
                        stroke={Colors.LIGHT_GREY}
                        stroke-width="1.5"
                    />
                </svg>
                <div class="LeftBearingInfo-content">
                    <div id="BearingSymbol">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 30 10"
                            width="100%"
                            height="100%"
                        >
                            <path
                                d="M2 5 L28 5 M18 1 L22 5 M18 9 L22 5"
                                stroke={Colors.CYAN}
                                stroke-width="2"
                            />
                        </svg>
                    </div>
                    <div id="BearingSource">{this.navSourceLabel}</div>
                </div>
            </div>
        )
    }
}

interface DTKInfoProps extends ComponentProps {
    bus: EventBus
    active: Subscribable<boolean>
}

class DTKInfo extends DisplayComponent<DTKInfoProps> {
    private readonly dtkValue: ConsumerSubject<number>
    private readonly dtkText: MappedSubscribable<string>
    private readonly style: MappedSubscribable<string>

    constructor(props: DTKInfoProps) {
        super(props)

        this.dtkValue = ConsumerSubject.create(
            this.props.bus.getSubscriber<G5NavEvents>().on('gps_wp_desired_track'),
            0
        ).pause()
        this.dtkText = this.dtkValue.map(value => fastToFixed(value, 0))
        this.style = this.props.active.map(active => (active ? '' : 'display: none;')).pause()
    }

    onAfterRender(): void {
        this.dtkValue.resume()
        this.dtkText.resume()
        this.style.resume()
    }

    destroy(): void {
        this.dtkValue.destroy()
        this.dtkText.destroy()
        this.style.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="DTK" style={this.style}>
                <div id="DTKLabel">DTK</div>
                <div id="DTKValue">{this.dtkText}°</div>
            </div>
        )
    }
}

interface CRSInfoProps extends ComponentProps {
    bus: EventBus
    active: Subscribable<boolean>
    navSource: Subscribable<NavSource>
}

class CRSInfo extends DisplayComponent<CRSInfoProps> {
    private readonly consumers: ConsumerSubject<any>[] = []
    private readonly derived: MappedSubscribable<any>[] = []

    private readonly tacanDriven: ConsumerSubject<boolean>
    private readonly crsText: MappedSubscribable<string>
    private readonly style: MappedSubscribable<string>

    constructor(props: CRSInfoProps) {
        super(props)

        const nav = this.props.bus.getSubscriber<G5NavEvents>()

        this.tacanDriven = this.consume(nav.on('tacan_drives_nav1'), false)

        this.crsText = this.track(
            MappedSubject.create(
                ([source, nav1Course, nav2Course]) => {
                    switch (source) {
                        case NavSource.Nav1:
                            return nav1Course
                        case NavSource.Nav2:
                            return nav2Course
                        default:
                            return NO_COURSE
                    }
                },
                this.props.navSource,
                this.navCourseText(1),
                this.navCourseText(2)
            )
        )

        this.style = this.track(this.props.active.map(active => (active ? '' : 'display: none;')))
    }

    onAfterRender(): void {
        for (const consumer of this.consumers) {
            consumer.resume()
        }
        for (const subject of this.derived) {
            subject.resume()
        }
    }

    destroy(): void {
        for (const consumer of this.consumers) {
            consumer.destroy()
        }
        for (const subject of this.derived) {
            subject.destroy()
        }
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="CRS" style={this.style}>
                <div id="CRSLabel">CRS</div>
                <div id="CRSValue">{this.crsText}°</div>
            </div>
        )
    }

    /** Resolves a radio's selected course the same way the HSI course pointer does. */
    private navCourseText(index: 1 | 2): MappedSubscribable<string> {
        const nav = this.props.bus.getSubscriber<G5NavEvents>()
        const on = <T,>(topic: keyof G5NavEvents, init: T) =>
            this.consume(nav.on(topic) as unknown as Consumer<T>, init)

        return this.track(
            MappedSubject.create(
                ([tacan, hasNav, hasLoc, localizer, obs, tacanObs]) =>
                    hasNav ? formatCourse(tacan ? tacanObs : hasLoc ? localizer : obs) : NO_COURSE,
                this.tacanDriven,
                on<boolean>(`nav${index}_has_nav`, false),
                on<boolean>(`nav${index}_has_loc`, false),
                on<number>(`nav${index}_localizer`, 0),
                on<number>(`nav${index}_obs`, 0),
                on<number>(`nav${index}_tacan_obs`, 0)
            )
        )
    }

    private consume<T>(consumer: Consumer<T>, initial: T): ConsumerSubject<T> {
        const subject = ConsumerSubject.create(consumer, initial).pause()
        this.consumers.push(subject)
        return subject
    }

    private track<T extends MappedSubscribable<any>>(subscribable: T): T {
        this.derived.push(subscribable.pause())
        return subscribable
    }
}

interface GroundSpeedInfoProps extends ComponentProps {
    bus: EventBus
    active: Subscribable<boolean>
}

class GroundSpeedInfo extends DisplayComponent<GroundSpeedInfoProps> {
    private readonly groundSpeed: ConsumerSubject<number>
    private readonly groundSpeedText: MappedSubscribable<string>
    private readonly style: MappedSubscribable<string>

    constructor(props: GroundSpeedInfoProps) {
        super(props)

        this.groundSpeed = ConsumerSubject.create(
            this.props.bus.getSubscriber<G5CustomEvents>().on('ground_speed'),
            0
        ).pause()
        this.groundSpeedText = this.groundSpeed.map(speed => fastToFixed(speed, 0)).pause()
        this.style = this.props.active.map(active => (active ? '' : 'display: none;')).pause()
    }

    onAfterRender(): void {
        this.groundSpeed.resume()
        this.groundSpeedText.resume()
        this.style.resume()
    }

    destroy(): void {
        this.groundSpeed.destroy()
        this.groundSpeedText.destroy()
        this.style.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="GroundSpeed" style={this.style}>
                <div>GS KT</div>
                <div id="GroundSpeedValue">{this.groundSpeedText}</div>
            </div>
        )
    }
}

type LeftInfoPanelMode = 'GS' | 'DTK' | 'CRS'

export interface LeftInfoPanelProps extends ComponentProps {
    navSource: Subscribable<NavSource>
    bearing1State: Subscribable<BearingState>
    bus: EventBus
}

export class LeftInfoPanel extends DisplayComponent<LeftInfoPanelProps> {
    private readonly mode: MappedSubscribable<LeftInfoPanelMode>
    private readonly dtk: ConsumerSubject<number>

    private readonly dtkActive: MappedSubscribable<boolean>
    private readonly crsActive: MappedSubscribable<boolean>
    private readonly gsActive: MappedSubscribable<boolean>

    constructor(props: LeftInfoPanelProps) {
        super(props)

        const nav = this.props.bus.getSubscriber<G5NavEvents>()
        this.dtk = ConsumerSubject.create(nav.on('gps_wp_desired_track'), 0).pause()
        this.mode = MappedSubject.create(
            ([navSource, dtk]) => this.resolveMode(navSource, dtk),
            this.props.navSource,
            this.dtk
        ).pause()
        this.dtkActive = this.mode.map(mode => mode === 'DTK').pause()
        this.crsActive = this.mode.map(mode => mode === 'CRS').pause()
        this.gsActive = this.mode.map(mode => mode === 'GS').pause()
    }

    onAfterRender(): void {
        this.mode.resume()
        this.dtk.resume()
        this.dtkActive.resume()
        this.crsActive.resume()
        this.gsActive.resume()
    }

    destroy(): void {
        this.mode.destroy()
        this.dtkActive.destroy()
        this.crsActive.destroy()
        this.gsActive.destroy()
        this.dtk.destroy()
        super.destroy()
    }

    private resolveMode(navSrc: NavSource, dtk?: number): LeftInfoPanelMode {
        switch (navSrc) {
            case NavSource.Nav1:
            case NavSource.Nav2:
                return 'CRS'
            case NavSource.GPS:
                return !isNaN(dtk) ? 'DTK' : 'GS'
            default:
                return 'GS'
        }
    }

    render(): VNode {
        return (
            <div id="LeftInfoPanel">
                <LeftBearingInfoPanel bus={this.props.bus} state={this.props.bearing1State} />
                <DTKInfo bus={this.props.bus} active={this.dtkActive} />
                <CRSInfo
                    bus={this.props.bus}
                    active={this.crsActive}
                    navSource={this.props.navSource}
                />
                <GroundSpeedInfo bus={this.props.bus} active={this.gsActive} />
            </div>
        )
    }
}
