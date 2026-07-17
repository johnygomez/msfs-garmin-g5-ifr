import {
    AdcEvents,
    ConsumerSubject,
    EventBus,
    MappedSubject,
    SimVarValueType,
    Subject,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from '../publishers/G5CustomPublisher'

export interface AirspeedSubjects {
    indicatedAirspeed: Subscribable<number>
    trueAirspeed: Subscribable<number>
    refSpeed: Subscribable<number>
    airspeedTrend: Subscribable<number>
}

const TREND_SMOOTH_FACTOR_MS = 2000

const MIN_TREND_SPEED_KT = 20

/**
 * Computes the airspeed data consumed by the PFD airspeed tape and attitude
 * indicator. Speeds and autopilot speed references are consumed reactively from
 * the EventBus; only the acceleration-based trend needs the per-frame
 * {@link onUpdate} tick because it smooths over elapsed time.
 */
export class AirspeedDataProvider {
    private readonly indicatedAirspeed: ConsumerSubject<number>
    private readonly trueAirspeed: ConsumerSubject<number>

    private readonly flcActive: ConsumerSubject<boolean>
    private readonly machHold: ConsumerSubject<boolean>
    private readonly managedSpeedInMach: ConsumerSubject<boolean>
    private readonly machSelected: ConsumerSubject<number>
    private readonly iasSelected: ConsumerSubject<number>

    private readonly refSpeed: MappedSubject<[boolean, boolean, boolean, number, number], number>

    readonly airspeedTrend = Subject.create(0)
    private acceleration = 0
    private lastSpeed: number | null = null

    get subjects(): AirspeedSubjects {
        return {
            indicatedAirspeed: this.indicatedAirspeed,
            trueAirspeed: this.trueAirspeed,
            refSpeed: this.refSpeed,
            airspeedTrend: this.airspeedTrend,
        }
    }

    constructor(bus: EventBus) {
        const adcSub = bus.getSubscriber<AdcEvents>()
        this.indicatedAirspeed = ConsumerSubject.create(adcSub.on('ias'), 0)
        this.trueAirspeed = ConsumerSubject.create(adcSub.on('tas'), 0)

        const g5Sub = bus.getSubscriber<G5CustomEvents>()
        this.flcActive = ConsumerSubject.create(g5Sub.on('ap_flc_active'), false)
        this.machHold = ConsumerSubject.create(g5Sub.on('ap_mach_hold'), false)
        this.managedSpeedInMach = ConsumerSubject.create(
            g5Sub.on('ap_managed_speed_in_mach'),
            false
        )
        this.machSelected = ConsumerSubject.create(g5Sub.on('ap_mach_selected'), 0)
        this.iasSelected = ConsumerSubject.create(g5Sub.on('ap_ias_selected'), 0)

        this.refSpeed = MappedSubject.create<[boolean, boolean, boolean, number, number], number>(
            ([flcActive, machHold, managedInMach, mach, ias], previous) => {
                if (!flcActive && !machHold) return previous ?? 0
                if (machHold || managedInMach) {
                    return SimVar.GetGameVarValue('FROM MACH TO KIAS', SimVarValueType.Number, mach)
                }
                return ias
            },
            this.flcActive,
            this.machHold,
            this.managedSpeedInMach,
            this.machSelected,
            this.iasSelected
        ).pause()
    }

    onUpdate(deltaTime: number): void {
        const speed = this.indicatedAirspeed.get()
        if (isNaN(this.acceleration)) this.acceleration = 0
        if (this.lastSpeed == null) this.lastSpeed = speed

        let instantAcceleration = 0
        if (speed < MIN_TREND_SPEED_KT) {
            this.acceleration = 0
        } else {
            instantAcceleration = (speed - this.lastSpeed) / (deltaTime / 1000)
        }
        this.acceleration =
            (Math.max(TREND_SMOOTH_FACTOR_MS - deltaTime, 0) * this.acceleration +
                Math.min(deltaTime, TREND_SMOOTH_FACTOR_MS) * instantAcceleration) /
            TREND_SMOOTH_FACTOR_MS
        this.lastSpeed = speed
        this.airspeedTrend.set(this.acceleration)
    }

    resume(): void {
        this.refSpeed.resume()
    }

    destroy(): void {
        this.indicatedAirspeed.destroy()
        this.trueAirspeed.destroy()
        this.flcActive.destroy()
        this.machHold.destroy()
        this.managedSpeedInMach.destroy()
        this.machSelected.destroy()
        this.iasSelected.destroy()
        this.refSpeed.destroy()
    }
}
