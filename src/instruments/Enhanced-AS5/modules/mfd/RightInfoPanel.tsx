import { ComponentProps, EventBus, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'
import { Colors, formatDegrees3 } from '../common/Utils'
import { BearingState } from '../providers/BearingPointerDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { LeftBearingInfoPanel } from './LeftInfoPanel'

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

class RightBearingInfoPanel extends LeftBearingInfoPanel {
    render(): VNode {
        return (
            <div id="RightBearingInfoPanel" style={this.style}>
                <svg class="RightBearingInfo-shape" viewBox="0 0 120 60">
                    <path
                        d="M 1 45 Q 22 30 35 1 H 119 V 59 H 1 Z"
                        fill="#000000"
                        stroke="var(--light-grey)"
                        stroke-width="1.5"
                    />
                </svg>
                <div class="RightBearingInfo-content">
                    <div class="BearingSymbol">
                        <svg viewBox="0 0 30 10" width="100%" height="100%">
                            <path
                                d="M5 5 L12 5 L16 1 M12 5 L16 9 M14 3 L28 3 M14 7 L28 7"
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
