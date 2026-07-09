import {
    NavSystemElement,
    MapInstrumentElement,
    Annunciations,
    Cabin_Warnings,
    Annunciation_MessageType,
} from './NavSystem'
import { SimVarValueType, Subject } from '@microsoft/msfs-sdk'

export class PFD_VSpeed extends NavSystemElement {
    /** Reactive vertical speed value — can be consumed by a VS display component. */
    vspeedSub = Subject.create(0)

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        this.vspeedSub.set(parseFloat(fastToFixed(Simplane.getVerticalSpeed(), 1)))
    }
    onExit() {}
    onEvent(_event) {}
}
export class DynamicReferenceSpeed {
    XML_KEY_TO_ATTRIBUTE: Map<string, string>
    XML_VALUE_TO_FUNCTION: Map<string, () => number>
    xmlKey: any
    xmlValue: any

    get attribute() {
        if (this.isValid()) {
            return this.XML_KEY_TO_ATTRIBUTE.get(this.xmlKey)
        }
        return ''
    }
    get value() {
        if (this.isValid()) {
            return this.XML_VALUE_TO_FUNCTION.get(this.xmlValue)()
        }
        return 0
    }

    constructor(xmlKey, xmlValue) {
        this.XML_KEY_TO_ATTRIBUTE = new Map([
            ['lowLimit', 'min-speed'],
            ['white_start', 'flaps-begin'],
            ['white_end', 'flaps- end'],
            ['green_start', 'green-begin'],
            ['green_end', 'green-end'],
            ['yellow_start', 'yellow-begin'],
            ['yellow_end', 'yellow-end'],
            ['red_start', 'red-begin'],
            ['red_end', 'red-end'],
            ['highLimit', 'max-speed'],
        ])
        this.XML_VALUE_TO_FUNCTION = new Map([
            ['StallSpeed', Simplane.getStallSpeed],
            ['StallProtectionMaxSpeed', Simplane.getStallProtectionMaxSpeed],
            ['StallProtectionMinSpeed', Simplane.getStallProtectionMinSpeed],
        ])
        this.xmlKey = xmlKey
        this.xmlValue = xmlValue
    }

    isValid() {
        return this.isKeyValid() && this.isValueValid()
    }
    isKeyValid() {
        return this.XML_KEY_TO_ATTRIBUTE.has(this.xmlKey)
    }
    isValueValid() {
        return this.XML_VALUE_TO_FUNCTION.has(this.xmlValue)
    }
}
export class PFD_Airspeed extends NavSystemElement {
    lastIndicatedSpeed: number
    lastTrueSpeed: number
    acceleration: number
    lastSpeed: any
    alwaysDisplaySpeed: boolean
    dynamicReferenceSpeeds: any[]
    speedType: any
    maxSpeed: number
    airspeedElement: Element
    indicatedAirspeedSub = Subject.create(0)
    trueAirspeedSub = Subject.create(0)
    displayRefSpeedSub = Subject.create('False')
    refSpeedMachSub = Subject.create(0)
    refSpeedSub = Subject.create(0)
    airspeedTrendSub = Subject.create(0)
    maxSpeedSub = Subject.create(0)
    displayMachSub = Subject.create(false)
    machSpeedSub = Subject.create(0)

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
                // Dynamic reference speeds are now handled via Subjects published
                // by the data layer and consumed by AirspeedIndicatorComponent.
                // The attribute/value mapping is maintained for compatibility.
            }
        }
    }
}
export interface AltimeterSubjects {
    indicatedAltitude: Subject<number>
    baroPressure: Subject<number>
    verticalSpeed: Subject<number>
    referenceAltitude: Subject<number>
    altitudeAlertState: Subject<string>
    verticalDeviationMode: Subject<string>
    verticalDeviationValue: Subject<number>
}
export class PFD_Altimeter extends NavSystemElement {
    lastAltitude: number
    lastPressure: number
    lastSelectedAltitude: number
    selectedAltWasCaptured: boolean
    blinkTime: number
    alertState: number
    altimeterIndex: number
    readyToSet: boolean
    altitudeType: any
    subjects: AltimeterSubjects | undefined

    constructor(_altitudeType = 'indicatedAltimeter') {
        super()
        this.lastAltitude = -10000
        this.lastPressure = -10000
        this.lastSelectedAltitude = -10000
        this.selectedAltWasCaptured = false
        this.blinkTime = 0
        this.alertState = 0
        this.altimeterIndex = 0
        this.readyToSet = false
        this.altitudeType = _altitudeType
    }

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        if (!this.subjects) return
        let altitude
        if (this.altitudeType == 'indicatedAltimeter') {
            altitude = SimVar.GetSimVarValue(
                'INDICATED ALTITUDE:' + this.altimeterIndex,
                SimVarValueType.Feet
            )
        } else if (this.altitudeType == 'gpsAlt') {
            altitude = SimVar.GetSimVarValue('GPS POSITION ALT', SimVarValueType.Feet)
        }
        const selectedAltitude = SimVar.GetSimVarValue(
            'AUTOPILOT ALTITUDE LOCK VAR',
            SimVarValueType.Feet
        )
        if (altitude != this.lastAltitude) {
            this.subjects.indicatedAltitude.set(altitude)
            this.lastAltitude = altitude
        }
        this.subjects.verticalSpeed.set(Simplane.getVerticalSpeed())
        const altitudeRefActive = true
        if (altitudeRefActive) {
            if (selectedAltitude != this.lastSelectedAltitude) {
                this.subjects.referenceAltitude.set(selectedAltitude)
                this.lastSelectedAltitude = selectedAltitude
                this.selectedAltWasCaptured = false
            }
            if (!this.selectedAltWasCaptured) {
                if (Math.abs(altitude - selectedAltitude) <= 200) {
                    this.selectedAltWasCaptured = true
                    if (this.alertState < 2) {
                        this.blinkTime = 5000
                    }
                    if (this.blinkTime > 0) {
                        this.subjects.altitudeAlertState.set(
                            Math.floor(this.blinkTime / 250) % 2 == 0 ? 'BlueText' : 'Empty'
                        )
                        this.blinkTime -= _deltaTime
                    } else {
                        this.subjects.altitudeAlertState.set('BlueText')
                    }
                } else if (Math.abs(altitude - selectedAltitude) <= 1000) {
                    if (this.alertState < 1) {
                        this.blinkTime = 5000
                    }
                    if (this.blinkTime > 0) {
                        this.subjects.altitudeAlertState.set(
                            Math.floor(this.blinkTime / 250) % 2 == 0
                                ? 'BlueBackground'
                                : 'BlueText'
                        )
                        this.blinkTime -= _deltaTime
                    } else {
                        this.subjects.altitudeAlertState.set('BlueBackground')
                    }
                } else {
                    this.alertState = 0
                    this.subjects.altitudeAlertState.set('BlueText')
                }
            } else {
                if (Math.abs(altitude - selectedAltitude) <= 200) {
                    if (this.alertState != 2) {
                        this.blinkTime = 5000
                        this.alertState = 2
                    }
                    if (this.blinkTime > 0) {
                        this.subjects.altitudeAlertState.set(
                            Math.floor(this.blinkTime / 250) % 2 == 0 ? 'BlueText' : 'Empty'
                        )
                        this.blinkTime -= _deltaTime
                    } else {
                        this.subjects.altitudeAlertState.set('BlueText')
                    }
                } else {
                    if (this.alertState != 3) {
                        this.blinkTime = 5000
                        this.gps.playInstrumentSound('tone_altitude_alert_default')
                        this.alertState = 3
                    }
                    if (this.blinkTime > 0) {
                        this.subjects.altitudeAlertState.set(
                            Math.floor(this.blinkTime / 250) % 2 == 0 ? 'YellowText' : 'Empty'
                        )
                        this.blinkTime -= _deltaTime
                    } else {
                        this.subjects.altitudeAlertState.set('YellowText')
                    }
                }
            }
        } else {
            this.subjects.referenceAltitude.set(0)
            this.subjects.altitudeAlertState.set('BlueText')
        }
        const cdiSource = SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)
            ? 3
            : Simplane.getAutoPilotSelectedNav()
        switch (cdiSource) {
            case 1:
                if (SimVar.GetSimVarValue('NAV HAS GLIDE SLOPE:1', SimVarValueType.Bool)) {
                    this.subjects.verticalDeviationMode.set('GS')
                    this.subjects.verticalDeviationValue.set(
                        SimVar.GetSimVarValue('NAV GSI:1', SimVarValueType.Number) / 127.0
                    )
                } else {
                    this.subjects.verticalDeviationMode.set('None')
                }
                break
            case 2:
                if (SimVar.GetSimVarValue('NAV HAS GLIDE SLOPE:2', SimVarValueType.Bool)) {
                    this.subjects.verticalDeviationMode.set('GS')
                    this.subjects.verticalDeviationValue.set(
                        SimVar.GetSimVarValue('NAV GSI:2', SimVarValueType.Number) / 127.0
                    )
                } else {
                    this.subjects.verticalDeviationMode.set('None')
                }
                break
            case 3:
                if (
                    this.gps.currFlightPlanManager &&
                    this.gps.currFlightPlanManager.isActiveApproach() &&
                    Simplane.getAutoPilotApproachType() == ApproachType.APPROACH_TYPE_RNAV
                ) {
                    this.subjects.verticalDeviationMode.set('GP')
                    this.subjects.verticalDeviationValue.set(
                        SimVar.GetSimVarValue('GPS VERTICAL ERROR', SimVarValueType.Meters) / 150
                    )
                } else if (SimVar.GetSimVarValue('NAV HAS GLIDE SLOPE:1', SimVarValueType.Bool)) {
                    this.subjects.verticalDeviationMode.set('GSPreview')
                    this.subjects.verticalDeviationValue.set(
                        SimVar.GetSimVarValue('NAV GSI:1', SimVarValueType.Number) / 127.0
                    )
                } else {
                    if (SimVar.GetSimVarValue('NAV HAS GLIDE SLOPE:2', SimVarValueType.Bool)) {
                        this.subjects.verticalDeviationMode.set('GSPreview')
                        this.subjects.verticalDeviationValue.set(
                            SimVar.GetSimVarValue('NAV GSI:2', SimVarValueType.Number) / 127.0
                        )
                    } else {
                        this.subjects.verticalDeviationMode.set('None')
                    }
                }
                break
        }
        const rawPressure = SimVar.GetSimVarValue(
            'KOHLSMAN SETTING HG:' + this.altimeterIndex,
            SimVarValueType.InHG
        )
        if (rawPressure != this.lastPressure) {
            this.subjects.baroPressure.set(rawPressure)
            this.lastPressure = rawPressure
        }
    }
    onExit() {}
    onEvent(_event) {
        switch (_event) {
            case 'BARO_INC':
                SimVar.SetSimVarValue('K:KOHLSMAN_INC', SimVarValueType.Number, this.altimeterIndex)
                break
            case 'BARO_DEC':
                SimVar.SetSimVarValue('K:KOHLSMAN_DEC', SimVarValueType.Number, this.altimeterIndex)
                break
        }
    }
}
export class PFD_Attitude extends NavSystemElement {
    vDir: Vec2
    pitchSub = Subject.create(0)
    bankSub = Subject.create(0)
    slipSkidSub = Subject.create(0)
    fdActiveSub = Subject.create(false)
    fdPitchSub = Subject.create(0)
    fdBarkSub = Subject.create(0)
    lowBankModeSub = Subject.create(false)

