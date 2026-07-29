import {
    ComponentProps,
    EventBus,
    FSComponent,
    MappedSubject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { resolveNavSourceLabel } from '../common/Nav'
import { ReactiveComponent } from '../common/Reactive'
import { Colors, displayStyle } from '../common/Utils'
import { BearingState } from '../providers/BearingPointerDataProvider'
import { G5NavEvents } from '../publishers/G5NavPublisher'

export interface BearingInfoPanelProps extends ComponentProps {
    bus: EventBus
    state: Subscribable<BearingState>
}

abstract class BearingInfoPanel extends ReactiveComponent<BearingInfoPanelProps> {
    protected readonly nav = this.props.bus.getSubscriber<G5NavEvents>()

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
}

export class LeftBearingInfoPanel extends BearingInfoPanel {
    render(): VNode {
        return (
            <div id="LeftBearingInfoPanel" style={this.style}>
                <svg class="LeftBearingInfo-shape" viewBox="0 0 120 50">
                    <path
                        d="M 1 1 H 85 Q 98 25 119 38 V 49 H 1 Z"
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

export class RightBearingInfoPanel extends BearingInfoPanel {
    render(): VNode {
        return (
            <div id="RightBearingInfoPanel" style={this.style}>
                <svg class="RightBearingInfo-shape" viewBox="0 0 120 50">
                    <path
                        d="M 1 38 Q 22 25 35 1 H 119 V 49 H 1 Z"
                        fill={Colors.BLACK}
                        stroke={Colors.LIGHT_GREY}
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
