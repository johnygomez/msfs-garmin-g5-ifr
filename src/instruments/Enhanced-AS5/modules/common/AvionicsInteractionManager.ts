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

const KNOB_RESET_MS = 600
const ALTITUDE_STEP_FEET = 100
const MIN_BARO_HPA = 948
const MAX_BARO_HPA = 1084
const HPA_TO_KOHLSMAN = 16

class KnobAccelerationHelper {
    private readonly accel = new InputAcceleration({ increment: 1 })
    private lastTime = 0
    private lastSign = 0
    private target = 0
    private readonly resetMs: number

    constructor(resetMs: number) {
        this.resetMs = resetMs
    }

    step(sign: number, currentValue: number): number {
        const now = Date.now()
        if (now - this.lastTime > this.resetMs || sign !== this.lastSign) {
            this.target = currentValue
            this.accel.resume()
        }
        this.lastTime = now
        this.lastSign = sign
        const step = this.accel.doStep()
        this.target = (((this.target + sign * step) % 360) + 360) % 360
        return this.target
    }
}

/** Owns every sim-variable interaction (heading, course, altitude, baro) and the reactive selected values. */
export class AvionicsInteractionManager {
    readonly selectedHeading: Subscribable<number>
    readonly selectedCourse: Subscribable<number>
    readonly selectedAltitude: ConsumerSubject<number>
    readonly baroInHg: ConsumerSubject<number>

    readonly headingText: MappedSubscribable<string>
    readonly courseText: MappedSubscribable<string>
    readonly altitudeText: MappedSubscribable<string>

    private readonly headingAccel = new KnobAccelerationHelper(KNOB_RESET_MS)
    private readonly courseAccel = new KnobAccelerationHelper(KNOB_RESET_MS)

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
        this.changeCourse(1)
    }

    decrementCourse(): void {
        this.changeCourse(-1)
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
        const currentHeading = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees())
        this.setSimVar('K:HEADING_BUG_SET', this.headingAccel.step(sign, currentHeading))
    }

    private changeCourse(sign: number): void {
        const currentObs = Math.round(SimVar.GetSimVarValue('A:NAV OBS:1', SimVarValueType.Degree))
        this.setSimVar('K:VOR1_SET', this.courseAccel.step(sign, currentObs))
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