    constructor() {
        super()
        this.vDir = new Vec2()
    }

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        // Data is published to the EventBus by AhrsPublisher + G5CustomPublisher.
        // Display components read from the bus via ConsumerSubject.
        // Subject fields retained for backward compatibility until Phase F cleanup.
    }
    onExit() {}
    onEvent(_event) {}
}
/** Reactive Subjects for CDI data — consumed by CDIComponent. */
export interface CDISubjects {
    cdiDeviation: Subject<number>
    cdiActive: Subject<boolean>
    cdiScale: Subject<number>
    cdiGpsXtk: Subject<number>
}

export class PFD_CDI extends NavSystemElement {
    cdiDeviationSub = Subject.create(0)
    cdiActiveSub = Subject.create(false)
    cdiScaleSub = Subject.create(5)
    cdiGpsXtkSub = Subject.create(0)

    /** Convenience accessor for external consumers. */
    get subjects(): CDISubjects {
        return {
            cdiDeviation: this.cdiDeviationSub,
            cdiActive: this.cdiActiveSub,
            cdiScale: this.cdiScaleSub,
            cdiGpsXtk: this.cdiGpsXtkSub,
        }
    }

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        this.cdiDeviationSub.set(SimVar.GetSimVarValue('GPS WP CROSS TRK', SimVarValueType.NM))
        this.cdiActiveSub.set(SimVar.GetSimVarValue('HSI CDI NEEDLE VALID', SimVarValueType.Bool))
        this.cdiScaleSub.set(SimVar.GetSimVarValue('GPS CDI SCALING', SimVarValueType.NM))
        this.cdiGpsXtkSub.set(SimVar.GetSimVarValue('GPS WP CROSS TRK', SimVarValueType.NM))
    }
    onExit() {}
    onEvent(_event) {}
}
/** Reactive Subjects for simple compass — consumed by HorizontalCompassComponent. */
export interface SimpleCompassSubjects {
    bearing: Subject<number>
    course: Subject<number>
    courseActive: Subject<boolean>
}

export class PFD_SimpleCompass extends NavSystemElement {
    bearingSub = Subject.create(0)
    courseSub = Subject.create(0)
    courseActiveSub = Subject.create(false)

    get subjects(): SimpleCompassSubjects {
        return {
            bearing: this.bearingSub,
            course: this.courseSub,
            courseActive: this.courseActiveSub,
        }
    }

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        this.bearingSub.set(Simplane.getHeadingMagnetic())
        this.courseSub.set(SimVar.GetSimVarValue('GPS WP DESIRED TRACK', SimVarValueType.Degree))
        this.courseActiveSub.set(
            SimVar.GetSimVarValue('GPS IS ACTIVE FLIGHT PLAN', SimVarValueType.Bool)
        )
    }
    onExit() {}
    onEvent(_event) {}
}
export class PFD_Compass extends NavSystemElement {
    displayArc: boolean
    hasLocBeenEntered: boolean
    hasLocBeenActivated: boolean
    ifTimer: number
    ifIcao: string
    hsiElemId: any
    arcHsiElemId: any
    hsi: any
    arcHsi: any
    nearestAirport: any
    headingSub = Subject.create(0)
    courseSub = Subject.create(0)
    cdiDeviationSub = Subject.create(0)
    bearing1Sub = Subject.create(0)
    bearing2Sub = Subject.create(0)
    dmeDistanceSub = Subject.create(0)
    turnRateSub = Subject.create(0)
    displayArcSub = Subject.create(true)

    set cdiSource(_val) {
        if (this.hsi) this.hsi.logic_cdiSource = _val
    }
    set dmeSource(_val) {
        SimVar.SetSimVarValue('L:Glasscockpit_DmeSource', 'Number', _val)
    }
    get cdiSource() {
        if (this.hsi) return this.hsi.logic_cdiSource
        return 0
    }
    get dmeSource() {
        return SimVar.GetSimVarValue('L:Glasscockpit_DmeSource', 'Number')
    }

    constructor(_hsiElemId = null, _arcHsiElemId = null) {
        super()
        this.displayArc = true
        this.hasLocBeenEntered = false
        this.hasLocBeenActivated = false
        this.ifTimer = 0
        this.ifIcao = ''
        this.hsiElemId = _hsiElemId
        this.arcHsiElemId = _arcHsiElemId
    }

