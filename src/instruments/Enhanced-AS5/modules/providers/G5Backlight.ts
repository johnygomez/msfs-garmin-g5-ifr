import {
    EventBus,
    InputAcceleration,
    MappedSubject,
    MathUtils,
    Subject,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { ReactiveProvider } from '../common/Reactive'
import { G5CustomIndexedEvents } from '../publishers/G5CustomPublisher'

const MIN_MANUAL_LEVEL = 1
const MAX_LEVEL = 100
const MANUAL_LEVEL_FAST_STEP = 5
/** Exponent between the perceived level and the emitted light, as used by display brightness. */
const PERCEPTUAL_GAMMA = 2.2

const toIntensity = (percent: number): number => (percent / MAX_LEVEL) ** PERCEPTUAL_GAMMA

const toPercent = (intensity: number): number =>
    MathUtils.clamp(Math.round(intensity ** (1 / PERCEPTUAL_GAMMA) * MAX_LEVEL), 0, MAX_LEVEL)

/**
 * Backlight intensity of the G5 and its backlight page.
 *
 * A short press of the power button opens the page, another one toggles Auto. Turning the knob on
 * the open page sets a manual level, starting from the current auto level, and pressing the knob
 * closes it. The unit powers on in Auto.
 */
export class G5Backlight extends ReactiveProvider {
    private readonly pageOpen = Subject.create(false)
    private readonly manual = Subject.create(false)
    private readonly manualPercent = Subject.create(MAX_LEVEL)
    private readonly autoPercent: Subscribable<number>
    private readonly knobAcceleration = new InputAcceleration({
        increment: 1,
        bigIncrement: MANUAL_LEVEL_FAST_STEP,
    })

    readonly isPageOpen: Subscribable<boolean> = this.pageOpen
    readonly isManual: Subscribable<boolean> = this.manual
    /** Light emitted at the manual level, from 0 to 1. */
    readonly manualIntensity: Subscribable<number>
    /** Perceived backlight level in effect, in percent. */
    readonly level: Subscribable<number>

    constructor(bus: EventBus, instrumentIndex: number, unitOn: Subscribable<boolean>) {
        super()
        const autoLevel = this.consume(
            bus
                .getSubscriber<G5CustomIndexedEvents>()
                .on(`g5_backlight_auto_level_${instrumentIndex}`),
            1
        )
        this.autoPercent = this.track(autoLevel.map(toPercent))
        this.manualIntensity = this.track(this.manualPercent.map(toIntensity))
        this.level = this.track(
            MappedSubject.create(
                ([manual, manualPercent, autoPercent]) => (manual ? manualPercent : autoPercent),
                this.manual,
                this.manualPercent,
                this.autoPercent
            )
        )
        this.live(unitOn.sub(() => this.reset()))
        this.resume()
    }

    pressPowerButton(): void {
        if (this.pageOpen.get()) {
            if (!this.manual.get()) {
                this.manualPercent.set(this.autoPercent.get())
            }
            this.manual.set(!this.manual.get())
        } else {
            this.pageOpen.set(true)
        }
    }

    /** Handles a knob event while the backlight page is open, returning whether it was consumed. */
    handleKnobEvent(event: string): boolean {
        if (!this.pageOpen.get()) return false

        switch (event) {
            case 'Knob_Inc':
            case 'NavigationSmallInc':
                this.adjustLevel(1)
                break
            case 'Knob_Dec':
            case 'NavigationSmallDec':
                this.adjustLevel(-1)
                break
            case 'Knob_Push':
            case 'Knob_Long_Push':
            case 'ENT_Push':
            case 'MENU_Push':
                this.pageOpen.set(false)
                break
        }
        return true
    }

    private adjustLevel(direction: 1 | -1): void {
        const current = this.manual.get() ? this.manualPercent.get() : this.autoPercent.get()
        const step = direction * this.knobAcceleration.doStep()
        this.manual.set(true)
        this.manualPercent.set(MathUtils.clamp(current + step, MIN_MANUAL_LEVEL, MAX_LEVEL))
    }

    private reset(): void {
        this.pageOpen.set(false)
        this.manual.set(false)
    }
}
