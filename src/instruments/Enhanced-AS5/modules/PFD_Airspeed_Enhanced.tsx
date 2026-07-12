import { SimVarValueType, Subject } from '@microsoft/msfs-sdk'

import { NavSystemElement } from './NavSystem'

export class PFD_Airspeed_Enhanced extends NavSystemElement {
    lastIndicatedSpeed: number
    lastTrueSpeed: number
    acceleration: number
    lastSpeed: any
    alwaysDisplaySpeed: boolean
    dynamicReferenceSpeeds: any[]
    speedType: any
    maxSpeed: number
    lastgroundSpeed: number

    indicatedAirspeedSub = Subject.create(0)
    trueAirspeedSub = Subject.create(0)
    groundSpeedSub = Subject.create(0)
    machSpeedSub = Subject.create(0)
    displayRefSpeedSub = Subject.create('False')
    refSpeedMachSub = Subject.create(0)
    refSpeedSub = Subject.create(0)
    airspeedTrendSub = Subject.create(0)
    maxSpeedSub = Subject.create(0)
    displayMachSub = Subject.create(false)
    noTrueAirspeedSub = Subject.create(false)

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
            this.indicatedAirspeedSub.set(indicatedSpeed)
            this.lastIndicatedSpeed = indicatedSpeed
        }
        const groundSpeed = Simplane.getGroundSpeed()
        if (groundSpeed != this.lastgroundSpeed) {
            this.groundSpeedSub.set(groundSpeed)
            this.lastgroundSpeed = groundSpeed
        }

        const trueSpeed = Simplane.getTrueSpeed()
        if (trueSpeed != this.lastTrueSpeed) {
            this.trueAirspeedSub.set(trueSpeed)
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
                this.displayRefSpeedSub.set('Mach')
                const refMach = SimVar.GetSimVarValue(
                    'AUTOPILOT MACH HOLD VAR',
                    SimVarValueType.Mach
                )
                this.refSpeedMachSub.set(refMach)
                this.refSpeedSub.set(
                    SimVar.GetGameVarValue('FROM MACH TO KIAS', SimVarValueType.Number, refMach)
                )
            } else {
                this.displayRefSpeedSub.set('True')
                this.refSpeedSub.set(
                    SimVar.GetSimVarValue('AUTOPILOT AIRSPEED HOLD VAR', SimVarValueType.Knots)
                )
            }
        } else {
            this.displayRefSpeedSub.set('False')
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
        this.airspeedTrendSub.set(this.acceleration)
        let speedMach = -1
        const crossSpeed = SimVar.GetGameVarValue('AIRCRAFT CROSSOVER SPEED', SimVarValueType.Knots)
        if (crossSpeed != 0) {
            const cruiseMach = SimVar.GetGameVarValue('AIRCRAFT CRUISE MACH', SimVarValueType.Mach)
            const crossAltitude = Simplane.getCrossoverAltitude(crossSpeed, cruiseMach)
            const crossSpeedFactor = Simplane.getCrossoverSpeedFactor(crossSpeed, cruiseMach)
            this.maxSpeedSub.set(Math.min(crossSpeedFactor, 1) * this.maxSpeed)
            const mach = Simplane.getMachSpeed()
            const altitude = Simplane.getAltitude()
            if (mach >= cruiseMach && altitude >= crossAltitude) {
                speedMach = mach
            }
        }
        if (speedMach > 0) {
            this.displayMachSub.set(true)
            this.machSpeedSub.set(speedMach)
        } else {
            this.displayMachSub.set(false)
        }
    }
    onExit() {}
    onEvent(_event) {}

    updateDynamicReferenceSpeeds() {
        for (const speed of this.dynamicReferenceSpeeds) {
            if (speed.isValid()) {
                if (speed.attribute === 'airspeed') {
                    this.indicatedAirspeedSub.set(speed.value)
                }
            }
        }
    }
}