    init(_root) {
        this.hsi = this.gps.getChildById(this.hsiElemId ? this.hsiElemId : 'Compass')
        this.arcHsi = this.gps.getChildById(this.arcHsiElemId ? this.arcHsiElemId : 'ArcCompass')
        this.nearestAirport = new NearestAirportList(this.gps)
        this.displayArc =
            SimVar.GetSimVarValue('L:Glasscockpit_HSI_Arc', SimVarValueType.Number) != 0
        if (this.hsi) {
            this.hsi.init()
        }
        if (this.arcHsi) {
            this.arcHsi.init()
        }
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        this.displayArcSub.set(this.displayArc)
        if (this.displayArc) {
            this.arcHsi.update(_deltaTime)
        } else {
            this.hsi.update(_deltaTime)
        }
        this.nearestAirport.Update(25, 200)
        if (this.nearestAirport.airports.length == 0) {
            SimVar.SetSimVarValue('L:GPS_Current_Phase', SimVarValueType.Number, 4)
        } else {
            SimVar.SetSimVarValue('L:GPS_Current_Phase', SimVarValueType.Number, 3)
        }
        if (this.gps.currFlightPlanManager) {
            if (this.ifTimer <= 0) {
                this.ifTimer = 2000
                if (this.gps.currFlightPlanManager.isActiveApproach()) {
                    this.gps.currFlightPlanManager.getApproachIfIcao(value => {
                        this.ifIcao = value
                    })
                }
            } else {
                this.ifTimer -= this.gps.deltaTime
            }
            if (
                this.gps.currFlightPlanManager.isActiveApproach() &&
                this.gps.currFlightPlanManager.getActiveWaypointIndex() != -1 &&
                Simplane.getAutoPilotApproachType() == ApproachType.APPROACH_TYPE_ILS
            ) {
                const approachWPNb = this.gps.currFlightPlanManager.getApproachWaypoints().length
                const activeWP = this.gps.currFlightPlanManager.getActiveWaypoint()
                if (
                    ((this.ifIcao &&
                        this.ifIcao != '' &&
                        activeWP &&
                        this.ifIcao == activeWP.icao) ||
                        (approachWPNb > 0 &&
                            this.gps.currFlightPlanManager.getActiveWaypointIndex() >=
                                approachWPNb - 2)) &&
                    !this.hasLocBeenEntered
                ) {
                    const approachFrequency =
                        this.gps.currFlightPlanManager.getApproachNavFrequency()
                    if (!isNaN(approachFrequency)) {
                        SimVar.SetSimVarValue('K:NAV1_RADIO_SWAP', SimVarValueType.Number, 0)
                        SimVar.SetSimVarValue(
                            'K:NAV1_RADIO_SET_HZ',
                            'hertz',
                            approachFrequency * 1000000
                        )
                    }
                    this.hasLocBeenEntered = true
                } else {
                    let approachWP
                    const wpIndex = this.gps.currFlightPlanManager.getActiveWaypointIndex() - 1
                    if (wpIndex >= 0 && wpIndex < approachWPNb) {
                        approachWP = this.gps.currFlightPlanManager.getApproachWaypoints()[wpIndex]
                    }
                    if (
                        ((this.ifIcao &&
                            this.ifIcao != '' &&
                            approachWP &&
                            this.ifIcao == approachWP.icao &&
                            this.hasLocBeenEntered) ||
                            (approachWPNb > 0 &&
                                this.gps.currFlightPlanManager.getActiveWaypointIndex() ==
                                    approachWPNb - 1)) &&
                        !this.hasLocBeenActivated
                    ) {
                        if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                            SimVar.SetSimVarValue(
                                'K:TOGGLE_GPS_DRIVES_NAV1',
                                SimVarValueType.Number,
                                0
                            )
                        }
                        Simplane.setAutoPilotSelectedNav(1)
                        this.hasLocBeenActivated = true
                    }
                }
            } else {
                this.hasLocBeenEntered = false
                this.hasLocBeenActivated = false
            }
        }
    }
    onExit() {}
    onEvent(_event) {
        this.hsi.onEvent(_event)
        switch (_event) {
            case 'SoftKeys_HSI_360':
                this.displayArc = false
                this.displayArcSub.set(false)
                SimVar.SetSimVarValue('L:Glasscockpit_HSI_Arc', SimVarValueType.Number, 0)
                break
            case 'SoftKeys_HSI_ARC':
                this.displayArc = true
                this.displayArcSub.set(true)
                SimVar.SetSimVarValue('L:Glasscockpit_HSI_Arc', SimVarValueType.Number, 1)
                break
        }
    }
}
/** Reactive Subjects for navigation status — consumed by NavStatusComponent. */
export interface NavStatusSubjects {
    legFrom: Subject<string>
    legTo: Subject<string>
    legSymbol: Subject<number>
    legDistance: Subject<string>
    legBearing: Subject<string>
}

export class PFD_NavStatus extends NavSystemElement {
    legFromSub = Subject.create('')
    legToSub = Subject.create('')
    legSymbolSub = Subject.create(0)
    legDistanceSub = Subject.create('__._NM')
    legBearingSub = Subject.create('___°')

    private lastLegToName = ''
    private lastLegFromName = ''
    private lastDistanceValue = ''
    private lastBearingValue = ''
    private lastSymbol = 0

    get subjects(): NavStatusSubjects {
        return {
            legFrom: this.legFromSub,
            legTo: this.legToSub,
            legSymbol: this.legSymbolSub,
            legDistance: this.legDistanceSub,
            legBearing: this.legBearingSub,
        }
    }

    init(_root) {
        this.isInitialized = true
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        const flightPlanActive = SimVar.GetSimVarValue(
            'GPS IS ACTIVE FLIGHT PLAN',
            SimVarValueType.Bool
        )
        if (flightPlanActive) {
            let legToName = Simplane.getGPSWpNextID()
            if (!legToName) legToName = '---'
            if (this.lastLegToName !== legToName) {
                this.legToSub.set(legToName.substring(0, 4).toLocaleUpperCase())
                this.lastLegToName = legToName
            }
            if (this.gps.currFlightPlanManager.getIsDirectTo()) {
                if (this.lastSymbol !== 1) {
                    this.legSymbolSub.set(1)
                    this.legFromSub.set('')
                    this.lastSymbol = 1
                }
            } else {
                let legFromName = SimVar.GetSimVarValue('GPS WP PREV ID', SimVarValueType.String)
                if (!legFromName) legFromName = '---'
                if (this.lastLegFromName !== legFromName) {
                    this.legFromSub.set(legFromName.substring(0, 4).toLocaleUpperCase())
                    this.lastLegFromName = legFromName
                }
                if (this.lastSymbol !== 2) {
                    this.legSymbolSub.set(2)
                    this.lastSymbol = 2
                }
            }
            const currentLegDistance =
                fastToFixed(SimVar.GetSimVarValue('GPS WP DISTANCE', 'nautical miles'), 1) + 'NM'
            if (this.lastDistanceValue !== currentLegDistance) {
                this.legDistanceSub.set(currentLegDistance)
                this.lastDistanceValue = currentLegDistance
            }
            const currentLegBearing =
                Math.round(SimVar.GetSimVarValue('GPS WP BEARING', SimVarValueType.Degree)) + '°'
            if (this.lastBearingValue !== currentLegBearing) {
                this.legBearingSub.set(currentLegBearing)
                this.lastBearingValue = currentLegBearing
            }
        } else {
            this.legToSub.set('')
            this.legFromSub.set('')
            this.legSymbolSub.set(0)
            this.legDistanceSub.set('__._NM')
            this.legBearingSub.set('___°')
            this.lastLegToName = ''
            this.lastLegFromName = ''
            this.lastDistanceValue = ''
            this.lastBearingValue = ''
            this.lastSymbol = 0
        }
    }
    onExit() {}
    onEvent(_event) {}
}
export class PFD_XPDR extends NavSystemElement {
    newCode: number[]
    editTime: number
    stateBeforeShutDown: number
    currEdit: number

    /** Reactive Subjects consumed by XPDRComponent. */
    xpdrCodeSub = Subject.create('')
    xpdrModeSub = Subject.create('')
    localTimeSub = Subject.create('')

    private lastCode = ''
    private lastMode = ''
    private lastTime = ''

    constructor() {
        super()
        this.newCode = [-1, -1, -1, -1]
        this.editTime = 0
        this.stateBeforeShutDown = 1
    }

