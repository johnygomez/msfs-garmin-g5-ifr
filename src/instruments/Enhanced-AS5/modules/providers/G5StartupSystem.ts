import {
    AvionicsSystemState,
    AvionicsSystemStateEvent,
    BasicAvionicsSystem,
    DebounceTimer,
    EventBus,
    Subject,
    Subscribable,
    Wait,
} from '@microsoft/msfs-sdk'

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
    private haveUpdatesStarted = false

    constructor(index: number, bus: EventBus, unitOn: Subscribable<boolean>) {
        super(index, bus, 'g5_startup_state')
        this.initializationTime = BOOT_DURATION_MS + ALIGNMENT_DURATION_MS
        this.connectToPower(unitOn)
    }

    onUpdate(): void {
        this.haveUpdatesStarted = true
        super.onUpdate()
    }

    get isBooting(): boolean {
        return this.currentPhase.get() === 'booting'
    }

    /** Defers the first power reading until the publishers have published on the first update. */
    protected onPowerValid(): void {
        void Wait.awaitCondition(() => this.haveUpdatesStarted).then(() => super.onPowerValid())
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
