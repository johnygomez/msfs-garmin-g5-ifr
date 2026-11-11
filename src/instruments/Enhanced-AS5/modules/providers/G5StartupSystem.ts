import {
    AvionicsSystemState,
    AvionicsSystemStateEvent,
    BasicAvionicsSystem,
    ConsumerSubject,
    DebounceTimer,
    EventBus,
    Subject,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { G5CustomIndexedEvents } from '../publishers/G5CustomPublisher'

export type StartupPhase = 'off' | 'booting' | 'aligning' | 'ready'

export interface G5StartupEvents {
    g5_startup_state: AvionicsSystemStateEvent
}

const BOOT_DURATION_MS = 3000
const ALIGNMENT_DURATION_MS = 8000

/**
 * Boot splash followed by AHRS alignment after the G5 is powered on.
 *
 * Power already present when the flight loads skips straight to ready, as handled by
 * {@link BasicAvionicsSystem}.
 */
export class G5StartupSystem extends BasicAvionicsSystem<G5StartupEvents> {
    private readonly currentPhase = Subject.create<StartupPhase>('off')
    private readonly alignmentTimer = new DebounceTimer()

    readonly phase: Subscribable<StartupPhase> = this.currentPhase
    readonly power: Subscribable<boolean>

    constructor(index: number, bus: EventBus) {
        super(index, bus, 'g5_startup_state')
        this.initializationTime = BOOT_DURATION_MS + ALIGNMENT_DURATION_MS
        this.power = ConsumerSubject.create(
            this.bus.getSubscriber<G5CustomIndexedEvents>().on(`g5_powered_${index}`),
            false
        )

        this.connectToPower(this.power)
    }

    get isBooting(): boolean {
        return this.currentPhase.get() === 'booting'
    }

    protected onStateChanged(
        _previousState: AvionicsSystemState | undefined,
        currentState: AvionicsSystemState
    ): void {
        this.alignmentTimer.clear()
        if (currentState === AvionicsSystemState.Initializing) {
            this.currentPhase.set('booting')
            this.alignmentTimer.schedule(() => this.currentPhase.set('aligning'), BOOT_DURATION_MS)
        } else {
            this.currentPhase.set(currentState === AvionicsSystemState.On ? 'ready' : 'off')
        }
    }
}
