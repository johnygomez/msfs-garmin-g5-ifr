import {
    ComponentProps,
    FSComponent,
    MappedSubject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'
import { MIN_DISPLAYED_AIRSPEED_KT, ToggleMode } from '../common/Utils'

export interface TrueAirspeedDisplayProps extends ComponentProps {
    trueAirspeed: Subscribable<number>
    indicatedAirspeed: Subscribable<number>
    mode: Subscribable<ToggleMode>
}

export class TrueAirspeedDisplay extends ReactiveComponent<TrueAirspeedDisplayProps> {
    private readonly state = this.track(
        this.props.mode.map(mode => (mode === 'ON' ? 'Active' : 'Inactive'))
    )
    private readonly tasText = this.track(
        MappedSubject.create(
            ([tas, ias]) => (ias < MIN_DISPLAYED_AIRSPEED_KT ? '---' : fastToFixed(tas, 0)),
            this.props.trueAirspeed,
            this.props.indicatedAirspeed
        )
    )

    render(): VNode {
        return (
            <div id="TASIndicator" class="airspeed-gs-box" state={this.state}>
                <span class="airspeed-gs-box-label">TAS</span>
                <span class="airspeed-gs-box-value airspeed-tas-box-value">
                    {this.tasText}
                    <span class="airspeed-gs-box-value-units">kt</span>
                </span>
            </div>
        )
    }
}
