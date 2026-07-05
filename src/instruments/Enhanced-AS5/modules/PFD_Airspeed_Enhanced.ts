import { NavSystemElement } from './NavSystem'
import { DynamicReferenceSpeed } from './CommonPFD_MFD'
import { AirspeedIndicator } from './AirspeedIndicator'

export class PFD_Airspeed_Enhanced extends NavSystemElement {
    lastIndicatedSpeed: number
    lastTrueSpeed: number
    acceleration: number
    lastSpeed: any
    alwaysDisplaySpeed: boolean
    dynamicReferenceSpeeds: any[]
    speedType: any
    airspeedElement: HTMLElement
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

    init(_root) {
        this.airspeedElement = this.gps.getChildById('Airspeed')
        const cockpitSettings = SimVar.GetGameVarValue('', 'GlassCockpitSettings')
        const designSpeeds = Simplane.getDesignSpeeds()
        if (cockpitSettings && cockpitSettings.AirSpeed.Initialized) {
            diffAndSetAttribute(
                this.airspeedElement,
                'min-speed',
                cockpitSettings.AirSpeed.lowLimit + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'green-begin',
                cockpitSettings.AirSpeed.greenStart + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'green-end',
                cockpitSettings.AirSpeed.greenEnd + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'flaps-begin',
                cockpitSettings.AirSpeed.whiteStart + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'flaps-end',
                cockpitSettings.AirSpeed.whiteEnd + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'yellow-begin',
                cockpitSettings.AirSpeed.yellowStart + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'yellow-end',
                cockpitSettings.AirSpeed.yellowEnd + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'red-begin',
                cockpitSettings.AirSpeed.redStart + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'red-end',
                cockpitSettings.AirSpeed.redEnd + ''
            )
            diffAndSetAttribute(
                this.airspeedElement,
                'max-speed',
                cockpitSettings.AirSpeed.highLimit + ''
            )
            this.maxSpeed = cockpitSettings.AirSpeed.highLimit
        } else {
            diffAndSetAttribute(this.airspeedElement, 'green-begin', designSpeeds.VS1 + '')
            diffAndSetAttribute(this.airspeedElement, 'green-end', designSpeeds.VNo + '')
            diffAndSetAttribute(this.airspeedElement, 'flaps-begin', designSpeeds.VS0 + '')
            diffAndSetAttribute(this.airspeedElement, 'flaps-end', designSpeeds.VFe + '')
            diffAndSetAttribute(this.airspeedElement, 'yellow-begin', designSpeeds.VNo + '')
            diffAndSetAttribute(this.airspeedElement, 'yellow-end', designSpeeds.VNe + '')
            diffAndSetAttribute(this.airspeedElement, 'red-begin', designSpeeds.VNe + '')
            diffAndSetAttribute(this.airspeedElement, 'red-end', designSpeeds.VMax + '')
            diffAndSetAttribute(this.airspeedElement, 'max-speed', designSpeeds.VNe + '')
            this.maxSpeed = designSpeeds.VNe
        }
        if (designSpeeds) {
            if (isFinite(designSpeeds.Vyse)) {
                diffAndSetAttribute(this.airspeedElement, 'vyse-speed', designSpeeds.Vyse + '')
            }
            if (isFinite(designSpeeds.Vmc)) {
                diffAndSetAttribute(this.airspeedElement, 'vmc-speed', designSpeeds.Vmc + '')
            }
        }
        if (this.gps.instrumentXmlConfig) {
            const autoThrottleElem =
                this.gps.instrumentXmlConfig.getElementsByTagName('AutoThrottle')
            if (autoThrottleElem.length > 0) {
                this.alwaysDisplaySpeed = autoThrottleElem[0].textContent == 'True'
            }
            const dynamicReferenceSpeedElem =
                this.gps.instrumentXmlConfig.getElementsByTagName('DynamicReferenceSpeeds')
            if (dynamicReferenceSpeedElem.length > 0) {
                for (const child of dynamicReferenceSpeedElem[0].children) {
                    const referenceSpeed = new DynamicReferenceSpeed(
                        child.tagName,
                        child.textContent
                    )
                    if (referenceSpeed.isValid()) {
                        this.dynamicReferenceSpeeds.push(referenceSpeed)
                    } else if (child.textContent) {
                        console.warn(
                            "Can not add following dynamic reference speed '" +
                                child.tagName +
                                "': " +
                                (!referenceSpeed.isKeyValid()
                                    ? "TagName '" + child.tagName + "' is not recognized. "
                                    : '') +
                                (!referenceSpeed.isValueValid()
                                    ? "Value '" + child.textContent + "' is not recognized."
                                    : '')
                        )
                    }
                }
            }
        }
    }

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
            SimVar.GetSimVarValue('AUTOPILOT FLIGHT LEVEL CHANGE', 'Boolean') ||
            SimVar.GetSimVarValue('AUTOPILOT MACH HOLD', 'Boolean') ||
            this.alwaysDisplaySpeed
        ) {
            if (
                SimVar.GetSimVarValue('AUTOPILOT MACH HOLD', 'Boolean') ||
                SimVar.GetSimVarValue('AUTOPILOT MANAGED SPEED IN MACH', 'Boolean')
            ) {
                diffAndSetAttribute(this.airspeedElement, 'display-ref-speed', 'Mach')
                const refMach = SimVar.GetSimVarValue('AUTOPILOT MACH HOLD VAR', 'mach')
                diffAndSetAttribute(
                    this.airspeedElement,
                    'ref-speed-mach',
                    'M' + (refMach < 1 ? fastToFixed(refMach, 3).slice(1) : fastToFixed(refMach, 3))
                )
                diffAndSetAttribute(
                    this.airspeedElement,
                    'ref-speed',
                    SimVar.GetGameVarValue('FROM MACH TO KIAS', 'number', refMach)
                )
            } else {
                diffAndSetAttribute(this.airspeedElement, 'display-ref-speed', 'True')
                diffAndSetAttribute(
                    this.airspeedElement,
                    'ref-speed',
                    fastToFixed(SimVar.GetSimVarValue('AUTOPILOT AIRSPEED HOLD VAR', 'knots'), 0)
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
        const crossSpeed = SimVar.GetGameVarValue('AIRCRAFT CROSSOVER SPEED', 'Knots')
        if (crossSpeed != 0) {
            const cruiseMach = SimVar.GetGameVarValue('AIRCRAFT CRUISE MACH', 'mach')
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
        for (const speed of this.dynamicReferenceSpeeds) {
            if (speed.isValid() && this.airspeedElement) {
                if (AirspeedIndicator.observedAttributes.includes(speed.attribute)) {
                    diffAndSetAttribute(this.airspeedElement, speed.attribute, speed.value + '')
                }
            }
        }
    }
}