    init(_root) {
        if (SimVar.GetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number) == 0) {
            SimVar.SetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number, 1)
        }
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        const code = this.getCode()
        if (this.lastCode !== code) {
            this.xpdrCodeSub.set(code)
            this.lastCode = code
        }
        let mode = ''
        const currMode = SimVar.GetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number)
        const ident = SimVar.GetSimVarValue('TRANSPONDER IDENT:1', SimVarValueType.Bool)
        if (ident) {
            mode = 'IDNT'
        } else {
            switch (currMode) {
                case 1:
                    mode = 'STBY'
                    break
                case 3:
                    mode = 'ON'
                    break
                case 4:
                    mode = 'ALT'
                    break
            }
        }
        if (this.lastMode !== mode) {
            this.xpdrModeSub.set(mode)
            this.lastMode = mode
        }
        if (this.editTime > 0) {
            this.editTime -= _deltaTime
            if (this.editTime <= 0) {
                this.editTime = 0
            }
        }
        const time = this.getLocalTime()
        if (this.lastTime !== time) {
            this.localTimeSub.set(time)
            this.lastTime = time
        }
    }
    onExit() {}
    onEvent(_event) {
        switch (_event) {
            case 'SoftKeys_XPNDR_IDENT':
                SimVar.SetSimVarValue('K:XPNDR_IDENT_ON', SimVarValueType.Bool, true)
                break
            case 'SoftKeys_XPNDR_BKSP':
                if (this.editTime > 0) {
                    if (this.currEdit > 0) {
                        this.currEdit--
                    }
                } else {
                    const currCode = SimVar.GetSimVarValue(
                        'TRANSPONDER CODE:1',
                        SimVarValueType.Number
                    )
                    this.newCode[0] = Math.floor(currCode / 1000)
                    this.newCode[1] = Math.floor(currCode / 100) % 10
                    this.newCode[2] = Math.floor(currCode / 10) % 10
                    this.currEdit = 3
                }
                this.newCode[this.currEdit] = -1
                this.editTime = 10000
                break
            case 'SoftKeys_XPNDR_VFR':
                this.newCode = [1, 2, 0, 0]
                this.sendNewCode()
                this.editTime = 0
                break
            case 'SoftKeys_XPNDR_STBY':
                SimVar.SetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number, 1)
                break
            case 'SoftKeys_XPNDR_ON':
                SimVar.SetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number, 3)
                break
            case 'SoftKeys_XPNDR_ALT':
                SimVar.SetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number, 4)
                break
            case 'SoftKeys_XPNDR_0':
                this.digitEvent(0)
                break
            case 'SoftKeys_XPNDR_1':
                this.digitEvent(1)
                break
            case 'SoftKeys_XPNDR_2':
                this.digitEvent(2)
                break
            case 'SoftKeys_XPNDR_3':
                this.digitEvent(3)
                break
            case 'SoftKeys_XPNDR_4':
                this.digitEvent(4)
                break
            case 'SoftKeys_XPNDR_5':
                this.digitEvent(5)
                break
            case 'SoftKeys_XPNDR_6':
                this.digitEvent(6)
                break
            case 'SoftKeys_XPNDR_7':
                this.digitEvent(7)
                break
        }
    }

    getCode() {
        if (this.editTime > 0) {
            let displayCode = ''
            for (let i = 0; i < 4; i++) {
                if (this.newCode[i] == -1) {
                    displayCode += '_'
                } else {
                    displayCode += this.newCode[i]
                }
            }
            return displayCode
        } else {
            return (
                '0000' + SimVar.GetSimVarValue('TRANSPONDER CODE:1', SimVarValueType.Number)
            ).slice(-4)
        }
    }
    digitEvent(_number) {
        if (this.editTime <= 0) {
            this.currEdit = 0
            this.newCode = [-1, -1, -1, -1]
        }
        this.newCode[this.currEdit] = _number
        this.currEdit++
        this.editTime = 10000
        if (this.currEdit == 4) {
            this.editTime = 0
            this.sendNewCode()
        }
    }
    sendNewCode() {
        const code =
            this.newCode[0] * 4096 + this.newCode[1] * 256 + this.newCode[2] * 16 + this.newCode[3]
        SimVar.SetSimVarValue('K:XPNDR_SET', 'Frequency BCD16', code)
    }
    getLocalTime() {
        const value = SimVar.GetGlobalVarValue('LOCAL TIME', 'seconds')
        if (value) {
            const seconds = Number.parseInt(value)
            const time = Utils.SecondsToDisplayTime(seconds, true, true, false)
            return time + ''
        }
        return ''
    }
    onShutDown() {
        this.stateBeforeShutDown = SimVar.GetSimVarValue(
            'TRANSPONDER STATE:1',
            SimVarValueType.Number
        )
        if (this.stateBeforeShutDown == 0) {
            this.stateBeforeShutDown = 1
        }
        SimVar.SetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number, 0)
    }
    onPowerOn() {
        const state = SimVar.GetSimVarValue('TRANSPONDER STATE:1', SimVarValueType.Number)
        if (state == 0) {
            SimVar.SetSimVarValue(
                'TRANSPONDER STATE:1',
                SimVarValueType.Number,
                this.stateBeforeShutDown
            )
        }
    }
}
export class PFD_OAT extends NavSystemElement {
    /** Reactive temperature string — consumed by OATComponent. */
    temperatureSub = Subject.create('')
    private lastTemp = ''

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        const celsius = this.getATMTemperatureC()
        if (this.lastTemp !== celsius) {
            this.temperatureSub.set(celsius)
            this.lastTemp = celsius
        }
    }
    onExit() {}
    onEvent(_event) {}

    getATMTemperatureC() {
        const value = SimVar.GetSimVarValue('AMBIENT TEMPERATURE', 'celsius')
        if (value) {
            const degrees = Number.parseInt(value)
            const temperature = degrees + '' + '° C'
            return temperature + ''
        }
        return ''
    }
}
export class PFD_Annunciations extends Annunciations {
    alertSoftkey: any
    isPlayingWarningTone: boolean

    warningToneNameZ: Name_Z
    cautionToneNameZ: Name_Z
    firstAcknowledge: boolean
    newAnnunciations: HTMLElement
    acknowledged: HTMLElement

    /** Reactive Subjects for annunciation HTML — eliminates diffAndSetHTML pattern. */
    newAnnuncHtmlSub = Subject.create('')
    acknowledgedHtmlSub = Subject.create('')
    annunciationsStateSub = Subject.create('Hidden')
    newAnnuncStateSub = Subject.create('None')

    constructor() {
        super()
        this.warningToneNameZ = new Name_Z('tone_warning')
        this.cautionToneNameZ = new Name_Z('tone_caution')
        this.firstAcknowledge = true
    }

