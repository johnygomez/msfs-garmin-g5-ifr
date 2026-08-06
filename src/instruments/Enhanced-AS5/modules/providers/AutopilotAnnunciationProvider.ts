import { SimVarValueType, Subject } from '@microsoft/msfs-sdk'

import { APDisplayMode, APInfoBarSubjects } from '../pfd/APInfoBar'

export class AutopilotAnnunciationProvider {
    private statusState = 0
    private yellowFlashBegin = 0
    private manualDisconnected = false

    private readonly apStatus = Subject.create('')
    private readonly apStatusDisplay = Subject.create<APDisplayMode>('')
    private readonly apLateralActive = Subject.create('')
    private readonly apLateralArmed = Subject.create('')
    private readonly apVerticalActive = Subject.create('')
    private readonly apModeReference = Subject.create('')
    private readonly apArmed = Subject.create('')
    private readonly apArmedReference = Subject.create('')
    private readonly apYDStatus = Subject.create('')

    get subjects(): APInfoBarSubjects {
        return {
            apStatus: this.apStatus,
            apStatusDisplay: this.apStatusDisplay,
            apLateralActive: this.apLateralActive,
            apLateralArmed: this.apLateralArmed,
            apVerticalActive: this.apVerticalActive,
            apModeReference: this.apModeReference,
            apArmed: this.apArmed,
            apArmedReference: this.apArmedReference,
            apYDStatus: this.apYDStatus,
        }
    }

    onUpdate(): void {
        if (SimVar.GetSimVarValue('AUTOPILOT MASTER', SimVarValueType.Bool)) {
            this.statusState = 5
            this.manualDisconnected = false
        } else {
            if (this.statusState == 5) {
                setTimeout(() => {
                    if (!this.manualDisconnected) this.statusState = 1
                }, 200)
            }
            if (
                this.statusState == 2 &&
                this.yellowFlashBegin + 5 < SimVar.GetSimVarValue('E:ABSOLUTE TIME', 'seconds')
            ) {
                this.statusState = 0
            }
        }

        this.apYDStatus.set(
            SimVar.GetSimVarValue('AUTOPILOT YAW DAMPER', SimVarValueType.Bool) ? 'YD' : ''
        )
        this.apStatus.set(this.statusState != 0 ? 'AP' : '')
        switch (this.statusState) {
            case 1:
                this.apStatusDisplay.set('RedFlash')
                break
            case 2:
                this.apStatusDisplay.set('YellowFlash')
                break
            case 3:
                this.apStatusDisplay.set('Red')
                break
            case 4:
                this.apStatusDisplay.set('Yellow')
                break
            case 0:
            case 5:
            default:
                this.apStatusDisplay.set('')
                break
        }

        if (SimVar.GetSimVarValue('AUTOPILOT PITCH HOLD', SimVarValueType.Bool)) {
            this.apVerticalActive.set('PIT')
            this.apModeReference.set('')
        } else if (SimVar.GetSimVarValue('AUTOPILOT FLIGHT LEVEL CHANGE', SimVarValueType.Bool)) {
            this.apVerticalActive.set('FLC')
            if (
                SimVar.GetSimVarValue('L:XMLVAR_AirSpeedIsInMach', SimVarValueType.Bool) ||
                SimVar.GetSimVarValue('AUTOPILOT MANAGED SPEED IN MACH', SimVarValueType.Bool)
            ) {
                const refMach = SimVar.GetSimVarValue(
                    'AUTOPILOT MACH HOLD VAR',
                    SimVarValueType.Mach
                )
                this.apModeReference.set(
                    'M ' +
                        (refMach < 1 ? fastToFixed(refMach, 3).slice(1) : fastToFixed(refMach, 3))
                )
            } else {
                this.apModeReference.set(
                    fastToFixed(
                        SimVar.GetSimVarValue('AUTOPILOT AIRSPEED HOLD VAR', SimVarValueType.Knots),
                        0
                    ) + 'KT'
                )
            }
        } else if (SimVar.GetSimVarValue('AUTOPILOT MACH HOLD', SimVarValueType.Bool)) {
            this.apVerticalActive.set('FLC')
            const refMach = SimVar.GetSimVarValue('AUTOPILOT MACH HOLD VAR', SimVarValueType.Mach)
            this.apModeReference.set(
                'M ' + (refMach < 1 ? fastToFixed(refMach, 3).slice(1) : fastToFixed(refMach, 3))
            )
        } else if (SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('AUTOPILOT ALTITUDE ARM', SimVarValueType.Bool)) {
                this.apVerticalActive.set('ALTS')
            } else {
                this.apVerticalActive.set('ALT')
            }
            this.apModeReference.set(
                fastToFixed(
                    SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK VAR:2', SimVarValueType.Feet),
                    0
                ) + 'FT'
            )
        } else if (SimVar.GetSimVarValue('AUTOPILOT VERTICAL HOLD', SimVarValueType.Bool)) {
            this.apVerticalActive.set('VS')
            this.apModeReference.set(
                fastToFixed(
                    SimVar.GetSimVarValue('AUTOPILOT VERTICAL HOLD VAR', SimVarValueType.FPM),
                    0
                ) + 'FPM'
            )
        } else if (SimVar.GetSimVarValue('AUTOPILOT GLIDESLOPE ACTIVE', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apVerticalActive.set('GP')
            } else {
                this.apVerticalActive.set('GS')
            }
            this.apModeReference.set('')
        } else {
            this.apVerticalActive.set('')
            this.apModeReference.set('')
        }

