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
const SHUTDOWN_COUNTDOWN_START = 45
const SHUTDOWN_COUNTDOWN_STEP_MS = 1000
const POWER_LOSS_CONFIRM_MS = 500
const MIN_AVIONICS_BUS_VOLTAGE = 10

/**
 * The G5's own on/off state, independent of the avionics bus that feeds it.
 *
 * The unit runs only while it has power and has not been switched off. Restored avionics power
 * switches it back on, so it starts with the avionics. Losing avionics power for longer than a short
 * dip while running keeps it on its backup battery and starts the shutdown countdown, which any key
 * cancels to continue on battery. Switching it off ends battery operation until avionics power returns. The power button
 * switches it on, or off when held through the power-off countdown. A short press of a running
 * unit is reported through {@link shortPressed}.
 */
export class G5PowerSwitch extends ReactiveProvider {
    private readonly switchedOn = Subject.create(true)
    private readonly powerAvailable = Subject.create(false)
    private readonly countdown = Subject.create<number | null>(null)
    private readonly countdownTimer = new DebounceTimer()
    private readonly shutdown = Subject.create<number | null>(null)
    private readonly shutdownTimer = new DebounceTimer()
    private isPressed = false

    private readonly avionicsPowered: Subscribable<boolean>

    readonly isOn: Subscribable<boolean>
    /** Seconds left until power off while the button is held, or `null` when not counting down. */
    readonly powerOffCountdown: Subscribable<number | null> = this.countdown
    /** Seconds left on battery after losing external power, or `null` when not counting down. */
    readonly shutdownCountdown: Subscribable<number | null> = this.shutdown
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
                this.powerAvailable,
                this.switchedOn
            )
        )
        this.live(this.avionicsPowered.sub(powered => this.onAvionicsPowerChanged(powered), true))
        this.resume()
    }

    press(): void {
        if (this.continueOnBattery() || this.isPressed) return

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

    /** Cancels a pending shutdown so the unit keeps running on battery, returning whether one was pending. */
    continueOnBattery(): boolean {
        if (this.shutdown.get() === null) return false

        this.cancelShutdown()
        return true
    }

    private onAvionicsPowerChanged(powered: boolean): void {
        if (powered) {
            this.cancelShutdown()
            this.powerAvailable.set(true)
            this.switchUnit(true)
        } else if (this.isOn.get()) {
            this.shutdownTimer.schedule(
                () => this.shutDown(SHUTDOWN_COUNTDOWN_START),
                POWER_LOSS_CONFIRM_MS
            )
        } else {
            this.powerAvailable.set(false)
        }
    }

    private shutDown(remaining: number): void {
        if (remaining === 0) {
            this.cancelShutdown()
            this.powerAvailable.set(false)
            return
        }

        this.shutdown.set(remaining)
        this.shutdownTimer.schedule(() => this.shutDown(remaining - 1), SHUTDOWN_COUNTDOWN_STEP_MS)
    }

    private countDown(remaining: number): void {
        if (remaining === 0) {
            this.isPressed = false
            this.switchUnit(false)
            this.cancelShutdown()
            this.powerAvailable.set(this.avionicsPowered.get())
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

    private cancelShutdown(): void {
        this.shutdownTimer.clear()
        this.shutdown.set(null)
    }
}