    init(_root) {
        super.init(_root)
        this.newAnnunciations = this.gps.getChildById('newAnnunciations')
        this.acknowledged = this.gps.getChildById('acknowledged')
        // Bind reactive Subjects to DOM elements
        this.newAnnuncHtmlSub.sub(html => {
            if (this.newAnnunciations) this.newAnnunciations.innerHTML = html
        }, true)
        this.acknowledgedHtmlSub.sub(html => {
            if (this.acknowledged) this.acknowledged.innerHTML = html
        }, true)
        this.annunciationsStateSub.sub(state => {
            if (this.annunciations) this.annunciations.setAttribute('state', state)
        }, true)
        this.newAnnuncStateSub.sub(state => {
            if (this.newAnnunciations) this.newAnnunciations.setAttribute('state', state)
        }, true)
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        const masterWarningAcknowledged = SimVar.GetSimVarValue(
            'MASTER WARNING ACKNOWLEDGED',
            SimVarValueType.Bool
        )
        const masterCautionAcknowledged = SimVar.GetSimVarValue(
            'MASTER CAUTION ACKNOWLEDGED',
            SimVarValueType.Bool
        )
        for (let i = 0; i < this.allMessages.length; i++) {
            const message = this.allMessages[i]
            let value = false
            if (message.Handler) value = message.Handler()
            if (message.Visible && !message.Acknowledged) {
                if (message.Type == Annunciation_MessageType.CAUTION && masterCautionAcknowledged) {
                    this.needReload = true
                    message.Acknowledged = true
                    if (this.firstAcknowledge && this.isAnnunciationsManager) {
                        if (this.gps.playInstrumentSound('aural_warning_ok'))
                            this.firstAcknowledge = false
                    }
                } else if (
                    message.Type == Annunciation_MessageType.WARNING &&
                    masterWarningAcknowledged
                ) {
                    this.needReload = true
                    message.Acknowledged = true
                }
            }
            if (value != message.Visible) {
                this.needReload = true
                if (!value) {
                    message.Acknowledged = false
                }
                message.Visible = value
            }
        }
        if (this.needReload) {
            let newAnnunc = ''
            let acknowledgedAnnunc = ''
            this.alertLevel = 0
            let warningOn = false
            let cautionOn = false
            this.alert = false
            let warningCount = 0
            let cautionCount = 0
            this.needReload = false
            for (let i = 0; i < this.allMessages.length; i++) {
                const message = this.allMessages[i]
                if (message.Visible) {
                    this.alert = true
                    switch (message.Type) {
                        case Annunciation_MessageType.WARNING:
                            if (!message.Acknowledged) {
                                this.alertLevel = 3
                                warningOn = true
                            }
                            warningCount++
                            break
                        case Annunciation_MessageType.CAUTION:
                            if (!message.Acknowledged) {
                                if (this.alertLevel < 2) {
                                    const res = this.gps.playInstrumentSound('tone_caution')
                                    if (res) {
                                        this.isPlayingWarningTone = true
                                    }
                                    this.alertLevel = 2
                                }
                                cautionOn = true
                            }
                            cautionCount++
                            break
                        case Annunciation_MessageType.ADVISORY:
                            if (!message.Acknowledged && this.alertLevel < 1) {
                                this.alertLevel = 1
                            }
                            break
                    }
                    if (
                        message.Type == Annunciation_MessageType.WARNING ||
                        message.Type == Annunciation_MessageType.CAUTION ||
                        message.Type == Annunciation_MessageType.ADVISORY
                    ) {
                        if (!message.Acknowledged) {
                            newAnnunc += '<div class='
                            switch (message.Type) {
                                case Annunciation_MessageType.WARNING:
                                    newAnnunc += '"Warning"'
                                    break
                                case Annunciation_MessageType.CAUTION:
                                    newAnnunc += '"Caution"'
                                    break
                                case Annunciation_MessageType.ADVISORY:
                                    newAnnunc += '"Advisory"'
                                    break
                            }
                            newAnnunc += '>' + message.Text + '</div><br/>'
                        } else {
                            acknowledgedAnnunc += '<div class='
                            switch (message.Type) {
                                case Annunciation_MessageType.WARNING:
                                    acknowledgedAnnunc += '"Warning"'
                                    break
                                case Annunciation_MessageType.CAUTION:
                                    acknowledgedAnnunc += '"Caution"'
                                    break
                                case Annunciation_MessageType.ADVISORY:
                                    acknowledgedAnnunc += '"Advisory"'
                                    break
                            }
                            acknowledgedAnnunc += '>' + message.Text + '</div><br/>'
                        }
                    }
                }
            }
            if (this.alertSoftkey) {
                switch (this.alertLevel) {
                    case 0:
                        this.alertSoftkey.name = 'ALERTS'
                        break
                    case 1:
                        this.alertSoftkey.name = 'ADVISORY'
                        break
                    case 2:
                        this.alertSoftkey.name = 'CAUTION'
                        break
                    case 3:
                        this.alertSoftkey.name = 'WARNING'
                        break
                }
            }
            this.newAnnuncHtmlSub.set(newAnnunc)
            this.acknowledgedHtmlSub.set(acknowledgedAnnunc)
            if (newAnnunc.length > 0 || acknowledgedAnnunc.length > 0) {
                this.annunciationsStateSub.set('Visible')
                this.alert = true
                if (newAnnunc.length > 0 && acknowledgedAnnunc.length > 0) {
                    this.newAnnuncStateSub.set('Bordered')
                } else {
                    this.newAnnuncStateSub.set('None')
                }
            } else {
                this.annunciationsStateSub.set('Hidden')
            }
            if (this.isAnnunciationsManager) {
                const masterWarningActive = SimVar.GetSimVarValue(
                    'MASTER WARNING ACTIVE',
                    SimVarValueType.Bool
                )
                if (warningCount > 0 != masterWarningActive || warningOn) {
                    SimVar.SetSimVarValue(
                        'K:MASTER_WARNING_SET',
                        SimVarValueType.Bool,
                        warningCount > 0
                    )
                }
                if (warningCount > 0 && !warningOn) {
                    SimVar.SetSimVarValue('K:MASTER_WARNING_ACKNOWLEDGE', SimVarValueType.Bool, 1)
                }
                const masterCautionActive = SimVar.GetSimVarValue(
                    'MASTER CAUTION ACTIVE',
                    SimVarValueType.Bool
                )
                if (cautionCount > 0 != masterCautionActive || cautionOn) {
                    SimVar.SetSimVarValue(
                        'K:MASTER_CAUTION_SET',
                        SimVarValueType.Bool,
                        cautionCount > 0
                    )
                }
                if (cautionCount > 0 && !cautionOn) {
                    SimVar.SetSimVarValue('K:MASTER_CAUTION_ACKNOWLEDGE', SimVarValueType.Bool, 1)
                }
                SimVar.SetSimVarValue(
                    'L:Generic_Master_Warning_Active',
                    SimVarValueType.Bool,
                    warningOn
                )
                SimVar.SetSimVarValue(
                    'L:Generic_Master_Caution_Active',
                    SimVarValueType.Bool,
                    cautionOn
                )
            }
        }
        if (this.alertLevel == 3 && !this.isPlayingWarningTone) {
            const res = this.gps.playInstrumentSound('tone_warning')
            if (res) this.isPlayingWarningTone = true
        }
        if (this.alertSoftkey) {
            if (this.alert) {
                if (this.alertLevel == 0) {
                    this.alertSoftkey.state = 'White'
                } else {
                    if (this.gps.blinkGetState(800, 400)) {
                        switch (this.alertLevel) {
                            case 1:
                                this.alertSoftkey.state = 'AdvisoryAlert'
                                break
                            case 2:
                                this.alertSoftkey.state = 'YellowAlert'
                                break
                            case 3:
                                this.alertSoftkey.state = 'RedAlert'
                                break
                        }
                    } else {
                        this.alertSoftkey.state = 'None'
                    }
                }
            } else {
                this.alertSoftkey.state = 'None'
            }
        }
    }
    onEvent(_event) {
        switch (_event) {
            case 'SoftKeys_ALERT':
                if (this.alertLevel > 0) {
                    SimVar.SetSimVarValue('K:MASTER_WARNING_ACKNOWLEDGE', SimVarValueType.Bool, 1)
                    SimVar.SetSimVarValue('K:MASTER_CAUTION_ACKNOWLEDGE', SimVarValueType.Bool, 1)
                } else {
                    this.gps.computeEvent('Toggle_Alerts')
                }
                break
            case 'Master_Caution_Push':
                SimVar.SetSimVarValue('K:MASTER_CAUTION_ACKNOWLEDGE', SimVarValueType.Bool, 1)
                break
            case 'Master_Warning_Push':
                SimVar.SetSimVarValue('K:MASTER_WARNING_ACKNOWLEDGE', SimVarValueType.Bool, 1)
                break
        }
    }

    onSoundEnd(_eventId) {
        if (
            Name_Z.compare(_eventId, this.warningToneNameZ) ||
            Name_Z.compare(_eventId, this.cautionToneNameZ)
        ) {
            this.isPlayingWarningTone = false
        }
    }
}
export class PFD_ADF_DME extends NavSystemElement {
    rootElement: HTMLElement
    activeAdfFreq: HTMLElement
    stbyAdfFreq: HTMLElement
    adfMode: HTMLElement
    volume: HTMLElement
    dmeMode: HTMLElement
    indicationText: HTMLElement
    HSIElement: any
    adfFreqSearchField: SearchFieldAdfFrequency

    /** Reactive Subjects for display values — eliminates diffAndSetText pattern. */
    activeAdfFreqSub = Subject.create('')
    volumeSub = Subject.create('')
    dmeModeSub = Subject.create('')
    indicationTextSub = Subject.create('')
    rootElementStateSub = Subject.create('Inactive')

