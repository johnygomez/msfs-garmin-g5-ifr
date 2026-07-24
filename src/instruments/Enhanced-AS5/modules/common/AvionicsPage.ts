import { Subscribable } from '@microsoft/msfs-sdk'

export type PageId = 'PFD' | 'MFD'

export enum KnobValueUnit {
    Degrees = 0,
    Feet = 1,
    InHg = 2,
}

/** Contract each top-level page (PFD/MFD) exposes to the AS5 instrument for event routing. */
export interface AvionicsPage {
    readonly knobValue: Subscribable<number>
    readonly knobUnit: Subscribable<KnobValueUnit>
    readonly isModalOpen: boolean
    onEvent(event: string): void
    closeModals(): void
}
