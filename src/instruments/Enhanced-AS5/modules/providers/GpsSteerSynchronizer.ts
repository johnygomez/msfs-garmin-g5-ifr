import { EventBus, LNavEvents, SimVarValueType } from '@microsoft/msfs-sdk'

import { ReactiveProvider } from '../common/Reactive'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'

const NULL_LNAV_COURSE: number | null = null

export class GpsSteerSynchronizer extends ReactiveProvider {
    private readonly gpssEnabled = this.consume(
        this.bus.getSubscriber<G5CustomEvents>().on('gpss_enabled'),
        false
    )

    private readonly lnavTracking = this.consume(
        this.bus.getSubscriber<LNavEvents>().on('lnav_is_tracking'),
        false
    )

    private readonly lnavCourseToSteer = this.consume(
        this.bus.getSubscriber<LNavEvents>().on('lnav_course_to_steer'),
        NULL_LNAV_COURSE
    )

    constructor(private readonly bus: EventBus) {
        super()
    }

    onUpdate(): void {
        if (!this.gpssEnabled.get() || !this.lnavTracking.get()) {
            return
        }

        const courseToSteer = this.lnavCourseToSteer.get()
        if (courseToSteer === null) {
            return
        }

        const magvar = SimVar.GetSimVarValue('MAGVAR', SimVarValueType.Degree)
        let magneticHeading = courseToSteer - magvar
        while (magneticHeading < 0) magneticHeading += 360
        magneticHeading = magneticHeading % 360

        SimVar.SetSimVarValue(
            'AUTOPILOT HEADING LOCK DIR:1',
            SimVarValueType.Degree,
            Math.round(magneticHeading)
        )
    }
}