    init(_root) {
        this.rootElement = _root
        this.activeAdfFreq = this.gps.getChildById('ActiveAdfFreq')
        this.stbyAdfFreq = this.gps.getChildById('StbyAdfFreq')
        this.adfMode = this.gps.getChildById('adfMode')
        this.volume = this.gps.getChildById('Volume')
        this.dmeMode = this.gps.getChildById('dmeMode')
        this.indicationText = this.gps.getChildById('indicationText')
        this.HSIElement = this.gps.getElementOfType(PFD_Compass)
        this.adfFreqSearchField = new SearchFieldAdfFrequency([this.stbyAdfFreq], this.gps)
        this.defaultSelectables = [
            new SelectableElement(
                this.gps,
                this.stbyAdfFreq,
                this.adfFrequencySelectionCallback.bind(this)
            ),
            new SelectableElement(this.gps, this.dmeMode, this.dfeModeSelectionCallback.bind(this)),
        ]
        // Bind reactive Subjects to DOM elements
        this.activeAdfFreqSub.sub(v => {
            if (this.activeAdfFreq) this.activeAdfFreq.textContent = v
        }, true)
        this.volumeSub.sub(v => {
            if (this.volume) this.volume.textContent = v
        }, true)
        this.dmeModeSub.sub(v => {
            if (this.dmeMode) this.dmeMode.textContent = v
        }, true)
        this.indicationTextSub.sub(v => {
            if (this.indicationText) this.indicationText.textContent = v
        }, true)
        this.rootElementStateSub.sub(state => {
            if (this.rootElement) this.rootElement.setAttribute('state', state)
        }, true)
    }

    onEnter() {
        this.rootElementStateSub.set('Active')
        this.gps.ActiveSelection(this.defaultSelectables)
    }
    onUpdate(_deltaTime) {
        this.adfFreqSearchField.Update()
        this.activeAdfFreqSub.set(
            fastToFixed(SimVar.GetSimVarValue('ADF ACTIVE FREQUENCY:1', 'KHz'), 1)
        )
        this.volumeSub.set('100%')
        if (!this.HSIElement) {
            this.HSIElement = this.gps.getElementOfType(PFD_Compass)
        }
        if (this.HSIElement) {
            switch (this.HSIElement.dmeSource) {
                case 1:
                    this.dmeModeSub.set('NAV1')
                    break
                case 2:
                    this.dmeModeSub.set('NAV2')
                    break
            }
        }
        if (
            this.gps.currentInteractionState == 1 &&
            this.gps.currentSelectableArray == this.defaultSelectables &&
            this.gps.cursorIndex == 0
        ) {
            this.indicationTextSub.set('ENT TO TRANSFER')
        } else {
            this.indicationTextSub.set('')
        }
    }
    onExit() {
        this.rootElementStateSub.set('Inactive')
    }
    onEvent(_event) {}

    adfModeSelectionCallback(_event) {}
    volumeSelectionCallback(_event) {}
    adfFrequencySelectionCallback(_event) {
        switch (_event) {
            case 'NavigationSmallInc':
            case 'NavigationSmallDec':
                this.adfFreqSearchField.StartSearch(this.endAdfFreqEditCallback.bind(this))
                this.gps.currentSearchFieldWaypoint = this.adfFreqSearchField
                this.gps.SwitchToInteractionState(3)
                break
            case 'ENT_Push':
                SimVar.SetSimVarValue('K:ADF1_RADIO_SWAP', SimVarValueType.Number, 0)
        }
    }
    endAdfFreqEditCallback() {
        this.gps.ActiveSelection(this.defaultSelectables)
    }
    dfeModeSelectionCallback(_event) {
        switch (_event) {
            case 'NavigationSmallInc':
                this.HSIElement.dmeSource = (this.HSIElement.dmeSource % 2) + 1
                break
            case 'NavigationSmallDec':
                this.HSIElement.dmeSource--
                if (this.HSIElement.dmeSource == 0) {
                    this.HSIElement.dmeSource = 2
                }
                break
        }
    }
}
export class AS1000_Alerts extends NavSystemElement {
    alert1: HTMLElement
    alert2: HTMLElement
    alert3: HTMLElement
    slider: any
    sliderCursor: any
    alertsGroup: SelectableElementSliderGroup

    /** Reactive window state, bound to the DOM via subscription. */
    alertsWindowStateSub = Subject.create('Inactive')

    init(_root) {
        const alertsWindow = this.gps.getChildById('AlertsWindow')
        this.alert1 = this.gps.getChildById('Alert1')
        this.alert2 = this.gps.getChildById('Alert2')
        this.alert3 = this.gps.getChildById('Alert3')
        this.slider = this.gps.getChildById('Slider')
        this.sliderCursor = this.gps.getChildById('SliderCursor')
        this.alertsGroup = new SelectableElementSliderGroup(
            this.gps,
            [
                new SelectableElement(
                    this.gps,
                    this.alert1,
                    this.alertSelectionCallback.bind(this)
                ),
                new SelectableElement(
                    this.gps,
                    this.alert2,
                    this.alertSelectionCallback.bind(this)
                ),
                new SelectableElement(
                    this.gps,
                    this.alert3,
                    this.alertSelectionCallback.bind(this)
                ),
            ],
            this.slider,
            this.sliderCursor
        )
        this.defaultSelectables = [this.alertsGroup]
        // Bind reactive state to DOM
        this.alertsWindowStateSub.sub(state => {
            if (alertsWindow) alertsWindow.setAttribute('state', state)
        }, true)
    }

    onEnter() {
        this.alertsWindowStateSub.set('Active')
    }
    onUpdate(_deltaTime) {}
    onExit() {
        this.alertsWindowStateSub.set('Inactive')
    }
    onEvent(_event) {}

    alertSelectionCallback() {}
}
export class PFD_WindData extends NavSystemElement {
    mode: number

    /** Reactive Subjects — consumed by WindDataComponent. */
    windModeSub = Subject.create(0)
    windDirectionSub = Subject.create(0)
    windTrueDirectionSub = Subject.create(0)
    windStrengthSub = Subject.create(0)

    constructor() {
        super()
        this.mode = 0
    }

    init(_root) {
        this.mode = SimVar.GetSimVarValue('L:Glasscockpit_Wind_Mode', SimVarValueType.Number)
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        if (SimVar.GetSimVarValue('AMBIENT WIND VELOCITY', SimVarValueType.Knots) >= 1) {
            const windDir = SimVar.GetSimVarValue('AMBIENT WIND DIRECTION', SimVarValueType.Degree)
            this.windModeSub.set(this.mode)
            this.windTrueDirectionSub.set(windDir)
            this.windDirectionSub.set(((windDir + 180) % 360) - Simplane.getHeadingMagnetic())
            this.windStrengthSub.set(
                SimVar.GetSimVarValue('AMBIENT WIND VELOCITY', SimVarValueType.Knots)
            )
        } else {
            this.windModeSub.set(this.mode == 0 ? 0 : 4)
        }
    }
    onExit() {}
    onEvent(_event) {
        switch (_event) {
            case 'SoftKeys_Wind_Off':
            case 'Wind_Off':
                this.mode = 0
                break
            case 'SoftKeys_Wind_O1':
            case 'Wind_O1':
                this.mode = 1
                break
            case 'SoftKeys_Wind_O2':
            case 'Wind_O2':
                this.mode = 2
                break
            case 'SoftKeys_Wind_O3':
            case 'Wind_O3':
                this.mode = 3
                break
        }
        SimVar.SetSimVarValue('L:Glasscockpit_Wind_Mode', SimVarValueType.Number, this.mode)
    }

    getCurrentMode() {
        return this.mode
    }
}
export class MFD_WindData extends NavSystemElement {
    relatedMap: any

    /** Reactive Subjects — consumed by WindDataComponent. */
    windModeSub = Subject.create(0)
    windDirectionSub = Subject.create(0)
    windStrengthSub = Subject.create(0)

