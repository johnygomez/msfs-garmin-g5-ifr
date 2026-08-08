import { FmaData, FmaMasterSlotState, GarminAPUtils } from '@microsoft/msfs-garminsdk'
import {
    APAltitudeModes,
    APLateralModes,
    APVerticalModes,
    Consumer,
    ConsumerSubject,
    DebounceTimer,
    EventBus,
    MappedSubject,
    MappedSubscribable,
    Subject,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { resolveNavRadioIndex } from '../common/Nav'
import { ReactiveProvider } from '../common/Reactive'
import { APInfoBarSubjects } from '../pfd/APInfoBar'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import {
    FmaModeSlotSource,
    lateralLabel,
    verticalActiveLabel,
    verticalArmedLabels,
} from './FmaAnnunciations'

const formatMach = (mach: number): string =>
    'M ' + (mach < 1 ? fastToFixed(mach, 3).slice(1) : fastToFixed(mach, 3))

const formatKnots = (knots: number): string => fastToFixed(knots, 0)

const formatFeet = (feet: number): string => fastToFixed(feet, 0)

const formatVerticalSpeed = (fpm: number): string => fastToFixed(fpm, 0)

/** Mirrors the disconnect flash of `FmaMasterSlot`, whose duration the SDK does not export. */
const ANNUNCIATION_LINGER_MS = 5000

const masterSlotState = (engaged: boolean): FmaMasterSlotState =>
    engaged ? FmaMasterSlotState.On : FmaMasterSlotState.Off

export class AutopilotAnnunciationProvider extends ReactiveProvider {
    private readonly inputs: Subscribable<unknown>[] = []

    private readonly lateralSlot = new FmaModeSlotSource()
    private readonly verticalSlot = new FmaModeSlotSource()

    private readonly lateralArmed = Subject.create('')
    private readonly verticalArmedPrimary = Subject.create('')
    private readonly verticalArmedSecondary = Subject.create('')
    private readonly verticalReference = Subject.create('')

    private readonly apState: MappedSubscribable<FmaMasterSlotState>
    private readonly ydState: MappedSubscribable<FmaMasterSlotState>

    private readonly hasAnnunciation = Subject.create(false)
    private readonly annunciationTimer = new DebounceTimer()

    private readonly gpsDrivesNav1: ConsumerSubject<boolean>
    private readonly navSelected: ConsumerSubject<number>
    private readonly nav1HasLoc: ConsumerSubject<boolean>
    private readonly nav2HasLoc: ConsumerSubject<boolean>

    private readonly wingLeveler: ConsumerSubject<boolean>
    private readonly bankHold: ConsumerSubject<boolean>
    private readonly headingHold: ConsumerSubject<boolean>
    private readonly navHold: ConsumerSubject<boolean>
    private readonly backcourseHold: ConsumerSubject<boolean>
    private readonly approachHold: ConsumerSubject<boolean>

    private readonly pitchHold: ConsumerSubject<boolean>
    private readonly flcActive: ConsumerSubject<boolean>
    private readonly machHold: ConsumerSubject<boolean>
    private readonly altitudeHold: ConsumerSubject<boolean>
    private readonly altitudeArm: ConsumerSubject<boolean>
    private readonly verticalSpeedHold: ConsumerSubject<boolean>
    private readonly glideslopeActive: ConsumerSubject<boolean>
    private readonly glideslopeArm: ConsumerSubject<boolean>

    private readonly airspeedInMach: ConsumerSubject<boolean>
    private readonly managedSpeedInMach: ConsumerSubject<boolean>
    private readonly machSelected: ConsumerSubject<number>
    private readonly iasSelected: ConsumerSubject<number>
    private readonly altitudeSelected: ConsumerSubject<number>
    private readonly verticalSpeedSelected: ConsumerSubject<number>

    get subjects(): APInfoBarSubjects {
        return {
            apState: this.apState,
            ydState: this.ydState,
            lateralActive: this.lateralSlot.subject,
            lateralArmed: this.lateralArmed,
            verticalActive: this.verticalSlot.subject,
            verticalArmedPrimary: this.verticalArmedPrimary,
            verticalArmedSecondary: this.verticalArmedSecondary,
            verticalReference: this.verticalReference,
            hasAnnunciation: this.hasAnnunciation,
        }
    }

    constructor(bus: EventBus) {
        super()

        const sub = bus.getSubscriber<G5CustomEvents & G5NavEvents>()

        this.gpsDrivesNav1 = this.watch(sub.on('gps_drives_nav1'), false)
        this.navSelected = this.watch(sub.on('nav_selected'), 0)
        this.nav1HasLoc = this.watch(sub.on('nav1_has_loc'), false)
        this.nav2HasLoc = this.watch(sub.on('nav2_has_loc'), false)

        this.wingLeveler = this.watch(sub.on('ap_wing_leveler'), false)
        this.bankHold = this.watch(sub.on('ap_bank_hold'), false)
        this.headingHold = this.watch(sub.on('ap_heading_hold'), false)
        this.navHold = this.watch(sub.on('ap_nav_hold'), false)
        this.backcourseHold = this.watch(sub.on('ap_backcourse_hold'), false)
        this.approachHold = this.watch(sub.on('ap_appr_hold'), false)

        this.pitchHold = this.watch(sub.on('ap_pitch_hold'), false)
        this.flcActive = this.watch(sub.on('ap_flc_active'), false)
        this.machHold = this.watch(sub.on('ap_mach_hold'), false)
        this.altitudeHold = this.watch(sub.on('ap_altitude_hold'), false)
        this.altitudeArm = this.watch(sub.on('ap_altitude_arm'), false)
        this.verticalSpeedHold = this.watch(sub.on('ap_vs_hold'), false)
        this.glideslopeActive = this.watch(sub.on('ap_glideslope_active'), false)
        this.glideslopeArm = this.watch(sub.on('ap_glideslope_arm'), false)

        this.airspeedInMach = this.watch(sub.on('ap_airspeed_in_mach'), false)
        this.managedSpeedInMach = this.watch(sub.on('ap_managed_speed_in_mach'), false)
        this.machSelected = this.watch(sub.on('ap_mach_selected'), 0)
        this.iasSelected = this.watch(sub.on('ap_ias_selected'), 0)
        this.altitudeSelected = this.watch(sub.on('ap_altitude_selected'), 0)
        this.verticalSpeedSelected = this.watch(sub.on('ap_vs_selected'), 0)

        this.apState = this.track(this.consume(sub.on('ap_master'), false).map(masterSlotState))
        this.ydState = this.track(this.consume(sub.on('ap_yaw_damper'), false).map(masterSlotState))

        const annunciating = this.track(
            MappedSubject.create(
                ([ap, yd, lateral, lateralArmed, vertical, armedPrimary, armedSecondary]) =>
                    ap === FmaMasterSlotState.On ||
                    yd === FmaMasterSlotState.On ||
                    lateral.active !== '' ||
                    lateralArmed !== '' ||
                    vertical.active !== '' ||
                    armedPrimary !== '' ||
                    armedSecondary !== '',
                this.apState,
                this.ydState,
                this.lateralSlot.subject,
                this.lateralArmed,
                this.verticalSlot.subject,
                this.verticalArmedPrimary,
                this.verticalArmedSecondary
            )
        )

        this.live(annunciating.sub(active => this.onAnnunciationChanged(active)))

        for (const input of this.inputs) {
            this.live(input.sub(() => this.annunciate(this.resolve())))
        }
    }

    destroy(): void {
        this.annunciationTimer.clear()
        super.destroy()
    }

    private onAnnunciationChanged(active: boolean): void {
        this.annunciationTimer.clear()

        if (active) {
            this.hasAnnunciation.set(true)
        } else {
            this.annunciationTimer.schedule(
                () => this.hasAnnunciation.set(false),
                ANNUNCIATION_LINGER_MS
            )
        }
    }

    private watch<T>(consumer: Consumer<T>, initial: T): ConsumerSubject<T> {
        const input = this.consume(consumer, initial)
        this.inputs.push(input)
        return input
    }

    private resolve(): FmaData {
        return {
            ...GarminAPUtils.createEmptyFmaData(),
            lateralActive: this.resolveLateralActive(),
            lateralArmed: this.resolveLateralArmed(),
            verticalActive: this.resolveVerticalActive(),
            verticalApproachArmed: this.resolveApproachArmed(),
            verticalAltitudeArmed: this.altitudeArm.get()
                ? APAltitudeModes.ALTS
                : APAltitudeModes.NONE,
            altitudeCaptureArmed: this.altitudeArm.get() && !this.altitudeHold.get(),
        }
    }

    private resolveLateralActive(): APLateralModes {
        if (this.wingLeveler.get()) return APLateralModes.LEVEL
        if (this.bankHold.get()) return APLateralModes.ROLL
        if (this.headingHold.get()) return APLateralModes.HEADING
        return this.resolveCoupledMode()
    }

    private resolveLateralArmed(): APLateralModes {
        const steersItself = this.wingLeveler.get() || this.headingHold.get()
        return steersItself ? this.resolveCoupledMode() : APLateralModes.NONE
    }

    private resolveCoupledMode(): APLateralModes {
        if (this.navHold.get()) return this.navLateralMode()
        if (this.backcourseHold.get()) return APLateralModes.BC
        if (this.approachHold.get()) return this.navLateralMode()
        return APLateralModes.NONE
    }

    private navLateralMode(): APLateralModes {
        if (this.gpsDrivesNav1.get()) return APLateralModes.GPSS
        return this.selectedNavHasLoc() ? APLateralModes.LOC : APLateralModes.VOR
    }

    private selectedNavHasLoc(): boolean {
        return resolveNavRadioIndex(this.navSelected.get()) === 2
            ? this.nav2HasLoc.get()
            : this.nav1HasLoc.get()
    }

    private resolveVerticalActive(): APVerticalModes {
        if (this.pitchHold.get()) return APVerticalModes.PITCH
        if (this.flcActive.get() || this.machHold.get()) return APVerticalModes.FLC
        if (this.altitudeHold.get()) {
            return this.altitudeArm.get() ? APVerticalModes.CAP : APVerticalModes.ALT
        }
        if (this.verticalSpeedHold.get()) return APVerticalModes.VS
        if (this.glideslopeActive.get()) return this.glidepathMode()
        return APVerticalModes.NONE
    }

    private resolveApproachArmed(): APVerticalModes {
        return this.glideslopeArm.get() ? this.glidepathMode() : APVerticalModes.NONE
    }

    private glidepathMode(): APVerticalModes {
        return this.gpsDrivesNav1.get() ? APVerticalModes.GP : APVerticalModes.GS
    }

    private resolveReference(mode: APVerticalModes): string {
        switch (mode) {
            case APVerticalModes.ALT:
            case APVerticalModes.CAP:
                return formatFeet(this.altitudeSelected.get())
            case APVerticalModes.VS:
                return formatVerticalSpeed(this.verticalSpeedSelected.get())
            case APVerticalModes.FLC:
                return this.referenceInMach()
                    ? formatMach(this.machSelected.get())
                    : formatKnots(this.iasSelected.get())
            default:
                return ''
        }
    }

    private referenceInMach(): boolean {
        return this.airspeedInMach.get() || this.managedSpeedInMach.get() || this.machHold.get()
    }

    private annunciate(data: Readonly<FmaData>): void {
        const lateralArmed = lateralLabel(data.lateralArmed)
        this.lateralSlot.update(lateralLabel(data.lateralActive), [lateralArmed])
        this.lateralArmed.set(lateralArmed)

        const verticalArmed = verticalArmedLabels(data)
        this.verticalSlot.update(
            verticalActiveLabel(data.verticalActive, data.verticalAltitudeArmed),
            verticalArmed
        )
        this.verticalArmedPrimary.set(verticalArmed[0] ?? '')
        this.verticalArmedSecondary.set(verticalArmed[1] ?? '')
        this.verticalReference.set(this.resolveReference(data.verticalActive))
    }
}
