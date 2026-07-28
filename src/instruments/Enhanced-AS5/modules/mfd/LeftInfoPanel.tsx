import {
    ComponentProps,
    EventBus,
    FSComponent,
    MappedSubject,
    MappedSubscribable,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { NavSource, resolveNavSourceLabel } from '../common/Nav'
import { ReactiveComponent } from '../common/Reactive'
import { Colors, formatDegrees3 } from '../common/Utils'
import { BearingState } from '../providers/BearingPointerDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'

const NO_COURSE = '---°'

const formatCourse = (course: number): string =>
    isNaN(course) ? NO_COURSE : formatDegrees3(course)

const displayStyle = (visible: Subscribable<boolean>): MappedSubscribable<string> =>
    visible.map(shown => (shown ? '' : 'display: none;'))

export interface BearingInfoPanelProps extends ComponentProps {
    bus: EventBus
    state: Subscribable<BearingState>
}

export class LeftBearingInfoPanel extends ReactiveComponent<BearingInfoPanelProps> {
    private readonly nav = this.props.bus.getSubscriber<G5NavEvents>()

    protected readonly nav1HasLoc = this.consume(this.nav.on('nav1_has_loc'), false)
    protected readonly nav2HasLoc = this.consume(this.nav.on('nav2_has_loc'), false)

    protected readonly source = this.track(this.props.state.map(state => state.source))
    protected readonly style = this.track(
        displayStyle(this.props.state.map(state => state.visible))
    )

    // A bearing pointer is never TACAN-driven, so the label resolves to VOR/LOC or ADF.
    protected readonly sourceLabel = this.track(
        MappedSubject.create(
            ([source, hasLoc1, hasLoc2]) => resolveNavSourceLabel(source, false, hasLoc1, hasLoc2),
            this.source,
            this.nav1HasLoc,
            this.nav2HasLoc
        )
    )

    render(): VNode {
        return (
            <div id="LeftBearingInfoPanel" style={this.style}>
                <svg class="LeftBearingInfo-shape" viewBox="0 0 120 60">
                    <path
                        d="M 1 1 H 85 Q 98 30 119 45 V 59 H 1 Z"
                        fill={Colors.BLACK}
                        stroke={Colors.LIGHT_GREY}
                        stroke-width="1.5"
                    />
                </svg>
                <div class="LeftBearingInfo-content">
                    <div class="BearingSymbol">
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
                    <div class="BearingSource">{this.sourceLabel}</div>
                </div>
            </div>
        )
    }
}

interface DTKInfoProps extends ComponentProps {
    active: Subscribable<boolean>
    desiredTrack: Subscribable<number>
}

class DTKInfo extends ReactiveComponent<DTKInfoProps> {
    private readonly dtkText = this.track(
        this.props.desiredTrack.map(track => fastToFixed(track, 0))
    )
    private readonly style = this.track(displayStyle(this.props.active))

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
    active: Subscribable<boolean>
    course: Subscribable<number>
}

class CRSInfo extends ReactiveComponent<CRSInfoProps> {
    private readonly crsText = this.track(this.props.course.map(formatCourse))
    private readonly style = this.track(displayStyle(this.props.active))

    render(): VNode {
        return (
            <div id="CRS" style={this.style}>
                <div id="CRSLabel">CRS</div>
                <div id="CRSValue">{this.crsText}</div>
            </div>
        )
    }
}

interface GroundSpeedInfoProps extends ComponentProps {
    bus: EventBus
    active: Subscribable<boolean>
}

class GroundSpeedInfo extends ReactiveComponent<GroundSpeedInfoProps> {
    private readonly groundSpeed = this.consume(
        this.props.bus.getSubscriber<G5CustomEvents>().on('ground_speed'),
        0
    )

    private readonly groundSpeedText = this.track(
        this.groundSpeed.map(speed => fastToFixed(speed, 0))
    )
    private readonly style = this.track(displayStyle(this.props.active))

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

function resolveMode(source: NavSource, desiredTrack: number): LeftInfoPanelMode {
    switch (source) {
        case NavSource.Nav1:
        case NavSource.Nav2:
            return 'CRS'
        case NavSource.GPS:
            return isNaN(desiredTrack) ? 'GS' : 'DTK'
        default:
            return 'GS'
    }
}

export interface LeftInfoPanelProps extends ComponentProps {
    bus: EventBus
    navSource: Subscribable<NavSource>
    course: Subscribable<number>
    bearing1State: Subscribable<BearingState>
}

export class LeftInfoPanel extends ReactiveComponent<LeftInfoPanelProps> {
    private readonly desiredTrack = this.consume(
        this.props.bus.getSubscriber<G5NavEvents>().on('gps_wp_desired_track'),
        0
    )

    private readonly mode = this.track(
        MappedSubject.create(
            params => resolveMode(...params),
            this.props.navSource,
            this.desiredTrack
        )
    )

    private readonly dtkActive = this.track(this.mode.map(mode => mode === 'DTK'))
    private readonly crsActive = this.track(this.mode.map(mode => mode === 'CRS'))
    private readonly gsActive = this.track(this.mode.map(mode => mode === 'GS'))

    render(): VNode {
        return (
            <div id="LeftInfoPanel">
                <LeftBearingInfoPanel bus={this.props.bus} state={this.props.bearing1State} />
                <DTKInfo active={this.dtkActive} desiredTrack={this.desiredTrack} />
                <CRSInfo active={this.crsActive} course={this.props.course} />
                <GroundSpeedInfo bus={this.props.bus} active={this.gsActive} />
            </div>
        )
    }
}
