import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'
import { ToggleMode } from '../common/Utils'

export interface TrueAirspeedDisplayProps extends ComponentProps {
    trueAirspeed: Subscribable<number>
    mode: Subscribable<ToggleMode>
}

export class TrueAirspeedDisplay extends ReactiveComponent<TrueAirspeedDisplayProps> {
    private readonly state = this.track(
        this.props.mode.map(mode => (mode === 'ON' ? 'Active' : 'Inactive'))
    )
    private readonly tasText = this.track(this.props.trueAirspeed.map(tas => fastToFixed(tas, 0)))

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
