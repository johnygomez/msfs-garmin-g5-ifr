import { ComponentProps, EventBus, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'
import { formatDegrees3 } from '../common/Utils'
import { BearingState } from '../providers/BearingPointerDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { RightBearingInfoPanel } from './BearingInfoPanel'

interface SelectedHeadingInfoProps extends ComponentProps {
    bus: EventBus
}

class SelectedHeadingInfo extends ReactiveComponent<SelectedHeadingInfoProps> {
    private readonly heading = this.consume(
        this.props.bus.getSubscriber<G5CustomEvents>().on('ap_heading_selected'),
        0
    )
    private readonly headingText = this.track(this.heading.map(formatDegrees3))

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

export interface RightInfoPanelProps extends ComponentProps {
    bus: EventBus
    bearing2State: Subscribable<BearingState>
}

export class RightInfoPanel extends ReactiveComponent<RightInfoPanelProps> {
    render(): VNode {
        return (
            <div id="RightInfoPanel">
                <RightBearingInfoPanel bus={this.props.bus} state={this.props.bearing2State} />
                <SelectedHeadingInfo bus={this.props.bus} />
            </div>
        )
    }
}
