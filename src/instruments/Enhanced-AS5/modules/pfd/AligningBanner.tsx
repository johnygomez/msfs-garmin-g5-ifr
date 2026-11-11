import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'
import { StartupPhase } from '../providers/G5StartupSystem'

export interface AligningBannerProps extends ComponentProps {
    phase: Subscribable<StartupPhase>
}

export class AligningBanner extends ReactiveComponent<AligningBannerProps> {
    private readonly state = this.track(
        this.props.phase.map(phase => (phase === 'aligning' ? 'Active' : 'Inactive'))
    )

    render(): VNode {
        return (
            <div id="AligningBanner" state={this.state}>
                ALIGNING
            </div>
        )
    }
}
