import {
    ComponentProps,
    EventBus,
    FSComponent,
    MappedSubject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { NavSource } from '../common/Nav'
import { ReactiveComponent } from '../common/Reactive'
import { displayStyle, formatCourse } from '../common/Utils'
import { BearingState } from '../providers/BearingPointerDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import { LeftBearingInfoPanel } from './BearingInfoPanel'

interface DTKInfoProps extends ComponentProps {
    active: Subscribable<boolean>
    desiredTrack: Subscribable<number>
}

class DTKInfo extends ReactiveComponent<DTKInfoProps> {
    private readonly dtkText = this.track(this.props.desiredTrack.map(formatCourse))
    private readonly style = this.track(displayStyle(this.props.active))

    render(): VNode {
        return (
            <div id="DTK" style={this.style}>
                <div id="DTKLabel">DTK</div>
                <div id="DTKValue">{this.dtkText}</div>
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