    constructor() {
        super()
    }

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        const windStrength = SimVar.GetSimVarValue('AMBIENT WIND VELOCITY', SimVarValueType.Knots)
        if (windStrength >= 1) {
            const wind = parseFloat(
                fastToFixed(
                    ((SimVar.GetSimVarValue('AMBIENT WIND DIRECTION', SimVarValueType.Degree) +
                        SimVar.GetSimVarValue('MAGVAR', 'degrees') +
                        180) %
                        360) -
                        (this.relatedMap ? this.relatedMap.getMapUpDirection() : 0),
                    0
                )
            )
            this.windDirectionSub.set(wind)
            this.windStrengthSub.set(parseFloat(fastToFixed(windStrength, 0)))
            this.windModeSub.set(2)
        } else {
            this.windModeSub.set(4)
        }
    }
    onExit() {}
    onEvent(_event) {}
}
export class PFD_Warnings extends Cabin_Warnings {
    warningBox: HTMLElement
    warningContent: HTMLElement

    init(_root) {
        super.init(_root)
        this.warningBox = this.gps.getChildById('Warnings')
        this.warningContent = this.gps.getChildById('WarningsContent')
    }
}
export class PFD_Minimums extends NavSystemElement {
    private lastSource = 0
    private lastValue = 0
    private wasUpper = false

    /** Reactive Subjects — consumed by MinimumsComponent. */
    windowStateSub = Subject.create('Inactive')
    sourceLabelSub = Subject.create('')
    valueTextSub = Subject.create('')
    bugAltitudeSub = Subject.create('none')
    valueStateSub = Subject.create('')

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        const mode = SimVar.GetSimVarValue('L:AS3000_MinimalsMode', SimVarValueType.Number)
        const value = SimVar.GetSimVarValue('L:AS3000_MinimalsValue', SimVarValueType.Number)
        if (value !== this.lastValue || mode !== this.lastSource) {
            switch (mode) {
                case 0:
                    this.bugAltitudeSub.set('none')
                    this.windowStateSub.set('Inactive')
                    break
                case 1:
                    this.sourceLabelSub.set('BARO MIN')
                    this.valueTextSub.set(value + '')
                    this.bugAltitudeSub.set(value + '')
                    this.windowStateSub.set('Active')
                    break
                case 2:
                    this.sourceLabelSub.set('COMP MIN')
                    this.valueTextSub.set(value + '')
                    this.bugAltitudeSub.set(value + '')
                    this.windowStateSub.set('Active')
                    break
                case 3:
                    this.sourceLabelSub.set('RA MIN')
                    this.valueTextSub.set(value + '')
                    this.windowStateSub.set('Active')
                    break
            }
            this.wasUpper = false
            this.lastSource = mode
            this.lastValue = value
        }
        let state = ''
        switch (mode) {
            case 1:
                const currHeight = SimVar.GetSimVarValue('INDICATED ALTITUDE', SimVarValueType.Feet)
                if (!this.wasUpper || currHeight > value + 100) {
                    state = ''
                    if (!this.wasUpper && currHeight > value + 100) {
                        this.wasUpper = true
                    }
                } else if (currHeight > value) {
                    state = 'near'
                } else {
                    state = 'low'
                }
                break
            case 2:
                break
            case 3:
                const currentBaroAlt = SimVar.GetSimVarValue(
                    'INDICATED ALTITUDE',
                    SimVarValueType.Feet
                )
                const currentRAAlt = SimVar.GetSimVarValue('RADIO HEIGHT', SimVarValueType.Feet)
                this.bugAltitudeSub.set(value + currentBaroAlt - currentRAAlt + '')
                if (!this.wasUpper || currentRAAlt > value + 100) {
                    state = ''
                    if (!this.wasUpper && currentRAAlt > value + 100) {
                        this.wasUpper = true
                    }
                } else if (currentRAAlt > value) {
                    state = 'near'
                } else {
                    state = 'low'
                }
                break
        }
        this.valueStateSub.set(state)
    }
    onExit() {}
    onEvent(_event) {}
}
export class PFD_RadarAltitude extends NavSystemElement {
    /** Reactive Subjects — consumed by RadarAltitudeComponent. */
    radarAltitudeSub = Subject.create(0)
    isActiveSub = Subject.create(false)
    windowStateSub = Subject.create('Inactive')
    displaySub = Subject.create('none')

    constructor() {
        super()
    }

    init(_root) {
        if (this.gps.instrumentXmlConfig) {
            const raElem = this.gps.instrumentXmlConfig.getElementsByTagName('RadarAltitude')
            if (raElem.length > 0) {
                const active = raElem[0].textContent === 'True'
                this.isActiveSub.set(active)
                this.displaySub.set(active ? 'block' : 'none')
            }
        }
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        if (!this.isActiveSub.get()) {
            return
        }
        const xyz = Simplane.getOrientationAxis()
        const radarAltitude = SimVar.GetSimVarValue('RADIO HEIGHT', SimVarValueType.Feet)
        if (radarAltitude > 0 && radarAltitude < 2500 && Math.abs(xyz.bank) < Math.PI * 0.35) {
            this.radarAltitudeSub.set(radarAltitude)
            this.windowStateSub.set('Active')
        } else {
            this.radarAltitudeSub.set(1000)
            this.windowStateSub.set('Inactive')
        }
    }
    onExit() {}
    onEvent(_event) {}
}
export class PFD_MarkerBeacon extends NavSystemElement {
    /** Reactive beacon state — consumed by MarkerBeaconComponent. */
    beaconStateSub = Subject.create('Inactive')

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        const state = SimVar.GetSimVarValue('MARKER BEACON STATE', SimVarValueType.Number)
        switch (state) {
            case 1:
                this.beaconStateSub.set('O')
                break
            case 2:
                this.beaconStateSub.set('M')
                break
            case 3:
                this.beaconStateSub.set('I')
                break
            default:
                this.beaconStateSub.set('Inactive')
                break
        }
    }
    onExit() {}
    onEvent(_event) {}
}
export class PFD_InnerMap extends MapInstrumentElement {
    gpsWasInReversionaryMode: boolean
    mapContainer: HTMLElement

    constructor() {
        super()
        this.gpsWasInReversionaryMode = false
    }

    /** Reactive inset map display style — consumed by the inner map container element. */
    mapDisplaySub = Subject.create('Block')

    init(_root) {
        super.init(_root)
        this.mapContainer = this.gps.getChildById('InnerMap')
        // Bind the Subject to the DOM element reactively
        this.mapDisplaySub.sub(display => {
            if (this.mapContainer) this.mapContainer.style.display = display
        }, true)
    }

    onUpdate(_deltaTime) {
        super.onUpdate(_deltaTime)
        if (this.gps.isInReversionaryMode() != this.gpsWasInReversionaryMode) {
            this.gpsWasInReversionaryMode = this.gps.isInReversionaryMode()
            this.gps.requestCall(() => {
                this.mapDisplaySub.set('Block')
                if (this.instrument) this.instrument.resize()
            })
        }
    }
    onEvent(_event) {
        super.onEvent(_event)
        if (_event == 'SoftKeys_InsetOn') {
            this.mapDisplaySub.set('Block')
        }
        if (_event == 'SoftKeys_InsetOff') {
            this.mapDisplaySub.set('None')
        }
    }
}
export class PFD_AutopilotDisplay extends NavSystemElement {
    apStatusDisplay: number = 0
    yellowFlashBegin: number = 0
    apManualDisconnected: boolean = false

    apStatusSubject = Subject.create<string>('')
    apStatusDisplaySubject = Subject.create<string>('')
    apLateralActiveSubject = Subject.create<string>('')
    apLateralArmedSubject = Subject.create<string>('')
    apVerticalActiveSubject = Subject.create<string>('')
    apModeReferenceSubject = Subject.create<string>('')
    apArmedSubject = Subject.create<string>('')
    apArmedReferenceSubject = Subject.create<string>('')
    apYDStatusSubject = Subject.create<string>('')

    constructor() {
        super()
    }

    init(_root) {}

