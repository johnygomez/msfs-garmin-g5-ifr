import { SimVarValueType, Subject, Subscribable } from '@microsoft/msfs-sdk'

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
export class PFD_Compass extends NavSystemElement {
    displayArc: boolean
    hasLocBeenEntered: boolean
    hasLocBeenActivated: boolean
    ifTimer: number
    ifIcao: string
    hsiElemId: any
    arcHsiElemId: any
    hsi: any
    arcHsi: any
    headingSub = Subject.create(0)
    courseSub = Subject.create(0)
    cdiDeviationSub = Subject.create(0)
    bearing1Sub = Subject.create(0)
    bearing2Sub = Subject.create(0)
    dmeDistanceSub = Subject.create(0)
    turnRateSub = Subject.create(0)

    set cdiSource(_val) {
        if (this.hsi) this.hsi.logic_cdiSource = _val
    }
    set dmeSource(_val) {
        SimVar.SetSimVarValue('L:Glasscockpit_DmeSource', 'Number', _val)
    }
    get cdiSource() {
        if (this.hsi) return this.hsi.logic_cdiSource
        return 0
    }
    get dmeSource() {
        return SimVar.GetSimVarValue('L:Glasscockpit_DmeSource', 'Number')
    }

    constructor(_hsiElemId = null, _arcHsiElemId = null) {
        super()
        this.displayArc = true
        this.hasLocBeenEntered = false
        this.hasLocBeenActivated = false
        this.ifTimer = 0
        this.ifIcao = ''
        this.hsiElemId = _hsiElemId
        this.arcHsiElemId = _arcHsiElemId
    }

    init(_root) {
        this.hsi = this.gps.getChildById(this.hsiElemId ? this.hsiElemId : 'Compass')
        this.arcHsi = this.gps.getChildById(this.arcHsiElemId ? this.arcHsiElemId : 'ArcCompass')
        this.displayArc =
            SimVar.GetSimVarValue('L:Glasscockpit_HSI_Arc', SimVarValueType.Number) != 0
        if (this.hsi) {
            this.hsi.init()
        }
        if (this.arcHsi) {
            this.arcHsi.init()
        }
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        if (this.displayArc) {
            this.arcHsi.update(_deltaTime)
        } else {
            this.hsi.update(_deltaTime)
        }
        if (this.gps.currFlightPlanManager) {
            if (this.ifTimer <= 0) {
                this.ifTimer = 2000
                if (this.gps.currFlightPlanManager.isActiveApproach()) {
                    this.gps.currFlightPlanManager.getApproachIfIcao(value => {
                        this.ifIcao = value
                    })
                }
            } else {
                this.ifTimer -= this.gps.deltaTime
            }
            if (
                this.gps.currFlightPlanManager.isActiveApproach() &&
                this.gps.currFlightPlanManager.getActiveWaypointIndex() != -1 &&
                Simplane.getAutoPilotApproachType() == ApproachType.APPROACH_TYPE_ILS
            ) {
                const approachWPNb = this.gps.currFlightPlanManager.getApproachWaypoints().length
                const activeWP = this.gps.currFlightPlanManager.getActiveWaypoint()
                if (
                    ((this.ifIcao &&
                        this.ifIcao != '' &&
                        activeWP &&
                        this.ifIcao == activeWP.icao) ||
                        (approachWPNb > 0 &&
                            this.gps.currFlightPlanManager.getActiveWaypointIndex() >=
                                approachWPNb - 2)) &&
                    !this.hasLocBeenEntered
                ) {
                    const approachFrequency =
                        this.gps.currFlightPlanManager.getApproachNavFrequency()
                    if (!isNaN(approachFrequency)) {
                        SimVar.SetSimVarValue('K:NAV1_RADIO_SWAP', SimVarValueType.Number, 0)
                        SimVar.SetSimVarValue(
                            'K:NAV1_RADIO_SET_HZ',
                            'hertz',
                            approachFrequency * 1000000
                        )
                    }
                    this.hasLocBeenEntered = true
                } else {
                    let approachWP
                    const wpIndex = this.gps.currFlightPlanManager.getActiveWaypointIndex() - 1
                    if (wpIndex >= 0 && wpIndex < approachWPNb) {
                        approachWP = this.gps.currFlightPlanManager.getApproachWaypoints()[wpIndex]
                    }
                    if (
                        ((this.ifIcao &&
                            this.ifIcao != '' &&
                            approachWP &&
                            this.ifIcao == approachWP.icao &&
                            this.hasLocBeenEntered) ||
                            (approachWPNb > 0 &&
                                this.gps.currFlightPlanManager.getActiveWaypointIndex() ==
                                    approachWPNb - 1)) &&
                        !this.hasLocBeenActivated
                    ) {
                        if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                            SimVar.SetSimVarValue(
                                'K:TOGGLE_GPS_DRIVES_NAV1',
                                SimVarValueType.Number,
                                0
                            )
                        }
                        Simplane.setAutoPilotSelectedNav(1)
                        this.hasLocBeenActivated = true
                    }
                }
            } else {
                this.hasLocBeenEntered = false
                this.hasLocBeenActivated = false
            }
        }
    }
    onExit() {}
    onEvent(_event) {
        this.hsi.onEvent(_event)
        switch (_event) {
            case 'SoftKeys_HSI_360':
                this.displayArc = false
                SimVar.SetSimVarValue('L:Glasscockpit_HSI_Arc', SimVarValueType.Number, 0)
                break
            case 'SoftKeys_HSI_ARC':
                this.displayArc = true
                SimVar.SetSimVarValue('L:Glasscockpit_HSI_Arc', SimVarValueType.Number, 1)
                break
        }
    }
}
