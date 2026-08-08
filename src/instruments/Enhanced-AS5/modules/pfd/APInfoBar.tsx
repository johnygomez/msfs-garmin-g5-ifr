import {
    FmaMasterSlot,
    FmaMasterSlotState,
    FmaModeSlot,
    FmaModeSlotActiveData,
} from '@microsoft/msfs-garminsdk'
import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'

export interface APInfoBarSubjects {
    apState: Subscribable<FmaMasterSlotState>
    ydState: Subscribable<FmaMasterSlotState>
    lateralActive: Subscribable<FmaModeSlotActiveData>
    lateralArmed: Subscribable<string>
    verticalActive: Subscribable<FmaModeSlotActiveData>
    verticalArmedPrimary: Subscribable<string>
    verticalArmedSecondary: Subscribable<string>
    verticalReference: Subscribable<string>
    hasAnnunciation: Subscribable<boolean>
}

export interface APInfoBarProps extends APInfoBarSubjects, ComponentProps {}

export class APInfoBarComponent extends ReactiveComponent<APInfoBarProps> {
    render(): VNode {
        const {
            apState,
            ydState,
            lateralActive,
            lateralArmed,
            verticalActive,
            verticalArmedPrimary,
            verticalArmedSecondary,
            verticalReference,
        } = this.props

        return (
            <div class="ap-infobar">
                <div class="ap-infobar-section ap-infobar-lateral">
                    <span class="ap-infobar-armed">{lateralArmed}</span>
                    <FmaModeSlot active={lateralActive} />
                </div>

                <div class="ap-infobar-section ap-infobar-status">
                    <FmaMasterSlot state={apState}>AP</FmaMasterSlot>
                    <FmaMasterSlot state={ydState}>YD</FmaMasterSlot>
                </div>

                <div class="ap-infobar-section ap-infobar-vertical">
                    <div class="ap-infobar-group">
                        <FmaModeSlot active={verticalActive} />
                        <span class="ap-infobar-reference">{verticalReference}</span>
                    </div>
                    <div class="ap-infobar-group">
                        <span class="ap-infobar-armed">{verticalArmedPrimary}</span>
                        <span class="ap-infobar-armed">{verticalArmedSecondary}</span>
                    </div>
                </div>
            </div>
        )
    }
}