    onEnter() {}
    onUpdate(_deltaTime) {
        if (SimVar.GetSimVarValue('AUTOPILOT MASTER', SimVarValueType.Bool)) {
            this.apStatusDisplay = 5
            this.apManualDisconnected = false
        } else {
            if (this.apStatusDisplay == 5) {
                setTimeout(() => {
                    if (!this.apManualDisconnected) this.apStatusDisplay = 1
                }, 200)
            }
            if (
                this.apStatusDisplay == 2 &&
                this.yellowFlashBegin + 5 < SimVar.GetSimVarValue('E:ABSOLUTE TIME', 'seconds')
            ) {
                this.apStatusDisplay = 0
            }
        }

        this.apYDStatusSubject.set(
            SimVar.GetSimVarValue('AUTOPILOT YAW DAMPER', SimVarValueType.Bool) ? 'YD' : ''
        )
        this.apStatusSubject.set(this.apStatusDisplay != 0 ? 'AP' : '')
        switch (this.apStatusDisplay) {
            case 1:
                this.apStatusDisplaySubject.set('RedFlash')
                break
            case 2:
                this.apStatusDisplaySubject.set('YellowFlash')
                break
            case 3:
                this.apStatusDisplaySubject.set('Red')
                break
            case 4:
                this.apStatusDisplaySubject.set('Yellow')
                break
            case 0:
            case 5:
            default:
                this.apStatusDisplaySubject.set('')
                break
        }

        if (SimVar.GetSimVarValue('AUTOPILOT PITCH HOLD', SimVarValueType.Bool)) {
            this.apVerticalActiveSubject.set('PIT')
            this.apModeReferenceSubject.set('')
        } else if (SimVar.GetSimVarValue('AUTOPILOT FLIGHT LEVEL CHANGE', SimVarValueType.Bool)) {
            this.apVerticalActiveSubject.set('FLC')
            if (
                SimVar.GetSimVarValue('L:XMLVAR_AirSpeedIsInMach', SimVarValueType.Bool) ||
                SimVar.GetSimVarValue('AUTOPILOT MANAGED SPEED IN MACH', SimVarValueType.Bool)
            ) {
                const refMach = SimVar.GetSimVarValue(
                    'AUTOPILOT MACH HOLD VAR',
                    SimVarValueType.Mach
                )
                this.apModeReferenceSubject.set(
                    'M ' +
                        (refMach < 1 ? fastToFixed(refMach, 3).slice(1) : fastToFixed(refMach, 3))
                )
            } else {
                this.apModeReferenceSubject.set(
                    fastToFixed(
                        SimVar.GetSimVarValue('AUTOPILOT AIRSPEED HOLD VAR', SimVarValueType.Knots),
                        0
                    ) + 'KT'
                )
            }
        } else if (SimVar.GetSimVarValue('AUTOPILOT MACH HOLD', SimVarValueType.Bool)) {
            this.apVerticalActiveSubject.set('FLC')
            const refMach = SimVar.GetSimVarValue('AUTOPILOT MACH HOLD VAR', SimVarValueType.Mach)
            this.apModeReferenceSubject.set(
                'M ' + (refMach < 1 ? fastToFixed(refMach, 3).slice(1) : fastToFixed(refMach, 3))
            )
        } else if (SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('AUTOPILOT ALTITUDE ARM', SimVarValueType.Bool)) {
                this.apVerticalActiveSubject.set('ALTS')
            } else {
                this.apVerticalActiveSubject.set('ALT')
            }
            this.apModeReferenceSubject.set(
                fastToFixed(
                    SimVar.GetSimVarValue('AUTOPILOT ALTITUDE LOCK VAR:2', SimVarValueType.Feet),
                    0
                ) + 'FT'
            )
        } else if (SimVar.GetSimVarValue('AUTOPILOT VERTICAL HOLD', SimVarValueType.Bool)) {
            this.apVerticalActiveSubject.set('VS')
            this.apModeReferenceSubject.set(
                fastToFixed(
                    SimVar.GetSimVarValue('AUTOPILOT VERTICAL HOLD VAR', SimVarValueType.FPM),
                    0
                ) + 'FPM'
            )
        } else if (SimVar.GetSimVarValue('AUTOPILOT GLIDESLOPE ACTIVE', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apVerticalActiveSubject.set('GP')
            } else {
                this.apVerticalActiveSubject.set('GS')
            }
            this.apModeReferenceSubject.set('')
        } else {
            this.apVerticalActiveSubject.set('')
            this.apModeReferenceSubject.set('')
        }

        if (SimVar.GetSimVarValue('AUTOPILOT ALTITUDE ARM', SimVarValueType.Bool)) {
            this.apArmedSubject.set('ALT')
            this.apArmedReferenceSubject.set('')
        } else if (SimVar.GetSimVarValue('AUTOPILOT GLIDESLOPE ARM', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apArmedSubject.set('V ALT')
                this.apArmedReferenceSubject.set('GP')
            } else {
                this.apArmedSubject.set('GS')
                this.apArmedReferenceSubject.set('')
            }
        } else if (SimVar.GetSimVarValue('AUTOPILOT VERTICAL HOLD', SimVarValueType.Bool)) {
            this.apArmedSubject.set('ALTS')
            this.apArmedReferenceSubject.set('')
        } else {
            this.apArmedSubject.set('')
            this.apArmedReferenceSubject.set('')
        }

        if (SimVar.GetSimVarValue('AUTOPILOT WING LEVELER', SimVarValueType.Bool)) {
            this.apLateralActiveSubject.set('LVL')
        } else if (SimVar.GetSimVarValue('AUTOPILOT BANK HOLD', SimVarValueType.Bool)) {
            this.apLateralActiveSubject.set('ROL')
        } else if (SimVar.GetSimVarValue('AUTOPILOT HEADING LOCK', SimVarValueType.Bool)) {
            this.apLateralActiveSubject.set('HDG')
        } else if (SimVar.GetSimVarValue('AUTOPILOT NAV1 LOCK', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apLateralActiveSubject.set('GPS')
            } else {
                if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                    this.apLateralActiveSubject.set('LOC')
                } else {
                    this.apLateralActiveSubject.set('VOR')
                }
            }
        } else if (SimVar.GetSimVarValue('AUTOPILOT BACKCOURSE HOLD', SimVarValueType.Bool)) {
            this.apLateralArmedSubject.set('BC')
        } else if (SimVar.GetSimVarValue('AUTOPILOT APPROACH HOLD', SimVarValueType.Bool)) {
            if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                this.apLateralArmedSubject.set('GPS')
            } else {
                if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                    this.apLateralActiveSubject.set('LOC')
                } else {
                    this.apLateralActiveSubject.set('VOR')
                }
            }
        } else {
            this.apLateralActiveSubject.set('')
        }

        if (
            SimVar.GetSimVarValue('AUTOPILOT HEADING LOCK', SimVarValueType.Bool) ||
            SimVar.GetSimVarValue('AUTOPILOT WING LEVELER', SimVarValueType.Bool)
        ) {
            if (SimVar.GetSimVarValue('AUTOPILOT NAV1 LOCK', SimVarValueType.Bool)) {
                if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                    this.apLateralArmedSubject.set('GPS')
                } else {
                    if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                        this.apLateralArmedSubject.set('LOC')
                    } else {
                        this.apLateralArmedSubject.set('VOR')
                    }
                }
            } else if (SimVar.GetSimVarValue('AUTOPILOT BACKCOURSE HOLD', SimVarValueType.Bool)) {
                this.apLateralArmedSubject.set('BC')
            } else if (SimVar.GetSimVarValue('AUTOPILOT APPROACH HOLD', SimVarValueType.Bool)) {
                if (SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)) {
                    this.apLateralArmedSubject.set('GPS')
                } else {
                    if (Simplane.getAutoPilotNavHasLoc(Simplane.getAutoPilotSelectedNav())) {
                        this.apLateralArmedSubject.set('LOC')
                    } else {
                        this.apLateralArmedSubject.set('VOR')
                    }
                }
            } else {
                this.apLateralArmedSubject.set('')
            }
        } else {
            this.apLateralArmedSubject.set('')
        }
    }
    onExit() {}
    onEvent(_event) {
        switch (_event) {
            case 'Autopilot_Manual_Off':
                this.onManualAutopilotDisconnect()
                break
            case 'Autopilot_Disc':
                if (this.apStatusDisplay != 0) {
                    if (this.apStatusDisplay != 5) {
                        this.apStatusDisplay = 0
                    } else {
                        this.onManualAutopilotDisconnect()
                    }
                }
                break
        }
    }

    onManualAutopilotDisconnect() {
        this.apStatusDisplay = 2
        this.yellowFlashBegin = SimVar.GetSimVarValue('E:ABSOLUTE TIME', 'seconds')
        this.apManualDisconnected = true
    }
}
