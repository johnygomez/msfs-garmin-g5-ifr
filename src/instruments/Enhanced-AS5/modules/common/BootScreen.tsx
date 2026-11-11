import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { StartupPhase } from '../providers/G5StartupSystem'
import { ReactiveComponent } from './Reactive'

export interface BootScreenProps extends ComponentProps {
    phase: Subscribable<StartupPhase>
}

export class BootScreen extends ReactiveComponent<BootScreenProps> {
    private readonly state = this.track(
        this.props.phase.map(phase => (phase === 'booting' ? 'Active' : 'Inactive'))
    )

    render(): VNode {
        return (
            <div id="BootScreen" state={this.state}>
                <div id="BootScreenLogo">
                    GARMIN
                    <svg id="BootScreenLogoDelta" viewBox="0 0 52 48" preserveAspectRatio="none">
                        <polygon points="26,4 48,44 4,44" />
                    </svg>
                    <span id="BootScreenLogoTrademark">TM</span>
                </div>
                <div id="BootScreenInfo">
                    <span>G5 1.4.0</span>
                    <span>Copyright 2016-2026</span>
                    <span>Garmin Ltd. Or its subsidiaries</span>
                </div>
            </div>
        )
    }
}
