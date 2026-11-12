import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from './Reactive'

export interface PowerOffDialogProps extends ComponentProps {
    countdown: Subscribable<number | null>
}

export class PowerOffDialog extends ReactiveComponent<PowerOffDialogProps> {
    private readonly state = this.track(
        this.props.countdown.map(remaining => (remaining === null ? 'Inactive' : 'Active'))
    )
    private readonly remainingLabel = this.track(
        this.props.countdown.map(remaining => remaining?.toString() ?? '')
    )

    render(): VNode {
        return (
            <div id="PowerOffDialog" class="G5Dialog" state={this.state}>
                <span>Power Off</span>
                <span id="PowerOffDialogCountdown">{this.remainingLabel}</span>
                <span>Hold To Power Off</span>
            </div>
        )
    }
}