        if (SimVar.GetSimVarValue('AUTOPILOT ALTITUDE ARM', SimVarValueType.Bool)) {
            this.apArmed.set('ALT')
            this.apArmedReference.set('')
        } else if (SimVar.GetSimVarValue('AUTOPILOT GLIDESLOPE ARM', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apArmed.set('V ALT')
                this.apArmedReference.set('GP')
            } else {
                this.apArmed.set('GS')
                this.apArmedReference.set('')
            }
        } else if (SimVar.GetSimVarValue('AUTOPILOT VERTICAL HOLD', SimVarValueType.Bool)) {
            this.apArmed.set('ALTS')
            this.apArmedReference.set('')
        } else {
            this.apArmed.set('')
            this.apArmedReference.set('')
        }

        if (SimVar.GetSimVarValue('AUTOPILOT WING LEVELER', SimVarValueType.Bool)) {
            this.apLateralActive.set('LVL')
        } else if (SimVar.GetSimVarValue('AUTOPILOT BANK HOLD', SimVarValueType.Bool)) {
            this.apLateralActive.set('ROL')
        } else if (SimVar.GetSimVarValue('AUTOPILOT HEADING LOCK', SimVarValueType.Bool)) {
            this.apLateralActive.set('HDG')
        } else if (SimVar.GetSimVarValue('AUTOPILOT NAV1 LOCK', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apLateralActive.set('GPS')
            } else {
                if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                    this.apLateralActive.set('LOC')
                } else {
                    this.apLateralActive.set('VOR')
                }
            }
        } else if (SimVar.GetSimVarValue('AUTOPILOT BACKCOURSE HOLD', SimVarValueType.Bool)) {
            this.apLateralArmed.set('BC')
        } else if (SimVar.GetSimVarValue('AUTOPILOT APPROACH HOLD', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apLateralArmed.set('GPS')
            } else {
                if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                    this.apLateralActive.set('LOC')
                } else {
                    this.apLateralActive.set('VOR')
                }
            }
        } else {
            this.apLateralActive.set('')
        }

        if (
            SimVar.GetSimVarValue('AUTOPILOT HEADING LOCK', SimVarValueType.Bool) ||
            SimVar.GetSimVarValue('AUTOPILOT WING LEVELER', SimVarValueType.Bool)
        ) {
            if (SimVar.GetSimVarValue('AUTOPILOT NAV1 LOCK', SimVarValueType.Bool)) {
                if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                    this.apLateralArmed.set('GPS')
                } else {
                    if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                        this.apLateralArmed.set('LOC')
                    } else {
                        this.apLateralArmed.set('VOR')
                    }
                }
            } else if (SimVar.GetSimVarValue('AUTOPILOT BACKCOURSE HOLD', SimVarValueType.Bool)) {
                this.apLateralArmed.set('BC')
            } else if (SimVar.GetSimVarValue('AUTOPILOT APPROACH HOLD', SimVarValueType.Bool)) {
                if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                    this.apLateralArmed.set('GPS')
                } else {
                    if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                        this.apLateralArmed.set('LOC')
                    } else {
                        this.apLateralArmed.set('VOR')
                    }
                }
            } else {
                this.apLateralArmed.set('')
            }
        } else {
            this.apLateralArmed.set('')
        }
    }

    onEvent(event: string): void {
        switch (event) {
            case 'Autopilot_Manual_Off':
                this.onManualAutopilotDisconnect()
                break
            case 'Autopilot_Disc':
                if (this.statusState != 0) {
                    if (this.statusState != 5) {
                        this.statusState = 0
                    } else {
                        this.onManualAutopilotDisconnect()
                    }
                }
                break
        }
    }

    private onManualAutopilotDisconnect(): void {
        this.statusState = 2
        this.yellowFlashBegin = SimVar.GetSimVarValue('E:ABSOLUTE TIME', 'seconds')
        this.manualDisconnected = true
    }
}
