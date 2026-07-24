import {
    AdcEvents,
    ConsumerSubject,
    EventBus,
    InputAcceleration,
    MappedSubscribable,
    SimVarValueType,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { formatDegrees3, normalizeDegrees360 } from './Utils'

const HEADING_KNOB_RESET_MS = 600
const ALTITUDE_STEP_FEET = 100
const MIN_BARO_HPA = 948
const MAX_BARO_HPA = 1084
const HPA_TO_KOHLSMAN = 16

/** Owns every sim-variable interaction (heading, course, altitude, baro) and the reactive selected values. */
export class AvionicsInteractionManager {
    readonly selectedHeading: Subscribable<number>
    readonly selectedCourse: Subscribable<number>
    readonly selectedAltitude: ConsumerSubject<number>
    readonly baroInHg: ConsumerSubject<number>

    readonly headingText: MappedSubscribable<string>
    readonly courseText: MappedSubscribable<string>
    readonly altitudeText: MappedSubscribable<string>

    private readonly headingAccel = new InputAcceleration({ increment: 1 })
    private lastHeadingTime = 0
    private lastHeadingSign = 0
    private headingTarget = 0

    constructor(bus: EventBus) {
        const sub = bus.getSubscriber<G5CustomEvents & AdcEvents>()

        const headingSelected = ConsumerSubject.create(sub.on('ap_heading_selected'), 0)
        const nav1Obs = ConsumerSubject.create(sub.on('nav1_obs'), 0)
        this.selectedAltitude = ConsumerSubject.create(sub.on('ap_altitude_selected'), 0)
        this.baroInHg = ConsumerSubject.create(sub.on('altimeter_baro_setting_inhg'), 29.92)

        this.selectedHeading = headingSelected.map(normalizeDegrees360)
        this.selectedCourse = nav1Obs.map(normalizeDegrees360)

        this.headingText = this.selectedHeading.map(formatDegrees3)
        this.courseText = this.selectedCourse.map(formatDegrees3)
        this.altitudeText = this.selectedAltitude.map(altitude => fastToFixed(altitude, 0) + 'ft')
    }

    incrementHeading(): void {
        this.changeHeading(1)
    }

    decrementHeading(): void {
        this.changeHeading(-1)
    }

    syncHeading(): void {
        this.setSimVar('K:HEADING_BUG_SET', Math.round(Simplane.getHeadingMagnetic()))
    }

    incrementCourse(): void {
        this.setSimVar('K:VOR1_OBI_INC', 0)
    }

    decrementCourse(): void {
        this.setSimVar('K:VOR1_OBI_DEC', 0)
    }

    incrementAltitude(): void {
        this.setSimVar('K:AP_ALT_VAR_INC', ALTITUDE_STEP_FEET)
    }

    decrementAltitude(): void {
        this.setSimVar('K:AP_ALT_VAR_DEC', ALTITUDE_STEP_FEET)
    }

    syncAltitude(): void {
        const rounded = Math.round(Simplane.getAltitude() / ALTITUDE_STEP_FEET) * ALTITUDE_STEP_FEET
        this.setSimVar('K:AP_ALT_VAR_SET_ENGLISH', rounded)
    }

    increaseBaro(): void {
        this.changeBaro(1)
    }

    decreaseBaro(): void {
        this.changeBaro(-1)
    }

    private changeHeading(sign: number): void {
        const now = Date.now()
        const elapsed = now - this.lastHeadingTime
        if (elapsed > HEADING_KNOB_RESET_MS || sign !== this.lastHeadingSign) {
            this.headingTarget = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees())
            this.headingAccel.resume()
        }
        this.lastHeadingTime = now
        this.lastHeadingSign = sign
        const step = this.headingAccel.doStep()
        this.headingTarget = (((this.headingTarget + sign * step) % 360) + 360) % 360
        this.setSimVar('K:HEADING_BUG_SET', this.headingTarget)
    }

    private changeBaro(direction: 1 | -1): void {
        const currentHpa = SimVar.GetSimVarValue('A:KOHLSMAN SETTING MB:1', 'Millibars')
        const nextHpa = Math.round(currentHpa) + direction
        if (nextHpa >= MIN_BARO_HPA && nextHpa <= MAX_BARO_HPA) {
            SimVar.SetSimVarValue(
                'K:KOHLSMAN_SET',
                SimVarValueType.Number,
                nextHpa * HPA_TO_KOHLSMAN
            )
        }
    }

    private setSimVar(name: string, value: number): void {
        SimVar.SetSimVarValue(name, SimVarValueType.Number, value)
    }
}
