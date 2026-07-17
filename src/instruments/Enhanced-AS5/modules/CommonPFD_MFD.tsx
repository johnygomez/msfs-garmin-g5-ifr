import { Subscribable } from '@microsoft/msfs-sdk'

import { NavSystemElement } from './NavSystem'
import { VerticalDeviationMode } from './VerticalDeviationIndicator'

/**
 * Vertical-deviation guidance shown beside the altimeter. Altitude/baro/vertical-speed
 * are consumed directly from the EventBus by `AltimeterComponent`; only the vertical
 * deviation (sourced from `NavSourceDataProvider`) is threaded through as props.
 */
export interface AltimeterSubjects {
    verticalDeviationMode: Subscribable<VerticalDeviationMode>
    verticalDeviationValue: Subscribable<number>
}
/**
 * Handles the barometric-pressure knob (BARO_INC / BARO_DEC). The altimeter's
 * displayed values are published to the EventBus (AdcPublisher) and read by
 * `AltimeterComponent`, so this element only carries the baro input logic.
 */
export class PFD_Altimeter extends NavSystemElement {
    init(_root) {}
    onEnter() {}
    onUpdate(_deltaTime) {}
    onExit() {}
    onEvent(_event) {
        switch (_event) {
            case 'BARO_INC':
                this.increaseBaro()
                break
            case 'BARO_DEC':
                this.decreaseBaro()
                break
        }
    }

    private increaseBaro() {
        const currentHpa = SimVar.GetSimVarValue('A:KOHLSMAN SETTING MB:1', 'Millibars')
        const nextIntegerHpa = Math.round(currentHpa) + 1

        if (nextIntegerHpa <= 1084) {
            const targetHpa = nextIntegerHpa * 16
            SimVar.SetSimVarValue('K:KOHLSMAN_SET', 'number', targetHpa)
        }
    }

    private decreaseBaro() {
        const currentHpa = SimVar.GetSimVarValue('A:KOHLSMAN SETTING MB:1', 'Millibars')
        const nextIntegerHpa = Math.round(currentHpa) - 1
        if (nextIntegerHpa >= 948) {
            const targetHpa = nextIntegerHpa * 16
            SimVar.SetSimVarValue('K:KOHLSMAN_SET', 'number', targetHpa)
        }
    }
}
/**
 * Attitude data is published to the EventBus by AhrsPublisher + G5CustomPublisher
 * and read by the display components via ConsumerSubject, so this element carries
 * no state of its own — it exists only to occupy a slot in the PFD element group.
 */
export class PFD_Attitude extends NavSystemElement {
    init(_root) {}
    onEnter() {}
    onUpdate(_deltaTime) {}
    onExit() {}
    onEvent(_event) {}
}
