import { NavSystemElement } from './NavSystem'
import { SimVarValueType } from '@microsoft/msfs-sdk'

export class PFD_Airspeed_Enhanced extends NavSystemElement {
    lastIndicatedSpeed: number
    lastTrueSpeed: number
    acceleration: number
    lastSpeed: any
    alwaysDisplaySpeed: boolean
    dynamicReferenceSpeeds: any[]
    speedType: any
    airspeedElement: Element | undefined
    maxSpeed: number
    lastgroundSpeed: number

    constructor(_speedType = 'airspeed') {
        super()
        this.lastIndicatedSpeed = -10000
        this.lastTrueSpeed = -10000
        this.acceleration = 0
        this.lastSpeed = null
        this.alwaysDisplaySpeed = false
        this.dynamicReferenceSpeeds = []
        this.speedType = _speedType
    }

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        if (!this.airspeedElement) return
        if (this.dynamicReferenceSpeeds.length > 0) {
            this.updateDynamicReferenceSpeeds()
        }
        let indicatedSpeed
        if (this.speedType == 'airspeed') {
            indicatedSpeed = Simplane.getIndicatedSpeed()
        } else if (this.speedType == 'gpsSpeed') {
            indicatedSpeed = Simplane.getGroundSpeed()
        }
        if (indicatedSpeed != this.lastIndicatedSpeed) {
            diffAndSetAttribute(this.airspeedElement, 'airspeed', fastToFixed(indicatedSpeed, 1))
            this.lastIndicatedSpeed = indicatedSpeed
        }
        const groundSpeed = Simplane.getGroundSpeed()
        if (groundSpeed != this.lastgroundSpeed) {
            diffAndSetAttribute(this.airspeedElement, 'ground-airspeed', groundSpeed + '')
            this.lastgroundSpeed = groundSpeed
        }

        const trueSpeed = Simplane.getTrueSpeed()
        if (trueSpeed != this.lastTrueSpeed) {
            diffAndSetAttribute(this.airspeedElement, 'true-airspeed', trueSpeed + '')
            this.lastTrueSpeed = trueSpeed
        }
        if (
            SimVar.GetSimVarValue('AUTOPILOT FLIGHT LEVEL CHANGE', SimVarValueType.Bool) ||
            SimVar.GetSimVarValue('AUTOPILOT MACH HOLD', SimVarValueType.Bool) ||
            this.alwaysDisplaySpeed
        ) {
            if (
                SimVar.GetSimVarValue('AUTOPILOT MACH HOLD', SimVarValueType.Bool) ||
                SimVar.GetSimVarValue('AUTOPILOT MANAGED SPEED IN MACH', SimVarValueType.Bool)
            ) {
                diffAndSetAttribute(this.airspeedElement, 'display-ref-speed', 'Mach')
                const refMach = SimVar.GetSimVarValue(
                    'AUTOPILOT MACH HOLD VAR',
                    SimVarValueType.Mach
                )
                diffAndSetAttribute(
                    this.airspeedElement,
                    'ref-speed-mach',
                    'M' + (refMach < 1 ? fastToFixed(refMach, 3).slice(1) : fastToFixed(refMach, 3))
                )
                diffAndSetAttribute(
                    this.airspeedElement,
                    'ref-speed',
                    SimVar.GetGameVarValue('FROM MACH TO KIAS', SimVarValueType.Number, refMach)
                )
            } else {
                diffAndSetAttribute(this.airspeedElement, 'display-ref-speed', 'True')
                diffAndSetAttribute(
                    this.airspeedElement,
                    'ref-speed',
                    fastToFixed(
                        SimVar.GetSimVarValue('AUTOPILOT AIRSPEED HOLD VAR', SimVarValueType.Knots),
                        0
                    )
                )
            }
        } else {
            diffAndSetAttribute(this.airspeedElement, 'display-ref-speed', 'False')
        }
        if (isNaN(this.acceleration)) {
            this.acceleration = 0
        }
        if (this.lastSpeed == null) {
            this.lastSpeed = indicatedSpeed
        }
        let instantAcceleration
        if (indicatedSpeed < 20) {
            instantAcceleration = 0
            this.acceleration = 0
        } else {
            instantAcceleration = (indicatedSpeed - this.lastSpeed) / (_deltaTime / 1000)
        }
        const smoothFactor = 2000
        this.acceleration =
            (Math.max(smoothFactor - _deltaTime, 0) * this.acceleration +
                Math.min(_deltaTime, smoothFactor) * instantAcceleration) /
            smoothFactor
        this.lastSpeed = indicatedSpeed
        diffAndSetAttribute(this.airspeedElement, 'airspeed-trend', this.acceleration + '')
        let speedMach = -1
        const crossSpeed = SimVar.GetGameVarValue('AIRCRAFT CROSSOVER SPEED', SimVarValueType.Knots)
        if (crossSpeed != 0) {
            const cruiseMach = SimVar.GetGameVarValue('AIRCRAFT CRUISE MACH', SimVarValueType.Mach)
            const crossAltitude = Simplane.getCrossoverAltitude(crossSpeed, cruiseMach)
            const crossSpeedFactor = Simplane.getCrossoverSpeedFactor(crossSpeed, cruiseMach)
            diffAndSetAttribute(
                this.airspeedElement,
                'max-speed',
                (Math.min(crossSpeedFactor, 1) * this.maxSpeed).toString()
            )
            const mach = Simplane.getMachSpeed()
            const altitude = Simplane.getAltitude()
            if (mach >= cruiseMach && altitude >= crossAltitude) {
                speedMach = mach
            }
        }
        if (speedMach > 0) {
            diffAndSetAttribute(this.airspeedElement, 'display-mach', 'True')
            diffAndSetAttribute(
                this.airspeedElement,
                'mach-speed',
                'M ' +
                    (speedMach < 1 ? fastToFixed(speedMach, 3).slice(1) : fastToFixed(speedMach, 3))
            )
        } else {
            diffAndSetAttribute(this.airspeedElement, 'display-mach', 'False')
        }
    }
    onExit() {}
    onEvent(_event) {}

    updateDynamicReferenceSpeeds() {
        const validAttrs = ['airspeed', 'airspeed-trend', 'min-speed', 'green-begin', 'green-end', 'flaps-begin', 'flaps-end', 'yellow-begin', 'yellow-end', 'red-begin', 'red-end', 'max-speed', 'true-airspeed', 'no-true-airspeed', 'display-ref-speed', 'ref-speed', 'ref-speed-mach', 'display-mach', 'mach-speed', 'vyse-speed', 'vmc-speed', 'ground-airspeed'];
        for (const speed of this.dynamicReferenceSpeeds) {
            if (speed.isValid() && this.airspeedElement) {
                if (validAttrs.includes(speed.attribute)) {
                    diffAndSetAttribute(this.airspeedElement, speed.attribute, speed.value + '')
                }
            }
        }
    }
}
