import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from './Reactive'
import { Colors } from './Utils'

export interface GPSSIndicatorProps extends ComponentProps {
    gpssEnabled: Subscribable<boolean>
}

export class GPSSIndicator extends ReactiveComponent<GPSSIndicatorProps> {
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
