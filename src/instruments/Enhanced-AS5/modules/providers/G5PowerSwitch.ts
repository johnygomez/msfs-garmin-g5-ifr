import {
    DebounceTimer,
    ElectricalEvents,
    EventBus,
    MappedSubject,
    SubEvent,
    Subject,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { ReactiveProvider } from '../common/Reactive'

const POWER_OFF_DIALOG_DELAY_MS = 500
const POWER_OFF_COUNTDOWN_START = 3
const POWER_OFF_COUNTDOWN_STEP_MS = 800
const MIN_AVIONICS_BUS_VOLTAGE = 10

/**
 * The G5's own on/off state, independent of the avionics bus that feeds it.
 *
 * The unit runs only while the avionics bus is powered and it has not been switched off. Any
 * change of avionics power switches it back on, so it starts with the avionics. The power button
 * switches it on, or off when held through the power-off countdown. A short press of a running unit
 * is reported through {@link shortPressed}.
 */
export class G5PowerSwitch extends ReactiveProvider {
    private readonly switchedOn = Subject.create(true)
    private readonly countdown = Subject.create<number | null>(null)
    private readonly countdownTimer = new DebounceTimer()
    private isPressed = false

    private readonly avionicsPowered: Subscribable<boolean>

    readonly isOn: Subscribable<boolean>
    /** Seconds left until power off while the button is held, or `null` when not counting down. */
    readonly powerOffCountdown: Subscribable<number | null> = this.countdown
    readonly shortPressed = new SubEvent<G5PowerSwitch, void>()

    constructor(bus: EventBus) {
        super()
        const electricalSub = bus.getSubscriber<ElectricalEvents>()
        this.avionicsPowered = this.track(
            MappedSubject.create(
                ([circuitOn, busVoltage]) => circuitOn || busVoltage > MIN_AVIONICS_BUS_VOLTAGE,
                this.consume(electricalSub.on('elec_circuit_avionics_on_1'), false),
                this.consume(electricalSub.on('elec_bus_avionics_v'), 0)
            )
        )
        this.isOn = this.track(
            MappedSubject.create(
                ([powered, switchedOn]) => powered && switchedOn,
                this.avionicsPowered,
                this.switchedOn
            )
        )
        this.live(this.avionicsPowered.sub(() => this.switchUnit(true)))
        this.resume()
    }

    press(): void {
        if (this.isPressed) return

        this.isPressed = true
        if (this.isOn.get()) {
            this.countdownTimer.schedule(
                () => this.countDown(POWER_OFF_COUNTDOWN_START),
                POWER_OFF_DIALOG_DELAY_MS
            )
        } else {
            this.switchUnit(true)
        }
    }

    release(): void {
        if (!this.isPressed) return

        this.isPressed = false
        const isShortPress = this.countdownTimer.isPending() && this.countdown.get() === null
        this.cancelCountdown()
        if (isShortPress) this.shortPressed.notify(this)
    }

    private countDown(remaining: number): void {
        if (remaining === 0) {
            this.isPressed = false
            this.switchUnit(false)
            return
        }

        this.countdown.set(remaining)
        this.countdownTimer.schedule(
            () => this.countDown(remaining - 1),
            POWER_OFF_COUNTDOWN_STEP_MS
        )
    }

    private switchUnit(on: boolean): void {
        this.cancelCountdown()
        this.switchedOn.set(on)
    }

    private cancelCountdown(): void {
        this.countdownTimer.clear()
        this.countdown.set(null)
    }
}
