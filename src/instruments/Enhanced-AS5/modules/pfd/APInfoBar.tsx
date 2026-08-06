import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'

/**
 * Alert state of the autopilot status annunciation. Rendered as the `state` attribute of
 * `#AP_Status`, whose colours and flash animations live in `style.css`.
 */
export type APDisplayMode = 'RedFlash' | 'YellowFlash' | 'Red' | 'Yellow' | ''

export interface APInfoBarSubjects {
    apStatus: Subscribable<string>
    apStatusDisplay: Subscribable<APDisplayMode>
    apLateralActive: Subscribable<string>
    apLateralArmed: Subscribable<string>
    apVerticalActive: Subscribable<string>
    apModeReference: Subscribable<string>
    apArmed: Subscribable<string>
    apArmedReference: Subscribable<string>
    apYDStatus: Subscribable<string>
}

export interface APInfoBarProps extends APInfoBarSubjects, ComponentProps {}

export class APInfoBarComponent extends ReactiveComponent<APInfoBarProps> {
    render(): VNode {
        const {
            apStatus,
            apStatusDisplay,
            apYDStatus,
            apLateralArmed,
            apLateralActive,
            apVerticalActive,
            apModeReference,
            apArmed,
            apArmedReference,
        } = this.props

        return (
            <div class="ap-infobar">
                <div class="ap-infobar-section ap-infobar-lateral">
                    <span id="AP_LateralArmed">{apLateralArmed}</span>
                    <span id="AP_LateralActive" class="ap-infobar-active">
                        {apLateralActive}
                    </span>
                </div>

                <div class="ap-infobar-section ap-infobar-status">
                    <span id="AP_Status" class="ap-infobar-active" state={apStatusDisplay}>
                        {apStatus}
                    </span>
                    <span id="AP_YDStatus" class="ap-infobar-active">
                        {apYDStatus}
                    </span>
                </div>

                <div class="ap-infobar-section ap-infobar-vertical">
                    <div class="ap-infobar-group">
                        <span id="AP_VerticalActive" class="ap-infobar-active">
                            {apVerticalActive}
                        </span>
                        <span id="AP_ModeReference" class="ap-infobar-active">
                            {apModeReference}
                        </span>
                    </div>
                    <div class="ap-infobar-group">
                        <span id="AP_Armed">{apArmed}</span>
                        <span id="AP_ArmedReference">{apArmedReference}</span>
                    </div>
                </div>
            </div>
        )
    }
}
