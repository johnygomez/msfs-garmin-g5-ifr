import {
    NavSystemElement,
    NavSystemElementContainer,
    MapInstrumentElement,
    EMapDisplayMode,
    SoftKeysMenu,
} from './NavSystem'

export class MFD_FlightPlanLine {
    element: any

    constructor(_element) {
        this.element = _element
    }

    getnbElements() {
        return 1
    }
    getSoftKeyMenu() {
        return null
    }
    getIndex() {
        return -1
    }
    getType() {
        return MFD_WaypointType.empty
    }
}
export class MFD_DepartureLine extends MFD_FlightPlanLine {
    name: any

    constructor(_name, _element) {
        super(_element)
        this.name = ''
        this.name = _name
    }

    onEvent(_subIndex, _event) {
        return false
    }

    getString() {
        return (
            '<td class="Select0 SelectableWhite" colspan="' +
            this.element.nbColumn +
            '">Departure - ' +
            this.name +
            '</td>'
        )
    }
}
export class MFD_ArrivalLine extends MFD_FlightPlanLine {
    name: any

    constructor(_name, _element) {
        super(_element)
        this.name = ''
        this.name = _name
    }

    onEvent(_subIndex, _event) {
        return false
    }

    getString() {
        return (
            '<td class="Select0 SelectableWhite" colspan="' +
            this.element.nbColumn +
            '">Arrival - ' +
            this.name +
            '</td>'
        )
    }
}
export class MFD_ApproachLine extends MFD_FlightPlanLine {
    name: any

    constructor(_name, _element) {
        super(_element)
        this.name = ''
        this.name = _name
    }

    onEvent(_subIndex, _event) {
        switch (_event) {
            case 'CLR':
            case 'CLR_Push':
                this.element.gps.currFlightPlanManager.setApproachIndex(-1)
                break
        }
        return false
    }

    getString() {
        return (
            '<td class="Select0 SelectableWhite" colspan="' +
            this.element.nbColumn +
            '">Approach - ' +
            this.name +
            '</td>'
        )
    }
}
export class MFD_EnrouteLine extends MFD_FlightPlanLine {
    onEvent(_subIndex, _event) {
        return false
    }

    getString() {
        return (
            '<td class="Select0 SelectableWhite" colspan="' +
            this.element.nbColumn +
            '">Enroute</td>'
        )
    }
}
export class MFD_AirwayLine extends MFD_FlightPlanLine {
    onEvent(_subIndex, _event) {
        return false
    }

    getString() {
        return (
            '<td class="Select0 SelectableWhite" colspan="' +
            this.element.nbColumn +
            '">Airway</td>'
        )
    }
}
export enum MFD_WaypointType {
    empty = 0,
    departure = 1,
    enroute = 2,
    arrival = 3,
    approach = 4,
}
export class MFD_WaypointLine extends MFD_FlightPlanLine {
    waypointType: MFD_WaypointType
    softKeys: SoftKeysMenu
    waypoint: any
    index: any

    constructor(waypoint, index, _waypointType, _element) {
        super(_element)
        this.waypointType = MFD_WaypointType.enroute
        this.softKeys = new SoftKeysMenu()
        this.waypoint = waypoint
        this.index = index
        this.waypointType = _waypointType
    }

    onEvent(_subIndex, _event) {
        if (this.element.gps.popUpElement == null) {
            switch (_event) {
                case 'NavigationLargeInc':
                case 'NavigationLargeDec':
                    if (_subIndex === 0 && this.waypoint) {
                        this.element.gps.lastRelevantICAO = this.waypoint.icao
                    }
                    break
                case 'NavigationSmallInc':
                case 'NavigationSmallDec':
                    switch (_subIndex) {
                        case 0:
                            this.element.gps.switchToPopUpPage(
                                this.element.waypointWindow,
                                this.element.onWaypointSelectionEnd.bind(this.element)
                            )
                            this.element.selectedIndex = this.index
                            break
                        case 1:
                            this.element.selectedIndex = this.index
                            this.element.editAltitude(this.waypointType, this.index)
                            break
                    }
                    return true
                case 'CLR':
                case 'CLR_Push':
                    this.element.removeWaypoint(this.index)
                    break
            }
        }
        return false
    }

    getString() {
        if (this.waypoint) {
            const infos = this.waypoint.GetInfos()
            let altitudeConstraint = '_____'
            if (this.waypoint.altitudeinFP !== 0) {
                altitudeConstraint = Math.round(this.waypoint.altitudeinFP) + ''
            }
            return (
                '<td class="Select0 SelectableElement">' +
                (infos.ident != '' ? infos.ident : this.waypoint.ident) +
                '</td><td>' +
                (isNaN(this.waypoint.bearingInFP)
                    ? ''
                    : fastToFixed(this.waypoint.bearingInFP, 0) + '°') +
                '</td><td>' +
                fastToFixed(this.waypoint.distanceInFP, 0) +
                'Nm</td><td class="Select1 SelectableElement altitudeConstraint" altitudeMode="' +
                this.waypoint.altitudeModeinFP +
                '"> ' +
                altitudeConstraint +
                'FT </td>'
            )
        } else if (this.element.emptyLine != '') {
            return this.element.emptyLine
        } else {
            return '<td class="Select0 SelectableElement"></td><td> </td><td> </td><td> </td>'
        }
    }
    getNbElements() {
        return 2
    }
    getSoftKeyMenu() {
        if (this.waypointType == MFD_WaypointType.approach) {
            return null
        } else {
            return this.softKeys
        }
    }
    getIndex() {
        return this.index
    }
    getType() {
        return this.waypointType
    }
}
export class MFD_ApproachWaypointLine extends MFD_FlightPlanLine {
    softKeys: SoftKeysMenu
    waypoint: any
    index: any

    constructor(waypoint, index, _element) {
        super(_element)
        this.softKeys = new SoftKeysMenu()
        this.waypoint = waypoint
        this.index = index
        this.softKeys = null
    }

    onEvent(_subIndex, _event) {
        if (this.element.gps.popUpElement == null) {
            switch (_event) {
                case 'NavigationLargeInc':
                case 'NavigationLargeDec':
                    if (_subIndex === 0 && this.waypoint) {
                        this.element.gps.lastRelevantICAO = this.waypoint.icao
                    }
                    break
                case 'NavigationSmallInc':
                case 'NavigationSmallDec':
                    this.element.gps.switchToPopUpPage(
                        this.element.waypointWindow,
                        this.element.onWaypointSelectionEnd.bind(this.element)
                    )
                    this.element.selectedIndex = this.index
                    return true
                case 'CLR':
                case 'CLR_Push':
                    this.element.removeWaypoint(this.index)
                    break
            }
        }
        return false
    }

    getString() {
        if (this.waypoint) {
            return (
                '<td class="Select0 SelectableElement">' +
                this.waypoint.ident +
                '</td><td>' +
                fastToFixed(this.waypoint.bearingInFP, 0) +
                '°' +
                '</td><td>' +
                fastToFixed(this.waypoint.distanceInFP, 0) +
                'Nm</td><td class="Select1 SelectableElement"> _____FT </td>'
            )
        } else {
            return '<td class="Select0 SelectableElement"></td><td> </td><td> </td><td> </td>'
        }
    }
    getSoftKeyMenu() {
        return this.softKeys
    }
    getIndex() {
        return this.index
    }
    getType() {
        return MFD_WaypointType.approach
    }
}
export class MFD_ActiveFlightPlan_Element extends NavSystemElement {
    lines: any[]
    lineElements: any[]
    lastFplSize: number
    _t: number
    upToDateWaypoints: boolean
    emptyLine: string
    isPopup: boolean
    waypointLineClass: any
    approachWaypointLineClass: any
    nbLine: number
    nbColumn: number
    titleElement: HTMLElement
    CurrentLegArrow: HTMLElement
    fplSelectable: any
    waypointWindow: any
    mapContainer: any
    mapElement: any
    altitudeSearchField: any
    selectedIndex: number

    constructor(
        _waypointLineClass = MFD_WaypointLine,
        _approachWaypointLineClass = MFD_ApproachWaypointLine,
        _nbLine = 11,
        _nbColumn = 4
    ) {
        super()
        this.lines = []
        this.lineElements = []
        this.lastFplSize = 0
        this._t = 0
        this.upToDateWaypoints = false
        this.emptyLine = ''
        this.isPopup = false
        this.waypointLineClass = _waypointLineClass
        this.approachWaypointLineClass = _approachWaypointLineClass
        this.nbLine = _nbLine
        this.nbColumn = _nbColumn
    }

    init(_root) {
        this.titleElement = this.gps.getChildById('AFPL_Name')
        this.CurrentLegArrow = this.gps.getChildById('CurrentLegArrow')
        const selectableElements = []
        for (let i = 1; i <= this.nbLine; i++) {
            this.lineElements.push(_root.getElementsByClassName('L' + i)[0])
            selectableElements.push(
                new SelectableElementGroup(this.gps, this.lineElements[i - 1], [
                    this.fplLineEvent.bind(this),
                    this.fplLineAltitudeEvent.bind(this),
                ])
            )
        }
        this.fplSelectable = new SelectableElementSliderGroup(
            this.gps,
            selectableElements,
            _root.getElementsByClassName('Slider')[0],
            _root.getElementsByClassName('SliderCursor')[0],
            1,
            this.emptyLine
        )
        this.defaultSelectables = [this.fplSelectable]
        this.waypointWindow = new NavSystemElementContainer(
            'Waypoint Information',
            'WaypointsWindows',
            new MFD_Waypoints()
        )
        this.waypointWindow.gps = this.gps
        this.container.defaultMenu = [
            { name: 'Store Flight Plan', callback: () => false, isInactive: () => true },
            { name: 'Invert Flight Plan', callback: () => false, isInactive: () => true },
            {
                name: 'Delete Flight Plan',
                callback: this.removeFlightPlan.bind(this),
                isInactive: () => false,
            },
            { name: 'Remove Departure', callback: () => false, isInactive: () => true },
            { name: 'Remove Arrival', callback: () => false, isInactive: () => true },
            { name: 'Remove Approach', callback: () => false, isInactive: () => true },
            { name: 'Closest Point Of FPL', callback: () => false, isInactive: () => true },
            { name: 'Change Fields', callback: () => false, isInactive: () => true },
            {
                name: 'Activate Leg',
                callback: this.activateLegFromMenu.bind(this),
                isInactive: this.isCurrentlySelectedNotALeg.bind(this),
            },
        ]
        this.mapContainer = _root.getElementsByClassName('Map')[0]
        this.mapElement = this.gps.getElementOfType(MapInstrumentElement)
        this.altitudeSearchField = new SearchFieldAltitude([], this.gps)
    }

    onEnter() {
        this.gps.currFlightPlanManager.updateFlightPlan(() => {
            this.gps.currFlightPlanManager.updateCurrentApproach(this.updateWaypoints.bind(this))
            this.updateAltitudeRoles()
            if (this.mapContainer && this.mapElement) {
                this.mapContainer.appendChild(this.mapElement.instrument)
                this.mapElement.setDisplayMode(EMapDisplayMode.GPS)
                this.mapElement.instrument.setCenteredOnPlane()
            }
        })
    }
    onUpdate(_deltaTime) {
        this._t++
        if (this._t > 30) {
            this.gps.currFlightPlanManager.updateFlightPlan(() => {
                this.gps.currFlightPlanManager.updateCurrentApproach(
                    this.updateWaypoints.bind(this)
                )
                this.updateAltitudeRoles()
            })
            this._t = 0
        }
        diffAndSetText(
            this.titleElement,
            (this.gps.currFlightPlanManager.getWaypointsCount() > 0
                ? this.gps.currFlightPlanManager.getWaypoint(0).infos.ident != ''
                    ? this.gps.currFlightPlanManager.getWaypoint(0).infos.ident
                    : this.gps.currFlightPlanManager.getWaypoint(0).ident
                : '______') +
                '/' +
                (this.gps.currFlightPlanManager.getWaypointsCount() > 1
                    ? this.gps.currFlightPlanManager.getWaypoint(
                          this.gps.currFlightPlanManager.getWaypointsCount() - 1
                      ).infos.ident != ''
                        ? this.gps.currFlightPlanManager.getWaypoint(
                              this.gps.currFlightPlanManager.getWaypointsCount() - 1
                          ).infos.ident
                        : this.gps.currFlightPlanManager.getWaypoint(
                              this.gps.currFlightPlanManager.getWaypointsCount() - 1
                          ).ident
                    : '______')
        )
        if (!this.upToDateWaypoints) {
            this.updateWaypoints()
        }
        if (this.lastFplSize != this.gps.currFlightPlanManager.getWaypointsCount()) {
            this.gps.currFlightPlanManager.updateCurrentApproach(this.updateWaypoints.bind(this))
        } else {
            const strings = this.fplSelectable.getStringElements()
            let different = false
            for (let i = 0; i < this.lines.length; i++) {
                const line = this.lines[i].getString()
                if (line != strings[i]) {
                    different = true
                    strings[i] = line
                }
            }
            if (different) {
                this.fplSelectable.updateDisplay()
            }
        }
        if (this.gps.currFlightPlanManager.getIsDirectTo()) {
            const realIndex = this.getDisplayIndexFromIcao(
                this.gps.currFlightPlanManager.getDirectToTarget().icao
            )
            if (
                realIndex > 0 &&
                realIndex >= this.fplSelectable.getOffset() &&
                realIndex < this.fplSelectable.getOffset() + this.nbLine
            ) {
                const element = this.lineElements[realIndex - this.fplSelectable.getOffset()]
                const x = element.offsetLeft + element.parentElement.clientWidth / 20
                const y = element.offsetTop - element.clientHeight / 1.5
                const lineWidth = element.parentElement.clientWidth / 100
                const lineDistance = element.parentElement.clientWidth / 30
                const headWidth = element.parentElement.clientWidth / 40
                diffAndSetAttribute(
                    this.CurrentLegArrow,
                    'd',
                    'M' +
                        (x - lineDistance - lineWidth) +
                        ' ' +
                        (y - lineWidth / 2) +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y - lineWidth / 2) +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y - lineWidth * 1.5) +
                        ' L' +
                        x +
                        ' ' +
                        y +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y + lineWidth * 1.5) +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y + lineWidth / 2) +
                        ' L' +
                        (x - lineDistance - lineWidth) +
                        ' ' +
                        (y + lineWidth / 2) +
                        'Z'
                )
            } else {
                diffAndSetAttribute(this.CurrentLegArrow, 'd', '')
            }
        } else if (this.gps.currFlightPlanManager) {
            let realIndex
            let lastIndex
            if (this.gps.currFlightPlanManager.isActiveApproach(true)) {
                const index = this.gps.currFlightPlanManager.getApproachActiveWaypointIndex()
                realIndex = this.getDisplayIndexFromFplIndex(index, true)
                if (index == 0) {
                    lastIndex = this.getDisplayIndexFromFplIndex(
                        this.gps.currFlightPlanManager.getWaypointsCount() - 2
                    )
                } else {
                    lastIndex = this.getDisplayIndexFromFplIndex(
                        this.gps.currFlightPlanManager.getApproachActiveWaypointIndex() - 1,
                        true
                    )
                }
            } else {
                realIndex = this.getDisplayIndexFromFplIndex(
                    this.gps.currFlightPlanManager.getActiveWaypointIndex()
                )
                lastIndex = this.getDisplayIndexFromFplIndex(
                    this.gps.currFlightPlanManager.getActiveWaypointIndex() - 1
                )
            }
            if (
                realIndex > 0 &&
                realIndex >= this.fplSelectable.getOffset() &&
                realIndex <= this.fplSelectable.getOffset() + this.nbLine
            ) {
                let x
                let y1
                let y2
                let lineWidth
                let lineDistance
                let headWidth
                if (
                    realIndex == this.fplSelectable.getOffset() ||
                    lastIndex < this.fplSelectable.getOffset()
                ) {
                    const endElement = this.lineElements[realIndex - this.fplSelectable.getOffset()]
                    x = endElement.offsetLeft + endElement.parentElement.clientWidth / 20
                    y1 =
                        endElement.offsetTop -
                        endElement.clientHeight / 1.5 -
                        endElement.clientHeight
                    y2 = endElement.offsetTop - endElement.clientHeight / 1.5
                    lineWidth = endElement.parentElement.clientWidth / 100
                    lineDistance = endElement.parentElement.clientWidth / 30
                    headWidth = endElement.parentElement.clientWidth / 40
                } else if (
                    realIndex == this.fplSelectable.getOffset() + this.nbLine ||
                    lastIndex == this.fplSelectable.getOffset() + this.nbLine - 1
                ) {
                    const beginElement =
                        this.lineElements[lastIndex - this.fplSelectable.getOffset()]
                    x = beginElement.offsetLeft + beginElement.parentElement.clientWidth / 20
                    y1 = beginElement.offsetTop - beginElement.clientHeight / 1.5
                    y2 =
                        beginElement.offsetTop -
                        beginElement.clientHeight / 1.5 +
                        beginElement.clientHeight
                    lineWidth = beginElement.parentElement.clientWidth / 100
                    lineDistance = beginElement.parentElement.clientWidth / 30
                    headWidth = beginElement.parentElement.clientWidth / 40
                } else {
                    const beginElement =
                        this.lineElements[lastIndex - this.fplSelectable.getOffset()]
                    const endElement = this.lineElements[realIndex - this.fplSelectable.getOffset()]
                    x = beginElement.offsetLeft + beginElement.parentElement.clientWidth / 20
                    y1 = beginElement.offsetTop - beginElement.clientHeight / 1.5
                    y2 = endElement.offsetTop - endElement.clientHeight / 1.5
                    lineWidth = beginElement.parentElement.clientWidth / 100
                    lineDistance = beginElement.parentElement.clientWidth / 30
                    headWidth = beginElement.parentElement.clientWidth / 40
                }
                diffAndSetAttribute(
                    this.CurrentLegArrow,
                    'd',
                    'M' +
                        x +
                        ' ' +
                        (y1 - lineWidth / 2) +
                        ' L' +
                        x +
                        ' ' +
                        (y1 + lineWidth / 2) +
                        ' L' +
                        (x - lineDistance) +
                        ' ' +
                        (y1 + lineWidth / 2) +
                        ' L' +
                        (x - lineDistance) +
                        ' ' +
                        (y2 - lineWidth / 2) +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y2 - lineWidth / 2) +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y2 - lineWidth * 1.5) +
                        ' L' +
                        x +
                        ' ' +
                        y2 +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y2 + lineWidth * 1.5) +
                        ' L' +
                        (x - headWidth) +
                        ' ' +
                        (y2 + lineWidth / 2) +
                        ' L' +
                        (x - lineDistance - lineWidth) +
                        ' ' +
                        (y2 + lineWidth / 2) +
                        ' L' +
                        (x - lineDistance - lineWidth) +
                        ' ' +
                        (y1 - lineWidth / 2) +
                        'Z'
                )
            } else {
                diffAndSetAttribute(this.CurrentLegArrow, 'd', '')
            }
        }
        this.altitudeSearchField.Update()
    }
    onExit() {}
    onEvent(_event) {}

    invertFlightPlan() {}
    getDisplayIndexFromFplIndex(_index, _approach = false) {
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lines[i].getIndex() == _index) {
                const isApproachPoint = this.lines[i].getType() == MFD_WaypointType.approach
                if (_approach == isApproachPoint) {
                    return i
                }
            }
        }
    }
    getDisplayIndexFromIcao(_icao) {
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lines[i].getType() != MFD_WaypointType.empty) {
                if (this.lines[i].waypoint.icao == _icao) {
                    return i
                }
            }
        }
        return -1
    }
    getFplIndexFromDisplayIndex(_index) {
        return this.lines[_index].getIndex()
    }
    updateWaypoints() {
        this.upToDateWaypoints = false
        this.lines = []
        const departure = this.gps.currFlightPlanManager.getDepartureWaypointsMap()
        const arrival = this.gps.currFlightPlanManager.getArrivalWaypointsMap()
        const approach = this.gps.currFlightPlanManager.getApproachWaypoints()
        const enroute = this.gps.currFlightPlanManager.getEnRouteWaypoints()
        const origin = this.gps.currFlightPlanManager.getOrigin()
        const destination = this.gps.currFlightPlanManager.getDestination()
        let offsetCount = 0
        if (departure.length > 0) {
            this.lines.push(
                new MFD_DepartureLine(
                    this.gps.currFlightPlanManager.getDeparture()
                        ? this.gps.currFlightPlanManager.getDeparture().name
                        : '',
                    this
                )
            )
            this.lines.push(
                new this.waypointLineClass(
                    this.gps.currFlightPlanManager.getOrigin(),
                    0,
                    MFD_WaypointType.departure,
                    this
                )
            )
            offsetCount++
            for (let i = 0; i < departure.length; i++) {
                this.lines.push(
                    new this.waypointLineClass(
                        departure[i],
                        i + offsetCount,
                        MFD_WaypointType.departure,
                        this
                    )
                )
            }
            offsetCount += this.gps.currFlightPlanManager.getDepartureWaypointsCount()
        }
        if (departure.length > 0 || arrival.length > 0 || (approach && approach.length > 0)) {
            this.lines.push(new MFD_EnrouteLine(this))
        }
        if (departure.length == 0 && origin) {
            this.lines.push(
                new this.waypointLineClass(origin, offsetCount, MFD_WaypointType.enroute, this)
            )
            offsetCount++
        }
        for (let i = 0; i < enroute.length; i++) {
            this.lines.push(
                new this.waypointLineClass(
                    enroute[i],
                    i + offsetCount,
                    MFD_WaypointType.enroute,
                    this
                )
            )
        }
        offsetCount += enroute.length
        if (arrival.length > 0) {
            const arrivalObj = this.gps.currFlightPlanManager.getArrival()
            this.lines.push(
                new MFD_ArrivalLine(
                    arrivalObj ? this.gps.currFlightPlanManager.getArrival().name : '',
                    this
                )
            )
            for (let i = 0; i < arrival.length; i++) {
                this.lines.push(
                    new this.waypointLineClass(
                        arrival[i],
                        i + offsetCount,
                        MFD_WaypointType.arrival,
                        this
                    )
                )
            }
            offsetCount += this.gps.currFlightPlanManager.getArrivalWaypointsCount()
        }
        if (destination) {
            this.lines.push(
                new this.waypointLineClass(destination, offsetCount, MFD_WaypointType.enroute, this)
            )
            offsetCount++
        }
        if (approach && approach.length > 0) {
            const airportApproach = this.gps.currFlightPlanManager.getAirportApproach()
            if (airportApproach) {
                this.lines.push(new MFD_ApproachLine(airportApproach.name, this))
            }
            for (let i = 0; i < approach.length; i++) {
                this.lines.push(new this.approachWaypointLineClass(approach[i], i, this))
            }
        }
        this.lines.push(new this.waypointLineClass(null, offsetCount, MFD_WaypointType.empty, this))
        this.lastFplSize = this.gps.currFlightPlanManager.getWaypointsCount()
        const strings = []
        for (let i = 0; i < this.lines.length; i++) {
            strings.push(this.lines[i].getString())
        }
        this.fplSelectable.setStringElements(strings)
        this.upToDateWaypoints = true
        this.updateAltitudeRoles()
    }
    fplLineEvent(_event, _index) {
        if (!this.gps.popUpElement || this.isPopup) {
            return this.lines[_index].onEvent(0, _event)
        }
    }
    fplLineAltitudeEvent(_event, _index) {
        if (!this.gps.popUpElement || this.isPopup) {
            if (_event === 'NavigationLargeInc' && _index + 1 < this.lines.length) {
                this.lines[_index + 1].onEvent(0, _event)
            }
            if (_event === 'NavigationLargeDec' && _index > 0) {
                this.lines[_index].onEvent(0, _event)
            }
            return this.lines[_index].onEvent(1, _event)
        }
    }
    editAltitude(_type, _index) {
        this.fplSelectable.lockDisplay()
        this.altitudeSearchField.elements = [this.fplSelectable.GetElement()]
        this.gps.currentSearchFieldWaypoint = this.altitudeSearchField
        this.altitudeSearchField.StartSearch(this.onEndAltitudeEdition.bind(this, _type, _index))
        this.gps.SwitchToInteractionState(3)
    }
    onEndAltitudeEdition(_type, _index, _altitude) {
        this.gps.currFlightPlanManager.setWaypointAdditionalData(_index, 'ALTITUDE_MODE', 'Manual')
        this.gps.currFlightPlanManager.setWaypointAltitude(
            _altitude / 3.2808,
            _index,
            this.updateWaypoints.bind(this)
        )
        this.fplSelectable.unlockDisplay()
    }
    updateAltitudeRoles() {
        let maxAltitude = undefined
        for (let i = this.gps.currFlightPlanManager.getWaypointsCount() - 1; i >= 0; i--) {
            const wp = this.gps.currFlightPlanManager.getWaypoint(i)
            if (maxAltitude == undefined || wp.altitudeinFP > maxAltitude) {
                if (wp.altitudeModeinFP == 'Subdued') {
                    this.gps.currFlightPlanManager.setWaypointAdditionalData(
                        i,
                        'ALTITUDE_MODE',
                        'Manual'
                    )
                }
                maxAltitude = wp.altitudeinFP
            }
            if (wp.altitudeinFP < maxAltitude) {
                if (wp.altitudeModeinFP == 'Manual') {
                    this.gps.currFlightPlanManager.setWaypointAdditionalData(
                        i,
                        'ALTITUDE_MODE',
                        'Subdued'
                    )
                }
            }
        }
    }
    onWaypointSelectionEnd() {
        if (this.gps.lastRelevantICAO) {
            this.gps.currFlightPlanManager.addWaypoint(
                this.gps.lastRelevantICAO,
                this.selectedIndex,
                () => {
                    if (!this.gps.popUpElement) {
                        this.updateWaypoints()
                        this.gps.ActiveSelection(this.defaultSelectables)
                        this.fplSelectable.incrementIndex()
                    }
                }
            )
        }
    }
    removeFlightPlan() {
        this.gps.currFlightPlanManager.clearAllFlightPlans()
        this.gps.SwitchToInteractionState(0)
    }
    removeWaypoint(_index) {
        this.gps.currFlightPlanManager.removeWaypoint(_index, true, () => {
            this.updateWaypoints.bind(this)
        })
    }
    getSoftKeysMenu() {
        if (
            this.lines.length > this.fplSelectable.getIndex() &&
            this.gps.currentInteractionState == 1
        ) {
            return this.lines[this.fplSelectable.getIndex()].getSoftKeyMenu()
        } else {
            return null
        }
    }
    activateLegFromMenu() {
        this.activateLeg(this.lines[this.fplSelectable.getIndex()].getIndex())
        this.gps.SwitchToInteractionState(1)
    }
    activateLeg(_index, _approach = false) {
        console.warn('CommonPFD_MFD.ts > Activate leg for index ' + _index)
        if (_approach) {
            const approachWPNb = this.gps.currFlightPlanManager.getApproachWaypoints().length
            if (_index >= 0 && _index < approachWPNb) {
                const approachWP = this.gps.currFlightPlanManager.getApproachWaypoints()[_index]
                if (approachWP) {
                    const icao = approachWP.icao
                    this.gps.currFlightPlanManager.activateApproach(() => {
                        const index = this.gps.currFlightPlanManager
                            .getApproachWaypoints()
                            .findIndex(w => {
                                return w.infos && w.infos.icao === icao
                            })
                        this.gps.currFlightPlanManager.setActiveWaypointIndex(index)
                    })
                }
            }
        } else {
            this.gps.currFlightPlanManager.setActiveWaypointIndex(_index)
        }
    }
    isCurrentlySelectedNotALeg() {
        return this.lines[this.fplSelectable.getIndex()].getType() == MFD_WaypointType.empty
    }
}
export class MFD_Waypoints extends NavSystemElement {
    bearingElement: HTMLElement
    cityElement: HTMLElement
    distanceElement: HTMLElement
    duplicateWaypointsWindow: any
    facilityElement: HTMLElement
    icao: any
    icaoSearchField: any
    identElement: HTMLElement
    latitudeElement: HTMLElement
    longitudeElement: HTMLElement
    mapElement: HTMLElement
    regionElement: HTMLElement
    selectableElements: any[]
    selectedElement: number
    state: number
    symbolElement: HTMLElement
    type: any
    WaypointWindow: HTMLElement
    window: HTMLElement

    constructor() {
        super()
        this.selectedElement = 0
        this.state = 0
    }

    init(_root) {
        this.window = _root
        this.WaypointWindow = this.gps.getChildById('WaypointsWindows')
        this.identElement = this.gps.getChildById('WPTIdent')
        this.symbolElement = this.gps.getChildById('WPTSymbol')
        this.regionElement = this.gps.getChildById('WPTRegion')
        this.facilityElement = this.gps.getChildById('WPTFacility')
        this.cityElement = this.gps.getChildById('WPTCity')
        this.mapElement = this.gps.getChildById('WPTMap')
        this.bearingElement = this.gps.getChildById('WPTBearing')
        this.distanceElement = this.gps.getChildById('WPTDistance')
        this.longitudeElement = this.gps.getChildById('WPTLongitude')
        this.latitudeElement = this.gps.getChildById('WPTLatitude')
        this.selectableElements = []
        this.icaoSearchField = new SearchFieldWaypointICAO(
            this.gps,
            [this.identElement],
            this.gps,
            'AWNV'
        )
        const dup = new MFD_DuplicateWaypoint()
        dup.icaoSearchField = this.icaoSearchField
        this.duplicateWaypointsWindow = new NavSystemElementContainer(
            'Duplicate Waypoints',
            'DuplicateWaypointWindow',
            dup
        )
        this.duplicateWaypointsWindow.setGPS(this.gps)
    }

    onEnter() {
        diffAndSetAttribute(this.window, 'state', 'Active')
        this.ActivateSearchField()
        this.icao = null
        this.type = null
    }
    onUpdate(_deltaTime) {
        for (let i = 0; i < this.selectableElements.length; i++) {
            if (i == this.selectedElement && this.state == 0) {
                this.selectableElements[i].updateSelection(this.gps.blinkGetState(400, 200))
            } else {
                this.selectableElements[i].updateSelection(false)
            }
        }
        this.icaoSearchField.Update()
        const infos = this.icaoSearchField.getUpdatedInfos()
        if (infos && (infos.icao != '' || infos.ident != '')) {
            diffAndSetText(this.facilityElement, infos.name)
            diffAndSetText(this.cityElement, infos.city)
            diffAndSetText(this.regionElement, infos.region)
            const logo = infos.imageFileName()
            if (logo != '') {
                diffAndSetAttribute(
                    this.symbolElement,
                    'src',
                    '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo
                )
            } else {
                diffAndSetAttribute(this.symbolElement, 'src', '' + logo)
            }
            if (infos.coordinates && infos.coordinates.lat && infos.coordinates.long) {
                const bearing = Avionics.Utils.computeGreatCircleHeading(
                    new LatLong(
                        SimVar.GetSimVarValue('GPS POSITION LAT', 'degree latitude'),
                        SimVar.GetSimVarValue('GPS POSITION LON', 'degree longitude')
                    ),
                    infos.coordinates
                )
                const distance = Avionics.Utils.computeGreatCircleDistance(
                    new LatLong(
                        SimVar.GetSimVarValue('GPS POSITION LAT', 'degree latitude'),
                        SimVar.GetSimVarValue('GPS POSITION LON', 'degree longitude')
                    ),
                    infos.coordinates
                )
                diffAndSetText(this.bearingElement, fastToFixed(bearing, 0))
                diffAndSetText(this.distanceElement, fastToFixed(distance, 0))
                diffAndSetText(
                    this.longitudeElement,
                    this.gps.longitudeFormat(infos.coordinates.long)
                )
                diffAndSetText(this.latitudeElement, this.gps.latitudeFormat(infos.coordinates.lat))
            } else {
                diffAndSetText(this.longitudeElement, '')
                diffAndSetText(this.latitudeElement, '')
                diffAndSetText(this.bearingElement, '___')
                diffAndSetText(this.distanceElement, '____')
            }
        } else {
            diffAndSetText(this.identElement, '_____')
            diffAndSetText(this.regionElement, '__________')
            diffAndSetText(this.facilityElement, '______________________')
            diffAndSetText(this.cityElement, '______________________')
        }
    }
    onExit() {
        diffAndSetAttribute(this.window, 'state', 'Inactive')
        this.gps.lastRelevantICAO = this.icao
        this.gps.lastRelevantICAOType = this.type
    }
    onEvent(_event) {
        switch (_event) {
            case 'CLR':
                this.gps.requestCall(() => {
                    this.gps.closePopUpElement()
                })
                break
        }
    }

    ActivateSearchField() {
        this.gps.currentSearchFieldWaypoint = this.icaoSearchField
        this.icaoSearchField.StartSearch(this.onEndSearch.bind(this))
        this.gps.SwitchToInteractionState(3)
    }
    onEndSearch() {
        if (this.icaoSearchField.duplicates.length > 1) {
            this.gps.switchToPopUpPage(this.duplicateWaypointsWindow, this.gps.popUpCloseCallback)
        } else {
            this.icao = this.icaoSearchField.getWaypoint().icao
            this.type = this.icaoSearchField.getWaypoint().type
            this.gps.closePopUpElement()
        }
    }
}
export class MFD_DuplicateWaypoint extends NavSystemElement {
    bearing: number
    distance: number
    elementSelectionGroup: any
    icao: string
    icaoSearchField: any
    ident: string
    lat: number
    long: number
    nameElement: HTMLElement
    type: string
    window: HTMLElement

    init(_root) {
        this.window = _root
        const lines = []
        for (let i = 1; i <= 5; i++) {
            lines.push(
                new SelectableElement(
                    this.gps,
                    _root.getElementsByClassName('L' + i)[0],
                    this.selectionEventCallback.bind(this)
                )
            )
        }
        const slider = _root.getElementsByClassName('Slider')[0]
        const sliderCursor = slider.getElementsByClassName('SliderCursor')[0]
        this.elementSelectionGroup = new SelectableElementSliderGroup(
            this.gps,
            lines,
            slider,
            sliderCursor
        )
        this.defaultSelectables = [this.elementSelectionGroup]
        this.ident = _root.getElementsByClassName('Ident')[0]
        this.nameElement = _root.getElementsByClassName('Name')[0]
        this.lat = _root.getElementsByClassName('Latitude')[0]
        this.long = _root.getElementsByClassName('Longitude')[0]
        this.bearing = _root.getElementsByClassName('Bearing')[0]
        this.distance = _root.getElementsByClassName('Distance')[0]
    }

    onEnter() {
        this.icao = null
        this.type = null
        diffAndSetAttribute(this.window, 'State', 'Active')
        this.gps.ActiveSelection(this.defaultSelectables)
    }
    onUpdate(_deltaTime) {
        diffAndSetText(this.ident, this.icaoSearchField.duplicates[0].ident)
        const strings = []
        for (let i = 0; i < this.icaoSearchField.duplicates.length; i++) {
            const infos = this.icaoSearchField.duplicates[i].GetInfos()
            const logo = infos.imageFileName()
            let type = ''
            const typeLetter = infos.getWaypointType()
            switch (typeLetter) {
                case 'A':
                    type = 'AIRPT'
                    break
                case 'N':
                    type = 'NDB'
                    break
                case 'V':
                    type = 'VOR'
                    break
                default:
                    type = 'INT'
                    break
            }
            strings.push(
                '<div>' +
                    type +
                    '</div><img src="' +
                    (logo == '' ? '' : '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo) +
                    '"></img><div>' +
                    infos.region +
                    '</div>'
            )
        }
        this.elementSelectionGroup.setStringElements(strings)
        const info =
            this.icaoSearchField.duplicates[this.elementSelectionGroup.getIndex()].GetInfos()
        if (info && info.icao != '') {
            diffAndSetText(this.nameElement, info.name)
            if (info.coordinates) {
                diffAndSetText(this.lat, this.gps.latitudeFormat(info.coordinates.lat))
                diffAndSetText(this.long, this.gps.longitudeFormat(info.coordinates.long))
                if (info.coordinates.lat && info.coordinates.long) {
                    const bearing = Avionics.Utils.computeGreatCircleHeading(
                        new LatLong(
                            SimVar.GetSimVarValue('GPS POSITION LAT', 'degree latitude'),
                            SimVar.GetSimVarValue('GPS POSITION LON', 'degree longitude')
                        ),
                        info.coordinates
                    )
                    const distance = Avionics.Utils.computeGreatCircleDistance(
                        new LatLong(
                            SimVar.GetSimVarValue('GPS POSITION LAT', 'degree latitude'),
                            SimVar.GetSimVarValue('GPS POSITION LON', 'degree longitude')
                        ),
                        info.coordinates
                    )
                    diffAndSetText(this.bearing, fastToFixed(bearing, 0) + '°')
                    diffAndSetText(this.distance, fastToFixed(distance, 0) + 'NM')
                }
            }
        }
    }
    onExit() {
        this.gps.lastRelevantICAO = this.icao
        this.gps.lastRelevantICAOType = this.type
        diffAndSetAttribute(this.window, 'State', 'Inactive')
    }
    onEvent(_event) {}

    selectionEventCallback(_event, _index) {
        if (_event == 'ENT_Push') {
            this.icao = this.icaoSearchField.duplicates[_index].icao
            this.type = this.icaoSearchField.duplicates[_index].type
            this.gps.closePopUpElement()
        }
    }
}
export class DRCT_SelectionWindow extends NavSystemElement {
    drctElement: any
    elementsSliderGroup: any
    isVisible: boolean
    menuIndex: number
    slider: any
    sliderCursor: any
    title: string
    window: HTMLElement

    constructor(_drctElement) {
        super()
        this.isVisible = false
        this.drctElement = _drctElement
    }

    init(_root) {
        this.window = _root
        this.title = this.gps.getChildById('Title')
        this.slider = this.gps.getChildById('Slider')
        this.sliderCursor = this.gps.getChildById('SliderCursor')
        this.elementsSliderGroup = new SelectableElementSliderGroup(
            this.gps,
            [
                new SelectableElement(
                    this.gps,
                    this.gps.getChildById('DRCTSelectElem1'),
                    this.elementSelectionCallback.bind(this)
                ),
                new SelectableElement(
                    this.gps,
                    this.gps.getChildById('DRCTSelectElem2'),
                    this.elementSelectionCallback.bind(this)
                ),
                new SelectableElement(
                    this.gps,
                    this.gps.getChildById('DRCTSelectElem3'),
                    this.elementSelectionCallback.bind(this)
                ),
                new SelectableElement(
                    this.gps,
                    this.gps.getChildById('DRCTSelectElem4'),
                    this.elementSelectionCallback.bind(this)
                ),
            ],
            this.slider,
            this.sliderCursor
        )
        this.defaultSelectables = [
            new SelectableElement(this.gps, this.title, this.titleSelectionCalback.bind(this)),
            this.elementsSliderGroup,
        ]
    }

    onEnter() {
        this.menuIndex = 0
        this.isVisible = true
    }
    onUpdate(_deltaTime) {
        if (this.isVisible) {
            diffAndSetAttribute(this.window, 'state', 'Active')
            const elements = []
            switch (this.menuIndex) {
                case 0:
                    diffAndSetText(this.title, 'FPL')
                    const waypoints = this.gps.flightPlanManager.getWaypoints()
                    for (let i = 0; i < waypoints.length; i++) {
                        elements.push(waypoints[i].ident)
                    }
                    break
                case 1:
                    diffAndSetText(this.title, 'NRST')
                    break
                case 2:
                    diffAndSetText(this.title, 'RECENT')
                    break
                case 3:
                    diffAndSetText(this.title, 'USER')
                    break
                case 4:
                    diffAndSetText(this.title, 'AIRWAY')
                    break
            }
            this.elementsSliderGroup.setStringElements(elements)
        } else {
            diffAndSetAttribute(this.window, 'state', 'Inactive')
        }
    }
    onExit() {
        this.isVisible = false
        diffAndSetAttribute(this.window, 'state', 'Inactive')
    }
    onEvent(_event) {
        if (_event == 'CLR') {
            this.close()
        }
    }

    titleSelectionCalback(_event) {
        switch (_event) {
            case 'NavigationSmallDec':
                this.menuIndex = (this.menuIndex - 1 + 5) % 5
                break
            case 'NavigationSmallInc':
                this.menuIndex = (this.menuIndex + 1) % 5
                break
        }
    }
    elementSelectionCallback(_event, _index) {
        if (_event == 'ENT_Push') {
            switch (this.menuIndex) {
                case 0:
                    const waypoints = this.gps.flightPlanManager.getWaypoints()
                    this.drctElement.icaoSearchField.SetWaypoint(
                        waypoints[_index].type,
                        waypoints[_index].GetInfos().icao
                    )
                    break
                case 1:
                    break
                case 2:
                    break
                case 3:
                    break
                case 4:
                    break
            }
            this.close()
        }
    }
    close() {
        this.onExit()
        this.drctElement.selectionWindowDisplayed = false
        this.gps.ActiveSelection(this.drctElement.getDefaultSelectables())
        this.gps.cursorIndex = 0
    }
}
export class GlassCockpit_DirectTo extends NavSystemElement {
    activateButtonElement: HTMLElement
    bearingElement: HTMLElement
    cityElement: HTMLElement
    directToWindow: HTMLElement
    distanceElement: HTMLElement
    facilityElement: HTMLElement
    holdButtonElement: HTMLElement
    icaoSearchField: any
    identElement: HTMLElement
    isActive: boolean
    mapElement: HTMLElement
    nameSearchField: any
    regionElement: HTMLElement
    selectionWindow: any
    selectionWindowContainer: any
    selectionWindowDisplayed: boolean
    symbolElement: HTMLElement
    vnavHeightElement: HTMLElement

    constructor() {
        super()
        this.isActive = false
        this.selectionWindowDisplayed = false
    }

    init(_root) {
        this.directToWindow = this.gps.getChildById('DirectToWindow')
        this.identElement = this.gps.getChildById('DRCTIdent')
        this.symbolElement = this.gps.getChildById('DRCTSymbol')
        this.regionElement = this.gps.getChildById('DRCTRegion')
        this.facilityElement = this.gps.getChildById('DRCTFacility')
        this.cityElement = this.gps.getChildById('DRCTCity')
        this.vnavHeightElement = this.gps.getChildById('DRCTVnavHeight')
        this.mapElement = this.gps.getChildById('DRCTMap')
        this.bearingElement = this.gps.getChildById('DRCTBearing')
        this.distanceElement = this.gps.getChildById('DRCTDistance')
        this.activateButtonElement = this.gps.getChildById('DRCTActivateButton')
        this.holdButtonElement = this.gps.getChildById('DRCTHoldButton')
        this.defaultSelectables = [
            new SelectableElement(this.gps, this.identElement, this.activateSearchField.bind(this)),
            new SelectableElement(
                this.gps,
                this.activateButtonElement,
                this.activateDirectTo.bind(this)
            ),
        ]
        this.container.defaultMenu = [
            {
                name: 'Cancel Direct-To NAV',
                callback: this.cancelDirectTo.bind(this),
                isInactive: () => false,
            },
            { name: 'Clear Vertical Constraints', callback: () => false, isInactive: () => true },
            { name: 'Edit Hold', callback: () => false, isInactive: () => true },
            { name: 'Hold At Present Position', callback: () => false, isInactive: () => true },
        ]
        this.icaoSearchField = new SearchFieldWaypointICAO(
            this.gps,
            [this.identElement],
            this.gps,
            'AWNV'
        )
        this.nameSearchField = new SearchFieldWaypointName(
            this.gps,
            [this.facilityElement],
            this.gps,
            'AWNV',
            this.icaoSearchField
        )
        this.isInitialized = true
        this.selectionWindow = new DRCT_SelectionWindow(this)
        this.selectionWindowContainer = new NavSystemElementContainer(
            'DRCTSelectMenu',
            'DRCTSelectionWindow',
            this.selectionWindow
        )
        this.selectionWindowContainer.setGPS(this.gps)
    }

    onEnter() {
        this.isActive = true
        this.selectionWindowDisplayed = false
        this.gps.ActiveSelection(this.defaultSelectables)
        if (this.gps.lastRelevantICAO) {
            this.icaoSearchField.SetWaypoint(
                this.gps.lastRelevantICAOType,
                this.gps.lastRelevantICAO
            )
            this.gps.cursorIndex = 1
        }
    }
    onUpdate(_deltaTime) {
        if (this.isActive) {
            if (this.selectionWindowDisplayed) {
                this.selectionWindowContainer.onUpdate(_deltaTime)
            }
            diffAndSetAttribute(this.directToWindow, 'state', 'Active')
            this.nameSearchField.Update()
            this.icaoSearchField.Update()
            const infos = this.icaoSearchField.getUpdatedInfos()
            if (infos && infos.icao != '') {
                if (this.cityElement) diffAndSetText(this.cityElement, infos.city)
                if (this.regionElement) diffAndSetText(this.regionElement, infos.region)
                const logo = infos.GetSymbol()
                if (logo != '') {
                    if (this.symbolElement)
                        diffAndSetHTML(
                            this.symbolElement,
                            '<img src="/Pages/VCockpit/Instruments/NavSystems/Shared/Images/' +
                                logo +
                                '">'
                        )
                } else {
                    if (this.symbolElement) diffAndSetHTML(this.symbolElement, '')
                }
                if (infos.coordinates && infos.coordinates.lat && infos.coordinates.long) {
                    const lat = SimVar.GetSimVarValue('GPS POSITION LAT', 'degree latitude')
                    const long = SimVar.GetSimVarValue('GPS POSITION LON', 'degree longitude')
                    const latLong = new LatLong(lat, long)
                    let magVar = 0
                    const waypoint = this.icaoSearchField.getWaypoint()
                    if (waypoint) magVar = waypoint.magvar
                    else magVar = SimVar.GetSimVarValue('MAGVAR', 'degrees')
                    this.bearingElement.textContent =
                        fastToFixed(
                            Avionics.Utils.computeGreatCircleHeading(latLong, infos.coordinates) -
                                magVar,
                            0
                        ) + '°'
                    diffAndSetHTML(
                        this.distanceElement,
                        fastToFixed(
                            Avionics.Utils.computeGreatCircleDistance(latLong, infos.coordinates),
                            1
                        ) + '<span class="unit">NM</span>'
                    )
                }
            } else {
                if (this.identElement) diffAndSetText(this.identElement, '_____')
                if (this.regionElement) diffAndSetText(this.regionElement, '__________')
                if (this.facilityElement)
                    diffAndSetText(this.facilityElement, '______________________')
                if (this.cityElement) diffAndSetText(this.cityElement, '___________')
                if (this.bearingElement) diffAndSetText(this.bearingElement, '')
                if (this.symbolElement) diffAndSetHTML(this.symbolElement, '')
                if (this.distanceElement) diffAndSetHTML(this.distanceElement, '')
            }
        } else {
            diffAndSetAttribute(this.directToWindow, 'state', 'Inactive')
        }
    }
    onExit() {
        this.isActive = false
        this.gps.SwitchToInteractionState(0)
        diffAndSetAttribute(this.directToWindow, 'state', 'Inactive')
        if (this.selectionWindowDisplayed) {
            this.selectionWindow.close()
        }
    }
    onEvent(_event) {
        if (this.selectionWindowDisplayed) {
            this.selectionWindowContainer.onEvent(_event)
        }
    }

    searchFieldEndCallback() {
        this.gps.ActiveSelection(this.defaultSelectables)
        this.gps.cursorIndex = 1
    }
    activateSearchField(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.icaoSearchField
            this.icaoSearchField.StartSearch(this.searchFieldEndCallback.bind(this))
            this.gps.SwitchToInteractionState(3)
        }
        if (_event == 'CLR_Push' || _event == 'CLR') {
            this.cancelDirectTo()
        }
    }
    activateSearchFieldName(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.nameSearchField
            this.nameSearchField.StartSearch(this.searchFieldEndCallback.bind(this))
            this.gps.SwitchToInteractionState(3)
        }
        if (_event == 'CLR_Push' || _event == 'CLR') {
            this.cancelDirectTo()
        }
    }
    activateDirectTo(_event) {
        if (_event == 'ENT_Push') {
            this.gps.closePopUpElement()
            this.gps.currFlightPlanManager.activateDirectTo(
                this.icaoSearchField.getUpdatedInfos().icao
            )
        }
    }
    cancelDirectTo() {
        this.gps.currFlightPlanManager.cancelDirectTo()
        this.gps.SwitchToInteractionState(1)
    }
}
export class MFD_NearestAirport_Element extends NavSystemElement {
    runwaySelection: any

    nbLines: number

    airportList: any
    airportTable: any
    approachesList: any
    approachesTable: any
    city: string
    currentWaypoint: any
    elevation: number
    facility: any
    frequenciesList: any
    frequenciesTable: any
    nbFreqs: number
    nearestAirportList: any
    runwayDesignation: any
    runwayIndex: number
    runwayLength: any
    runwaySurface: any
    runwayWidth: any

    constructor(_nbLines = 5, _nbFreqs = 3) {
        super()
        this.runwayIndex = 0
        this.nbLines = _nbLines
        this.nbFreqs = _nbFreqs
    }

    init(_root) {
        this.facility = _root.getElementsByClassName('Facility')[0]
        this.city = _root.getElementsByClassName('City')[0]
        this.elevation = _root.getElementsByClassName('Elevation')[0]
        this.runwayDesignation = _root.getElementsByClassName('Rwy_Designation')[0]
        this.runwaySurface = _root.getElementsByClassName('Rwy_Surface')[0]
        this.runwayLength = _root.getElementsByClassName('Rwy_Length')[0]
        this.runwayWidth = _root.getElementsByClassName('Rwy_Width')[0]
        this.nearestAirportList = new NearestAirportList(this.gps)
        {
            this.airportTable = this.gps.getChildById('Nrst_AirportList')
            const elems = []
            for (let i = 1; i <= this.nbLines; i++) {
                elems.push(
                    new SelectableElement(
                        this.gps,
                        this.airportTable.getElementsByClassName('L' + i)[0],
                        this.airportCallback.bind(this)
                    )
                )
            }
            const airportPart = this.gps.getChildById('NrstAirportList')
            this.airportList = new SelectableElementSliderGroup(
                this.gps,
                elems,
                airportPart.getElementsByClassName('Slider')[0],
                airportPart.getElementsByClassName('SliderCursor')[0]
            )
        }
        {
            this.frequenciesTable = this.gps.getChildById('Nrst_AirportFreqList')
            const elems = []
            for (let i = 1; i <= this.nbFreqs; i++) {
                elems.push(
                    new SelectableElement(
                        this.gps,
                        this.frequenciesTable.getElementsByClassName('L' + i)[0],
                        this.frequenciesCallback.bind(this)
                    )
                )
            }
            const freqPart = this.gps.getChildById('NrstAirportFreqs')
            this.frequenciesList = new SelectableElementSliderGroup(
                this.gps,
                elems,
                freqPart.getElementsByClassName('Slider')[0],
                freqPart.getElementsByClassName('SliderCursor')[0]
            )
        }
        {
            this.approachesTable = this.gps.getChildById('Nrst_AirportApproachesList')
            const elems = []
            for (let i = 1; i <= 3; i++) {
                elems.push(
                    new SelectableElement(
                        this.gps,
                        this.approachesTable.getElementsByClassName('L' + i)[0],
                        this.approachesCallback.bind(this)
                    )
                )
            }
            const approachPart = this.gps.getChildById('NrstAirportApproaches')
            this.approachesList = new SelectableElementSliderGroup(
                this.gps,
                elems,
                approachPart.getElementsByClassName('Slider')[0],
                approachPart.getElementsByClassName('SliderCursor')[0]
            )
        }
        this.defaultSelectables = [this.airportList]
        this.currentWaypoint = new WayPoint(this.gps)
        this.currentWaypoint.type = 'A'
        this.runwaySelection = new SelectableElement(
            this.gps,
            this.runwayDesignation,
            this.runwayCallback.bind(this)
        )
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        this.nearestAirportList.Update(25, 200)
        {
            const dataElems = []
            for (let i = 0; i < this.nearestAirportList.airports.length; i++) {
                const infos = this.nearestAirportList.airports[i]
                const logo = infos.imageFileName()
                dataElems.push([
                    this.airportList.getIndex() == i
                        ? '<img src="/Pages/VCockpit/Instruments/NavSystems/Shared/Images/Misc/WhiteArrow.svg">'
                        : '',
                    infos.ident,
                    '<img src="' +
                        (logo == ''
                            ? ''
                            : '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo) +
                        '">',
                    fastToFixed(infos.bearing, 0) + '°',
                    fastToFixed(infos.distance, 1) + 'NM',
                ])
            }
            this.airportList.setDataElements(dataElems)
        }
        if (this.nearestAirportList.airports.length > this.airportList.getIndex()) {
            const currentNearest = this.nearestAirportList.airports[this.airportList.getIndex()]
            if (currentNearest != undefined) {
                this.currentWaypoint.SetIdent(currentNearest.ident)
                this.currentWaypoint.SetICAO(currentNearest.icao, undefined, false)
            }
        }
        const infos = this.currentWaypoint.GetInfos()
        if (infos && infos.icao != '' && infos.getWaypointType() == 'A' && infos.IsUpToDate()) {
            diffAndSetText(this.facility, infos.name)
            diffAndSetText(this.city, infos.city)
            if (infos.coordinates) {
                diffAndSetText(this.elevation, fastToFixed(infos.coordinates.alt, 0) + 'FT')
            }
            if (infos.runways) {
                if (this.runwayIndex >= infos.runways.length) {
                    this.runwayIndex = 0
                }
                diffAndSetText(this.runwayDesignation, infos.runways[this.runwayIndex].designation)
                diffAndSetText(
                    this.runwaySurface,
                    infos.runways[this.runwayIndex].getSurfaceString()
                )
                diffAndSetText(
                    this.runwayLength,
                    fastToFixed(infos.runways[this.runwayIndex].length, 0) + 'FT'
                )
                diffAndSetText(
                    this.runwayWidth,
                    fastToFixed(infos.runways[this.runwayIndex].width, 0) + 'FT'
                )
            }
            if (infos.frequencies) {
                const elems = []
                for (let i = 0; i < infos.frequencies.length; i++) {
                    elems.push(
                        '<td>' +
                            infos.frequencies[i].getTypeName() +
                            '</td><td class="SelectableElement">' +
                            infos.frequencies[i].mhValue.toFixed(2) +
                            '</td>'
                    )
                }
                this.frequenciesList.setStringElements(elems)
            }
            if (infos.approaches) {
                const elems = []
                for (let i = 0; i < infos.approaches.length; i++) {
                    elems.push(
                        '<td class="SelectableElement">' +
                            infos.ident +
                            '-' +
                            infos.approaches[i].name +
                            '</td>'
                    )
                }
                this.approachesList.setStringElements(elems)
            }
            this.gps.lastRelevantICAOType = this.currentWaypoint.type
            this.gps.lastRelevantICAO = infos.icao
        }
    }
    onExit() {}
    onEvent(_event) {}

    airportCallback(_event, _index) {}
    approachesCallback(_event, _index) {}
    frequenciesCallback(_event, _index) {
        switch (_event) {
            case 'ENT_Push':
                const infos = this.currentWaypoint.GetInfos()
                if (infos.frequencies[_index].mhValue >= 118) {
                    SimVar.SetSimVarValue(
                        'K:COM_STBY_RADIO_SET',
                        'Frequency BCD16',
                        infos.frequencies[_index].bcd16Value
                    )
                } else {
                    SimVar.SetSimVarValue(
                        'K:NAV1_STBY_SET',
                        'Frequency BCD16',
                        infos.frequencies[_index].bcd16Value
                    )
                }
                break
        }
    }
    aptSelect() {
        this.gps.ActiveSelection(this.defaultSelectables)
    }
    rnwySelect() {
        this.gps.ActiveSelection([this.runwaySelection])
    }
    freqSelect() {
        this.gps.ActiveSelection([this.frequenciesList])
    }
    aprSelect() {
        this.gps.ActiveSelection([this.approachesList])
    }
    runwayCallback(_event) {
        switch (_event) {
            case 'NavigationSmallInc':
                this.runwayIndex =
                    (this.runwayIndex + 1) % this.currentWaypoint.GetInfos().runways.length
                break
            case 'NavigationSmallDec':
                this.runwayIndex--
                if (this.runwayIndex < 0) {
                    this.runwayIndex =
                        (this.runwayIndex + 1) % this.currentWaypoint.GetInfos().runways.length
                }
                break
        }
    }
}
export class MFD_NearestVOR_Element extends NavSystemElement {
    city: string
    class: any
    currentWaypoint: any
    facility: any
    frequency: number
    frequencySelection: any
    latitude: number
    longitude: number
    nbLines: number

    magvar: number
    nearestVorList: any
    vorList: any
    vorTable: any

    constructor(_nbLines = 11) {
        super()
        this.nbLines = _nbLines
    }

    init(_root) {
        this.facility = _root.getElementsByClassName('Facility')[0]
        this.city = _root.getElementsByClassName('City')[0]
        this.nearestVorList = new NearestVORList(this.gps)
        {
            this.vorTable = this.gps.getChildById('Nrst_VORList')
            const elems = []
            for (let i = 1; i <= this.nbLines; i++) {
                elems.push(
                    new SelectableElement(
                        this.gps,
                        this.vorTable.getElementsByClassName('L' + i)[0],
                        this.vorCallback.bind(this)
                    )
                )
            }
            const vorPart = this.gps.getChildById('NrstVORList')
            this.vorList = new SelectableElementSliderGroup(
                this.gps,
                elems,
                vorPart.getElementsByClassName('Slider')[0],
                vorPart.getElementsByClassName('SliderCursor')[0]
            )
        }
        this.currentWaypoint = new WayPoint(this.gps)
        this.currentWaypoint.type = 'V'
        this.defaultSelectables = [this.vorList]
        this.class = _root.getElementsByClassName('Class')[0]
        this.magvar = _root.getElementsByClassName('MagVar')[0]
        this.latitude = _root.getElementsByClassName('Latitude')[0]
        this.longitude = _root.getElementsByClassName('Longitude')[0]
        this.frequency = _root.getElementsByClassName('Frequency')[0]
        this.frequencySelection = new SelectableElement(
            this.gps,
            this.frequency,
            this.frequencyCallback.bind(this)
        )
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        this.nearestVorList.Update(25, 200)
        {
            const dataElems = []
            for (let i = 0; i < this.nearestVorList.vors.length; i++) {
                const infos = this.nearestVorList.vors[i]
                const logo = infos.imageFileName()
                dataElems.push([
                    this.vorList.getIndex() == i
                        ? '<img src="/Pages/VCockpit/Instruments/NavSystems/Shared/Images/Misc/WhiteArrow.svg">'
                        : '',
                    infos.ident,
                    '<img src="' +
                        (logo == ''
                            ? ''
                            : '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo) +
                        '">',
                    fastToFixed(infos.bearing, 0) + '°',
                    fastToFixed(infos.distance, 1) + 'NM',
                ])
            }
            this.vorList.setDataElements(dataElems)
        }
        if (this.nearestVorList.vors.length > this.vorList.getIndex()) {
            const currentNearest = this.nearestVorList.vors[this.vorList.getIndex()]
            if (currentNearest != undefined) {
                this.currentWaypoint.SetIdent(currentNearest.ident)
                this.currentWaypoint.SetICAO(currentNearest.icao)
            }
        }
        const infos = this.currentWaypoint.GetInfos()
        if (infos && infos.icao != '' && infos.getWaypointType() == 'V' && infos.IsUpToDate()) {
            diffAndSetText(this.facility, infos.name)
            diffAndSetText(this.city, infos.city)
            diffAndSetText(this.class, infos.getClassName())
            let magVar = ''
            if (isNaN(infos.magneticVariation)) {
                magVar = '____°'
            } else {
                if (infos.magneticVariation > 0) {
                    magVar = 'W' + fastToFixed(infos.magneticVariation, 0) + '°'
                } else {
                    magVar = 'E' + fastToFixed(0 - infos.magneticVariation, 0) + '°'
                }
            }
            diffAndSetText(this.magvar, magVar)
            if (infos.coordinates) {
                diffAndSetText(this.latitude, this.gps.latitudeFormat(infos.coordinates.lat))
                diffAndSetText(this.longitude, this.gps.longitudeFormat(infos.coordinates.long))
            }
            diffAndSetText(
                this.frequency,
                infos.frequencyMHz ? fastToFixed(infos.frequencyMHz, 2) : '___.__'
            )
            this.gps.lastRelevantICAOType = this.currentWaypoint.type
            this.gps.lastRelevantICAO = infos.icao
        }
    }
    onExit() {}
    onEvent(_event) {}

    vorCallback(_event, _index) {}
    vorSelect() {
        this.gps.ActiveSelection(this.defaultSelectables)
    }
    freqSelect() {
        this.gps.ActiveSelection([this.frequencySelection])
    }
    frequencyCallback(_event) {
        if (_event == 'ENT_Push') {
            SimVar.SetSimVarValue(
                'K:NAV1_STBY_SET',
                'Frequency BCD16',
                this.currentWaypoint.GetInfos().frequencyBcd16
            )
        }
    }
}
export class MFD_NearestNDB_Element extends NavSystemElement {
    currentWaypoint: any
    latitude: number
    longitude: number
    nbLines: number

    city: string
    class: string
    facility: any
    frequency: number
    frequencySelection: any
    ndbList: any
    ndbTable: any
    nearestNdbList: any

    constructor(_nbLines = 11) {
        super()
        this.nbLines = _nbLines
    }

    init(_root) {
        this.facility = _root.getElementsByClassName('Facility')[0]
        this.city = _root.getElementsByClassName('City')[0]
        this.nearestNdbList = new NearestNDBList(this.gps)
        {
            this.ndbTable = this.gps.getChildById('Nrst_NDBList')
            const elems = []
            for (let i = 1; i <= this.nbLines; i++) {
                elems.push(
                    new SelectableElement(
                        this.gps,
                        this.ndbTable.getElementsByClassName('L' + i)[0],
                        this.vorCallback.bind(this)
                    )
                )
            }
            const ndbPart = this.gps.getChildById('NrstNDBList')
            this.ndbList = new SelectableElementSliderGroup(
                this.gps,
                elems,
                ndbPart.getElementsByClassName('Slider')[0],
                ndbPart.getElementsByClassName('SliderCursor')[0]
            )
        }
        this.currentWaypoint = new WayPoint(this.gps)
        this.currentWaypoint.type = 'N'
        this.defaultSelectables = [this.ndbList]
        this.class = _root.getElementsByClassName('Class')[0]
        this.latitude = _root.getElementsByClassName('Latitude')[0]
        this.longitude = _root.getElementsByClassName('Longitude')[0]
        this.frequency = _root.getElementsByClassName('Frequency')[0]
        this.frequencySelection = new SelectableElement(
            this.gps,
            this.frequency,
            this.frequencyCallback.bind(this)
        )
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        this.nearestNdbList.Update(25, 200)
        {
            const dataElems = []
            for (let i = 0; i < this.nearestNdbList.ndbs.length; i++) {
                const infos = this.nearestNdbList.ndbs[i]
                const logo = infos.imageFileName()
                dataElems.push([
                    this.ndbList.getIndex() == i
                        ? '<img src="/Pages/VCockpit/Instruments/NavSystems/Shared/Images/Misc/WhiteArrow.svg">'
                        : '',
                    infos.ident,
                    '<img src="' +
                        (logo == ''
                            ? ''
                            : '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo) +
                        '">',
                    fastToFixed(infos.bearing, 0) + '°',
                    fastToFixed(infos.distance, 1) + 'NM',
                ])
            }
            this.ndbList.setDataElements(dataElems)
        }
        if (this.nearestNdbList.ndbs.length > this.ndbList.getIndex()) {
            const currentNearest = this.nearestNdbList.ndbs[this.ndbList.getIndex()]
            if (currentNearest != undefined && currentNearest.icao != this.currentWaypoint.icao) {
                this.currentWaypoint.SetIdent(currentNearest.ident)
                this.currentWaypoint.SetICAO(currentNearest.icao)
            }
        }
        const infos = this.currentWaypoint.GetInfos()
        if (infos && infos.icao != '' && infos.getWaypointType() == 'N' && infos.IsUpToDate()) {
            diffAndSetText(this.facility, infos.name)
            diffAndSetText(this.city, infos.city)
            diffAndSetText(this.class, infos.getTypeString())
            if (infos.coordinates) {
                diffAndSetText(this.latitude, this.gps.latitudeFormat(infos.coordinates.lat))
                diffAndSetText(this.longitude, this.gps.longitudeFormat(infos.coordinates.long))
            }
            diffAndSetText(this.frequency, fastToFixed(infos.frequencyMHz, 2))
            this.gps.lastRelevantICAOType = this.currentWaypoint.type
            this.gps.lastRelevantICAO = infos.icao
        }
    }
    onExit() {}
    onEvent(_event) {}

    vorCallback(_event, _index) {}
    vorSelect() {
        this.gps.ActiveSelection(this.defaultSelectables)
    }
    freqSelect() {
        this.gps.ActiveSelection([this.frequencySelection])
    }
    frequencyCallback(_event) {
        if (_event == 'ENT_Push') {
        }
    }
}
export class MFD_NearestIntersection_Element extends NavSystemElement {
    nbLines: number

    currentWaypoint: any
    intList: any
    intTable: any
    latitude: number
    longitude: number
    nearestIntList: any
    vorBearing: any
    vorDistance: any
    vorFreq: any
    vorIdent: any
    vorSymbol: any

    constructor(_nbLines = 11) {
        super()
        this.nbLines = _nbLines
    }

    init(_root) {
        this.nearestIntList = new NearestIntersectionList(this.gps)
        {
            this.intTable = this.gps.getChildById('Nrst_INTList')
            const elems = []
            for (let i = 1; i <= this.nbLines; i++) {
                elems.push(
                    new SelectableElement(
                        this.gps,
                        this.intTable.getElementsByClassName('L' + i)[0],
                        this.intCallback.bind(this)
                    )
                )
            }
            const ndbPart = this.gps.getChildById('NrstINTList')
            this.intList = new SelectableElementSliderGroup(
                this.gps,
                elems,
                ndbPart.getElementsByClassName('Slider')[0],
                ndbPart.getElementsByClassName('SliderCursor')[0]
            )
        }
        this.currentWaypoint = new WayPoint(this.gps)
        this.currentWaypoint.type = 'W'
        this.defaultSelectables = [this.intList]
        this.latitude = _root.getElementsByClassName('Latitude')[0]
        this.longitude = _root.getElementsByClassName('Longitude')[0]
        this.vorIdent = _root.getElementsByClassName('VorIdent')[0]
        this.vorSymbol = _root.getElementsByClassName('VorSymbol')[0]
        this.vorFreq = _root.getElementsByClassName('VorFreq')[0]
        this.vorBearing = _root.getElementsByClassName('VorBearing')[0]
        this.vorDistance = _root.getElementsByClassName('VorDistance')[0]
    }

    onEnter() {}
    onUpdate(_deltaTime) {
        this.nearestIntList.Update(25, 200)
        {
            const dataElems = []
            for (let i = 0; i < this.nearestIntList.intersections.length; i++) {
                const infos = this.nearestIntList.intersections[i]
                const logo = infos.imageFileName()
                dataElems.push([
                    this.intList.getIndex() == i
                        ? '<img src="/Pages/VCockpit/Instruments/NavSystems/Shared/Images/Misc/WhiteArrow.svg">'
                        : '',
                    infos.ident,
                    '<img src="' +
                        (logo == ''
                            ? ''
                            : '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo) +
                        '">',
                    fastToFixed(infos.bearing, 0) + '°',
                    fastToFixed(infos.distance, 1) + 'NM',
                ])
            }
            this.intList.setDataElements(dataElems)
        }
        if (this.nearestIntList.intersections.length > this.intList.getIndex()) {
            const currentNearest = this.nearestIntList.intersections[this.intList.getIndex()]
            if (currentNearest != undefined) {
                this.currentWaypoint.SetIdent(currentNearest.ident)
                this.currentWaypoint.SetICAO(currentNearest.icao)
            }
        }
        const infos = this.currentWaypoint.GetInfos()
        if (infos && infos.icao != '' && infos.getWaypointType() == 'W' && infos.IsUpToDate()) {
            if (infos.coordinates) {
                diffAndSetText(this.latitude, this.gps.latitudeFormat(infos.coordinates.lat))
                diffAndSetText(this.longitude, this.gps.longitudeFormat(infos.coordinates.long))
            }
            diffAndSetText(this.vorIdent, infos.nearestVORIdent)
            const logo = infos.vorImageFileNameSync()
            diffAndSetAttribute(
                this.vorSymbol,
                'src',
                logo == '' ? '' : '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo
            )
            diffAndSetText(this.vorFreq, fastToFixed(infos.nearestVORFrequencyMHz, 2))
            diffAndSetText(this.vorBearing, fastToFixed(infos.nearestVORMagneticRadial, 0) + '°')
            diffAndSetText(this.vorDistance, fastToFixed(infos.nearestVORDistance / 1852, 1) + 'NM')
            this.gps.lastRelevantICAOType = this.currentWaypoint.type
            this.gps.lastRelevantICAO = infos.icao
        }
    }
    onExit() {}
    onEvent(_event) {}

    intCallback(_event, _index) {}
}
export class MFD_Procedures extends NavSystemElement {
    activateApproach: any
    activateApproach_SE: any
    selectApproach: any
    selectArrival: any
    selectDeparture: any
    selectDeparturePopup: any

    root: HTMLElement

    activateMissedApproach: boolean
    activateVTF: boolean
    approachSequenceSize: number
    arrivalSequenceSize: number
    departureSequenceSize: number
    loadedApproach: any
    loadedArrival: any
    loadedDeparture: any
    selectApproachPopup: any
    selectArrivalPopup: any

    constructor(_approachSize = 4, _arrivalSize = 6, _departureSize = 6) {
        super()
        this.approachSequenceSize = _approachSize
        this.arrivalSequenceSize = _arrivalSize
        this.departureSequenceSize = _departureSize
    }

    init(_root) {
        this.activateVTF = this.gps.getChildById('Proc_ActivateVTF')
        this.activateApproach = this.gps.getChildById('Proc_ActivateApproach')
        this.activateMissedApproach = this.gps.getChildById('Proc_ActivateMissedApproach')
        this.selectApproach = this.gps.getChildById('Proc_SelectApproach')
        this.selectArrival = this.gps.getChildById('Proc_SelectArrival')
        this.selectDeparture = this.gps.getChildById('Proc_SelectDeparture')
        this.loadedApproach = this.gps.getChildById('Proc_loadedApproach')
        this.loadedArrival = this.gps.getChildById('Proc_loadedArrival')
        this.loadedDeparture = this.gps.getChildById('Proc_loadedDeparture')
        this.selectApproachPopup = new NavSystemElementContainer(
            'ApproachSelection',
            'ApproachSelection',
            new MFD_ApproachSelection(this.approachSequenceSize)
        )
        this.selectApproachPopup.setGPS(this.gps)
        this.selectArrivalPopup = new NavSystemElementContainer(
            'ArrivalSelection',
            'ArrivalSelection',
            new MFD_ArrivalSelection(this.arrivalSequenceSize)
        )
        this.selectArrivalPopup.setGPS(this.gps)
        this.selectDeparturePopup = new NavSystemElementContainer(
            'DepartureSelection',
            'DepartureSelection',
            new MFD_DepartureSelection(this.departureSequenceSize)
        )
        this.selectDeparturePopup.setGPS(this.gps)
        this.activateApproach_SE = new SelectableElement(
            this.gps,
            this.activateApproach,
            this.activateApproach_CB.bind(this)
        )
        this.defaultSelectables = [
            this.activateApproach_SE,
            new SelectableElement(this.gps, this.selectApproach, this.selectApproach_CB.bind(this)),
            new SelectableElement(this.gps, this.selectArrival, this.selectArrival_CB.bind(this)),
            new SelectableElement(
                this.gps,
                this.selectDeparture,
                this.selectDeparture_CB.bind(this)
            ),
        ]
        this.root = _root
    }

    onEnter() {
        diffAndSetAttribute(this.root, 'state', 'Active')
        this.gps.currFlightPlanManager.updateFlightPlan(() => {
            this.gps.currFlightPlanManager.updateCurrentApproach()
        })
        this.gps.ActiveSelection(this.defaultSelectables)
    }
    onUpdate(_deltaTime) {
        if (this.gps.currFlightPlanManager) {
            this.activateApproach_SE.setActive(
                this.gps.currFlightPlanManager.isLoadedApproach() &&
                    !this.gps.currFlightPlanManager.isActiveApproach()
            )
            const approach = this.gps.currFlightPlanManager.getAirportApproach()
            if (approach) {
                diffAndSetText(this.loadedApproach, approach.name)
            } else {
                diffAndSetText(this.loadedApproach, '____-')
            }
            const departure = this.gps.currFlightPlanManager.getDeparture()
            if (departure) {
                diffAndSetText(this.loadedDeparture, departure.name)
            } else {
                diffAndSetText(this.loadedDeparture, '____-')
            }
            const arrival = this.gps.currFlightPlanManager.getArrival()
            if (arrival) {
                diffAndSetText(this.loadedArrival, arrival.name)
            } else {
                diffAndSetText(this.loadedArrival, '____-')
            }
        }
    }
    onExit() {
        diffAndSetAttribute(this.root, 'state', 'Inactive')
        this.gps.SwitchToInteractionState(0)
    }
    onEvent(_event) {}

    activateApproach_CB(_event) {
        if (_event == 'ENT_Push' && this.gps.currFlightPlanManager) {
            this.gps.currFlightPlanManager.activateApproach()
            this.gps.closePopUpElement()
        }
    }
    selectApproach_CB(_event) {
        if (_event == 'ENT_Push') {
            this.gps.switchToPopUpPage(this.selectApproachPopup)
        }
    }
    selectArrival_CB(_event) {
        if (_event == 'ENT_Push') {
            this.gps.switchToPopUpPage(this.selectArrivalPopup)
        }
    }
    selectDeparture_CB(_event) {
        if (_event == 'ENT_Push') {
            this.gps.switchToPopUpPage(this.selectDeparturePopup)
        }
    }
}
export class MFD_ApproachSelection extends NavSystemElement {
    approachList: any
    elem_approach: any
    elem_transition: any
    selectedApproach: any
    selectedTransition: any
    transitionList: any

    approachLines: any
    approachSelectables: any
    elem_activateButton: HTMLElement
    elem_airportCity: any
    elem_airportID: any
    elem_airportLogo: any
    elem_airportName: any
    elem_airportType: any
    elem_channel: any
    elem_frequencyName: any
    elem_frequencyValue: any
    elem_id: any
    elem_loadButton: HTMLElement
    elem_minimumsState: any
    elem_minimumsValue: any
    elem_sequence: any
    elem_sequenceTable: HTMLElement
    icaoSearchField: any
    nameSearchField: any
    nbLines: number
    regexNumber: any
    root: HTMLElement
    sequenceSlider: HTMLElement
    sequenceSliderCursor: any
    sequenceSliderGroup: any
    transitionLines: any
    transitionSelectables: any

    constructor(_nbLines = 4) {
        super()
        this.selectedApproach = 0
        this.selectedTransition = 0
        this.regexNumber = /(\d+)/
        this.nbLines = _nbLines
    }

    init(_root) {
        this.root = _root
        this.elem_airportID = this.gps.getChildById('Approach_AirportID')
        this.elem_airportLogo = this.gps.getChildById('Approach_AirportLogo')
        this.elem_airportType = this.gps.getChildById('Approach_AirportType')
        this.elem_airportName = this.gps.getChildById('Approach_AirportName')
        this.elem_airportCity = this.gps.getChildById('Approach_AirportCity')
        this.elem_channel = this.gps.getChildById('Approach_Channel')
        this.elem_id = this.gps.getChildById('Approach_Id')
        this.elem_approach = this.gps.getChildById('Approach_Approach')
        this.elem_transition = this.gps.getChildById('Approach_Transition')
        this.elem_minimumsState = this.gps.getChildById('Approach_MinimumsState')
        this.elem_minimumsValue = this.gps.getChildById('Approach_MinimumsValue')
        this.elem_frequencyName = this.gps.getChildById('Approach_FrequencyName')
        this.elem_frequencyValue = this.gps.getChildById('Approach_FrequencyValue')
        this.elem_sequence = this.gps.getChildById('Approach_Sequence')
        if (this.elem_sequence) {
            if (this.nbLines == 0) {
                diffAndSetStyle(
                    _root.getElementsByClassName('Sequence')[0],
                    StyleProperty.display,
                    'none'
                )
            }
            this.sequenceSlider = this.elem_sequence.getElementsByClassName('Slider')[0]
            this.sequenceSliderCursor =
                this.sequenceSlider.getElementsByClassName('SliderCursor')[0]
        }
        this.elem_sequenceTable = this.gps.getChildById('Approach_SequenceTable')
        this.elem_loadButton = this.gps.getChildById('Approach_LoadButton')
        this.elem_activateButton = this.gps.getChildById('Approach_ActivateButton')
        this.approachList = this.gps.getChildById('Approach_ApproachList')
        this.approachLines = []
        this.transitionList = this.gps.getChildById('Approach_TransitionList')
        this.transitionLines = []
        this.icaoSearchField = new SearchFieldWaypointICAO(
            this.gps,
            [this.elem_airportID],
            this.gps,
            'A'
        )
        if (this.elem_airportName) {
            this.nameSearchField = new SearchFieldWaypointName(
                this.gps,
                [this.elem_airportName],
                this.gps,
                'A',
                this.icaoSearchField
            )
        }
        if (this.elem_sequence && this.nbLines > 0) {
            const sliderGroupElements = new Array()
            for (let i = 1; i <= this.nbLines; i++) {
                sliderGroupElements.push(
                    new SelectableElement(
                        this.gps,
                        this.elem_sequenceTable.getElementsByClassName('L' + i)[0],
                        this.sequenceLineCallback.bind(this, i)
                    )
                )
            }
            this.sequenceSliderGroup = new SelectableElementSliderGroup(
                this.gps,
                sliderGroupElements,
                this.sequenceSlider,
                this.sequenceSliderCursor
            )
        }
        this.defaultSelectables = [
            new SelectableElement(this.gps, this.elem_approach, this.openApproachList.bind(this)),
            new SelectableElement(
                this.gps,
                this.elem_transition,
                this.openTransitionList.bind(this)
            ),
        ]
        if (this.elem_sequence && this.nbLines > 0) {
            this.defaultSelectables.push(this.sequenceSliderGroup)
        }
        this.defaultSelectables.push(
            new SelectableElement(this.gps, this.elem_loadButton, this.loadApproach.bind(this))
        )
        this.defaultSelectables.push(
            new SelectableElement(
                this.gps,
                this.elem_activateButton,
                this.activateApproach.bind(this)
            )
        )
    }

    onEnter() {
        diffAndSetAttribute(this.root, 'state', 'Active')
        this.gps.ActiveSelection(this.defaultSelectables)
        const dest = this.gps.currFlightPlanManager.getDestination()
        if (dest) {
            this.icaoSearchField.SetWaypoint('A', dest.icao)
            const index = this.gps.currFlightPlanManager.getApproachIndex()
            if (index >= 0) {
                this.selectedApproach = index
                this.gps.cursorIndex = Math.min(1, this.defaultSelectables.length - 1)
            }
        }
    }
    onUpdate(_deltaTime) {
        if (this.elem_airportName) {
            this.nameSearchField.Update()
        }
        this.icaoSearchField.Update()
        if (this.elem_sequence && this.nbLines > 0) {
            this.sequenceSliderGroup.updateDisplay()
        }
        const infos = this.icaoSearchField.getUpdatedInfos()
        if (infos && infos.icao) {
            diffAndSetText(this.elem_airportCity, infos.city)
            switch (infos.privateType) {
                case 0:
                    diffAndSetText(this.elem_airportType, 'Unknown')
                    break
                case 1:
                    diffAndSetText(this.elem_airportType, 'Public')
                    break
                case 2:
                    diffAndSetText(this.elem_airportType, 'Military')
                    break
                case 3:
                    diffAndSetText(this.elem_airportType, 'Private')
                    break
            }
            const logo = infos.imageFileName()
            if (logo != '') {
                diffAndSetAttribute(
                    this.elem_airportLogo,
                    'src',
                    '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo
                )
            } else {
                diffAndSetAttribute(this.elem_airportLogo, 'src', '')
            }
            const approach = this.getSelectedApproach(infos)
            if (approach) {
                let approachName = approach.name
                const matches = this.regexNumber.exec(approachName)
                approachName =
                    approachName.slice(0, matches.index - 1) +
                    (matches[0].length == 1 ? ' 0' : ' ') +
                    approachName.slice(matches.index)
                diffAndSetText(this.elem_approach, approachName)
                if (
                    approach.transitions &&
                    this.selectedTransition >= 0 &&
                    approach.transitions.length > this.selectedTransition
                ) {
                    diffAndSetText(
                        this.elem_transition,
                        approach.transitions[this.selectedTransition].name
                    )
                } else {
                    diffAndSetText(this.elem_transition, 'NONE')
                }
            } else {
                diffAndSetText(this.elem_approach, 'NONE')
                diffAndSetText(this.elem_transition, 'NONE')
            }
            if (this.elem_sequence && this.nbLines > 0) {
                const sequence = []
                if (approach) {
                    if (
                        approach.transitions &&
                        this.selectedTransition >= 0 &&
                        approach.transitions.length > this.selectedTransition
                    ) {
                        for (
                            let i = 0;
                            i < approach.transitions[this.selectedTransition].waypoints.length;
                            i++
                        ) {
                            if (
                                approach.transitions[this.selectedTransition].waypoints[i] !=
                                undefined
                            ) {
                                sequence.push(
                                    '<td class="Blinking">' +
                                        approach.transitions[this.selectedTransition].waypoints[i]
                                            .infos.ident +
                                        '</td><td>' +
                                        ' ' +
                                        '</td><td>' +
                                        ' ' +
                                        '</td><td>' +
                                        (approach.transitions[this.selectedTransition].waypoints[i]
                                            .bearingInFP
                                            ? fastToFixed(
                                                  approach.transitions[this.selectedTransition]
                                                      .waypoints[i].bearingInFP,
                                                  0
                                              ) + '°'
                                            : '') +
                                        '</td><td>' +
                                        (approach.transitions[this.selectedTransition].waypoints[i]
                                            .distanceInFP
                                            ? fastToFixed(
                                                  approach.transitions[this.selectedTransition]
                                                      .waypoints[i].distanceInFP,
                                                  1
                                              ) + 'NM'
                                            : '') +
                                        '</td>'
                                )
                            }
                        }
                    }
                    for (let i = 0; i < approach.wayPoints.length; i++) {
                        sequence.push(
                            '<td class="Blinking">' +
                                approach.wayPoints[i].ident +
                                '</td><td>' +
                                ' ' +
                                '</td><td>' +
                                ' ' +
                                '</td><td>' +
                                fastToFixed(approach.wayPoints[i].bearingInFP, 0) +
                                '°' +
                                '</td><td>' +
                                fastToFixed(approach.wayPoints[i].distanceInFP, 1) +
                                'NM' +
                                '</td>'
                        )
                    }
                    this.sequenceSliderGroup.setStringElements(sequence)
                } else {
                    this.sequenceSliderGroup.setStringElements([])
                }
            }
        } else {
            diffAndSetText(this.elem_airportCity, '____________')
            diffAndSetText(this.elem_airportType, 'Unknown')
            diffAndSetAttribute(this.elem_airportLogo, 'src', '')
            if (this.elem_sequence && this.nbLines > 0) {
                this.sequenceSliderGroup.setStringElements([])
            }
        }
    }
    onExit() {
        diffAndSetAttribute(this.root, 'state', 'Inactive')
        diffAndSetAttribute(this.approachList, 'state', 'Inactive')
        diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
        this.gps.currFlightPlanManager.updateFlightPlan(() => {
            this.gps.currFlightPlanManager.updateCurrentApproach()
        })
        this.gps.SwitchToInteractionState(0)
    }
    onEvent(_event) {
        if (_event == 'NavigationPush') {
            diffAndSetAttribute(this.approachList, 'state', 'Inactive')
            diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
        }
    }

    loadApproach(_event) {
        if (_event == 'ENT_Push') {
            const infos = this.icaoSearchField.getUpdatedInfos()
            if (infos && infos.icao) {
                this.gps.currFlightPlanManager.setApproachIndex(
                    this.selectedApproach,
                    () => {
                        const elem = this.gps.getElementOfType(MFD_ActiveFlightPlan_Element)
                        if (elem) {
                            elem.updateWaypoints()
                        }
                    },
                    this.selectedTransition
                )
            }
            this.gps.closePopUpElement()
        }
    }
    sequenceLineCallback(_index, _event) {}
    activateApproach(_event) {
        if (_event == 'ENT_Push') {
            const infos = this.icaoSearchField.getUpdatedInfos()
            if (infos && infos.icao) {
                this.gps.currFlightPlanManager.setApproachIndex(
                    this.selectedApproach,
                    () => {
                        const elem = this.gps.getElementOfType(MFD_ActiveFlightPlan_Element)
                        if (elem) {
                            elem.updateWaypoints()
                        }
                    },
                    this.selectedTransition
                )
                this.gps.currFlightPlanManager.activateApproach()
            }
            this.gps.closePopUpElement()
        }
    }
    activateIcaoSearch(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.icaoSearchField
            this.icaoSearchField.StartSearch()
            this.gps.SwitchToInteractionState(3)
            this.selectedApproach = 0
            this.selectedTransition = 0
        }
    }
    activateNameSearch(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.nameSearchField
            this.nameSearchField.StartSearch()
            this.gps.SwitchToInteractionState(3)
        }
    }
    openApproachList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            let nbElems = 0
            this.approachSelectables = []
            if (infos && infos.icao) {
                for (let i = 0; i < infos.approaches.length; i++) {
                    if (i >= this.approachLines.length) {
                        this.approachLines.push(document.createElement('div'))
                        this.approachList.appendChild(this.approachLines[i])
                    }
                    let approachName = infos.approaches[i].name
                    const matches = this.regexNumber.exec(approachName)
                    if (matches)
                        approachName =
                            approachName.slice(0, matches.index - 1) +
                            (matches[0].length == 1 ? ' 0' : ' ') +
                            approachName.slice(matches.index)
                    diffAndSetText(this.approachLines[i], approachName)
                    diffAndSetAttribute(this.approachLines[i], 'state', 'Active')
                    diffAndSetAttribute(this.approachLines[i], 'class', 'Blinking')
                    this.approachSelectables.push(
                        new SelectableElement(
                            this.gps,
                            this.approachLines[i],
                            this.selectApproach.bind(this, i)
                        )
                    )
                }
                nbElems = infos.approaches.length
            }
            for (let i = nbElems; i < this.approachLines.length; i++) {
                diffAndSetAttribute(this.approachLines[i], 'state', 'Inactive')
            }
            if (this.approachSelectables.length > 0) {
                diffAndSetAttribute(this.approachList, 'state', 'Active')
                this.gps.ActiveSelection(this.approachSelectables)
            }
        }
    }
    selectApproach(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.approachList, 'state', 'Inactive')
            this.selectedApproach = _id
            this.selectedTransition = 0
            this.gps.ActiveSelection(this.defaultSelectables)
            this.gps.cursorIndex = Math.min(1, this.defaultSelectables.length - 1)
        }
    }
    getSelectedApproach(airport) {
        if (
            airport &&
            airport.approaches &&
            this.selectedApproach >= 0 &&
            airport.approaches.length > this.selectedApproach
        ) {
            return airport.approaches[this.selectedApproach]
        }
        return null
    }
    openTransitionList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            let nbElems = 0
            this.transitionSelectables = []
            const approach = this.getSelectedApproach(infos)
            if (approach && approach.transitions.length > 0) {
                for (let i = 0; i < approach.transitions.length; i++) {
                    if (i >= this.transitionLines.length) {
                        this.transitionLines.push(document.createElement('div'))
                        this.transitionList.appendChild(this.transitionLines[i])
                    }
                    diffAndSetText(this.transitionLines[i], approach.transitions[i].name)
                    diffAndSetAttribute(this.transitionLines[i], 'state', 'Active')
                    diffAndSetAttribute(this.transitionLines[i], 'class', 'Blinking')
                    this.transitionSelectables.push(
                        new SelectableElement(
                            this.gps,
                            this.transitionLines[i],
                            this.selectTransition.bind(this, i)
                        )
                    )
                }
                nbElems = approach.transitions.length
            }
            for (let i = nbElems; i < this.transitionLines.length; i++) {
                diffAndSetAttribute(this.transitionLines[i], 'state', 'Inactive')
            }
            if (this.transitionSelectables.length > 0) {
                diffAndSetAttribute(this.transitionList, 'state', 'Active')
                this.gps.ActiveSelection(this.transitionSelectables)
            }
        }
    }
    selectTransition(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
            this.selectedTransition = _id
            this.gps.ActiveSelection(this.defaultSelectables)
            this.gps.cursorIndex = this.defaultSelectables.length - 2
        }
    }
}
export class MFD_ArrivalSelection extends NavSystemElement {
    elem_transition: any
    selectedArrival: any
    selectedRunway: any
    selectedTransition: any
    transitionList: any

    arrivalList: any
    arrivalSelectables: any
    arrivalSelectableSliderGroup: any
    elem_airportCity: any
    elem_airportID: any
    elem_airportLogo: any
    elem_airportName: any
    elem_airportType: any
    elem_arrival: any
    elem_loadButton: HTMLElement
    elem_runway: any
    elem_sequence: any
    elem_sequenceTable: HTMLElement
    icaoSearchField: any
    nameSearchField: any
    nbLines: number
    root: HTMLElement
    runwayLines: any
    runwayList: any
    runwaySelectables: any
    sequenceSlider: HTMLElement
    sequenceSliderCursor: any
    sequenceSliderGroup: any
    transitionLines: any
    transitionSelectables: any

    constructor(_nbLines = 6) {
        super()
        this.selectedArrival = 0
        this.selectedTransition = 0
        this.selectedRunway = 0
        this.nbLines = _nbLines
    }

    init(_root) {
        this.root = _root
        this.elem_airportID = this.gps.getChildById('Arrival_AirportID')
        this.elem_airportLogo = this.gps.getChildById('Arrival_AirportLogo')
        this.elem_airportType = this.gps.getChildById('Arrival_AirportType')
        this.elem_airportName = this.gps.getChildById('Arrival_AirportName')
        this.elem_airportCity = this.gps.getChildById('Arrival_AirportCity')
        this.elem_arrival = this.gps.getChildById('Arrival_Arrival')
        this.elem_transition = this.gps.getChildById('Arrival_Transition')
        this.elem_runway = this.gps.getChildById('Arrival_Runway')
        this.elem_sequence = this.gps.getChildById('Arrival_Sequence')
        if (this.elem_sequence) {
            if (this.nbLines == 0) {
                diffAndSetStyle(
                    _root.getElementsByClassName('Sequence')[0],
                    StyleProperty.display,
                    'none'
                )
            }
            this.sequenceSlider = this.elem_sequence.getElementsByClassName('Slider')[0]
            this.sequenceSliderCursor =
                this.sequenceSlider.getElementsByClassName('SliderCursor')[0]
        }
        this.elem_sequenceTable = this.gps.getChildById('Arrival_SequenceTable')
        this.elem_loadButton = this.gps.getChildById('Arrival_LoadButton')
        this.arrivalList = this.gps.getChildById('Arrival_ArrivalList')
        this.transitionList = this.gps.getChildById('Arrival_TransitionList')
        this.transitionLines = []
        this.runwayList = this.gps.getChildById('Arrival_RunwayList')
        this.runwayLines = []
        this.icaoSearchField = new SearchFieldWaypointICAO(
            this.gps,
            [this.elem_airportID],
            this.gps,
            'A'
        )
        if (this.elem_airportName) {
            this.nameSearchField = new SearchFieldWaypointName(
                this.gps,
                [this.elem_airportName],
                this.gps,
                'A',
                this.icaoSearchField
            )
        }
        if (this.elem_sequence && this.nbLines > 0) {
            const sliderGroupElements = new Array()
            for (let i = 1; i <= this.nbLines; i++) {
                sliderGroupElements.push(
                    new SelectableElement(
                        this.gps,
                        this.elem_sequenceTable.getElementsByClassName('L' + i)[0],
                        this.sequenceLineCallback.bind(this, i)
                    )
                )
            }
            this.sequenceSliderGroup = new SelectableElementSliderGroup(
                this.gps,
                sliderGroupElements,
                this.sequenceSlider,
                this.sequenceSliderCursor
            )
        }
        this.defaultSelectables = [
            new SelectableElement(this.gps, this.elem_arrival, this.openArrivalList.bind(this)),
            new SelectableElement(
                this.gps,
                this.elem_transition,
                this.openTransitionList.bind(this)
            ),
            new SelectableElement(this.gps, this.elem_runway, this.openRunwaysList.bind(this)),
        ]
        if (this.elem_sequence && this.nbLines > 0) {
            this.defaultSelectables.push(this.sequenceSliderGroup)
        }
        this.defaultSelectables.push(
            new SelectableElement(this.gps, this.elem_loadButton, this.loadArrival.bind(this))
        )
        this.arrivalSelectableSliderGroup = new SelectableElementSliderGroup(
            this.gps,
            [
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L1')[0],
                    this.selectArrival.bind(this, 0)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L2')[0],
                    this.selectArrival.bind(this, 1)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L3')[0],
                    this.selectArrival.bind(this, 2)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L4')[0],
                    this.selectArrival.bind(this, 3)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L5')[0],
                    this.selectArrival.bind(this, 4)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L6')[0],
                    this.selectArrival.bind(this, 5)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L7')[0],
                    this.selectArrival.bind(this, 6)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L8')[0],
                    this.selectArrival.bind(this, 7)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L9')[0],
                    this.selectArrival.bind(this, 8)
                ),
                new SelectableElement(
                    this.gps,
                    this.arrivalList.getElementsByClassName('L10')[0],
                    this.selectArrival.bind(this, 9)
                ),
            ],
            this.arrivalList.getElementsByClassName('Slider')[0],
            this.arrivalList.getElementsByClassName('SliderCursor')[0]
        )
        this.arrivalSelectables = [this.arrivalSelectableSliderGroup]
    }

    onEnter() {
        diffAndSetAttribute(this.root, 'state', 'Active')
        this.gps.ActiveSelection(this.defaultSelectables)
        const dest = this.gps.currFlightPlanManager.getDestination()
        if (dest) {
            this.icaoSearchField.SetWaypoint('A', dest.icao)
            const index = this.gps.currFlightPlanManager.getArrivalProcIndex()
            if (index >= 0) {
                this.selectedArrival = index
                this.gps.cursorIndex = 1
            }
        }
    }
    onUpdate(_deltaTime) {
        if (this.elem_airportName) {
            this.nameSearchField.Update()
        }
        this.icaoSearchField.Update()
        if (this.elem_sequence && this.nbLines > 0) {
            this.sequenceSliderGroup.updateDisplay()
        }
        const infos = this.icaoSearchField.getUpdatedInfos()
        if (infos && infos.icao) {
            diffAndSetText(this.elem_airportCity, infos.city)
            switch (infos.privateType) {
                case 0:
                    diffAndSetText(this.elem_airportType, 'Unknown')
                    break
                case 1:
                    diffAndSetText(this.elem_airportType, 'Public')
                    break
                case 2:
                    diffAndSetText(this.elem_airportType, 'Military')
                    break
                case 3:
                    diffAndSetText(this.elem_airportType, 'Private')
                    break
            }
            const logo = infos.imageFileName()
            if (logo != '') {
                diffAndSetAttribute(
                    this.elem_airportLogo,
                    'src',
                    '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo
                )
            } else {
                diffAndSetAttribute(this.elem_airportLogo, 'src', '')
            }
            const arrival = this.getSelectedArrival(infos)
            if (arrival) {
                diffAndSetText(this.elem_arrival, arrival.name)
                if (
                    arrival.enRouteTransitions &&
                    this.selectedTransition >= 0 &&
                    arrival.enRouteTransitions.length > this.selectedTransition
                ) {
                    diffAndSetText(
                        this.elem_transition,
                        arrival.enRouteTransitions[this.selectedTransition].name
                    )
                } else {
                    diffAndSetText(this.elem_transition, 'NONE')
                }
                if (
                    arrival.runwayTransitions &&
                    this.selectedRunway >= 0 &&
                    arrival.runwayTransitions.length > this.selectedRunway
                ) {
                    diffAndSetText(
                        this.elem_runway,
                        arrival.runwayTransitions[this.selectedRunway].name
                    )
                } else {
                    diffAndSetText(this.elem_runway, 'ALL')
                }
            } else {
                diffAndSetText(this.elem_arrival, 'NONE')
                diffAndSetText(this.elem_transition, 'NONE')
            }
            if (this.elem_sequence && this.nbLines > 0) {
                const sequence = []
                if (arrival) {
                    if (
                        arrival.runwayTransitions &&
                        this.selectedRunway >= 0 &&
                        arrival.runwayTransitions.length > this.selectedRunway
                    ) {
                        for (
                            let i = 0;
                            i < arrival.runwayTransitions[this.selectedRunway].legs.length;
                            i++
                        ) {
                            sequence.push(
                                '<td class="Blinking">' +
                                    arrival.runwayTransitions[this.selectedRunway].legs[
                                        i
                                    ].fixIcao.substr(7, 5) +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    fastToFixed(
                                        arrival.runwayTransitions[this.selectedRunway].legs[i]
                                            .course,
                                        0
                                    ) +
                                    '°' +
                                    '</td><td>' +
                                    fastToFixed(
                                        arrival.runwayTransitions[this.selectedRunway].legs[i]
                                            .distance,
                                        1
                                    ) +
                                    'NM' +
                                    '</td>'
                            )
                        }
                    }
                    for (let i = 0; i < arrival.commonLegs.length; i++) {
                        sequence.push(
                            '<td class="Blinking">' +
                                arrival.commonLegs[i].fixIcao.substr(7, 5) +
                                '</td><td>' +
                                ' ' +
                                '</td><td>' +
                                ' ' +
                                '</td><td>' +
                                fastToFixed(arrival.commonLegs[i].course, 0) +
                                '°' +
                                '</td><td>' +
                                fastToFixed(arrival.commonLegs[i].distance, 1) +
                                'NM' +
                                '</td>'
                        )
                    }
                    if (
                        arrival.enRouteTransitions &&
                        this.selectedTransition >= 0 &&
                        arrival.enRouteTransitions.length > this.selectedTransition
                    ) {
                        for (
                            let i = 0;
                            i < arrival.enRouteTransitions[this.selectedTransition].legs.length;
                            i++
                        ) {
                            sequence.push(
                                '<td class="Blinking">' +
                                    arrival.enRouteTransitions[this.selectedTransition].legs[
                                        i
                                    ].fixIcao.substr(7, 5) +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    fastToFixed(
                                        arrival.enRouteTransitions[this.selectedTransition].legs[i]
                                            .course,
                                        0
                                    ) +
                                    '°' +
                                    '</td><td>' +
                                    fastToFixed(
                                        arrival.enRouteTransitions[this.selectedTransition].legs[i]
                                            .distance,
                                        1
                                    ) +
                                    'NM' +
                                    '</td>'
                            )
                        }
                    }
                    this.sequenceSliderGroup.setStringElements(sequence)
                } else {
                    this.sequenceSliderGroup.setStringElements([])
                }
            }
        } else {
            diffAndSetText(this.elem_airportCity, '____________')
            diffAndSetText(this.elem_airportType, 'Unknown')
            diffAndSetAttribute(this.elem_airportLogo, 'src', '')
            this.sequenceSliderGroup.setStringElements([])
        }
    }
    onExit() {
        diffAndSetAttribute(this.root, 'state', 'Inactive')
        diffAndSetAttribute(this.arrivalList, 'state', 'Inactive')
        diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
        this.gps.currFlightPlanManager.updateFlightPlan(() => {
            this.gps.currFlightPlanManager.updateCurrentApproach()
        })
        this.gps.SwitchToInteractionState(0)
    }
    onEvent(_event) {
        if (_event == 'NavigationPush') {
            diffAndSetAttribute(this.arrivalList, 'state', 'Inactive')
            diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
            diffAndSetAttribute(this.runwayList, 'state', 'Inactive')
        }
    }

    loadArrival(_event) {
        if (_event == 'ENT_Push') {
            this.gps.currFlightPlanManager.setArrivalProcIndex(this.selectedArrival)
            this.gps.currFlightPlanManager.setArrivalRunwayIndex(this.selectedRunway)
            this.gps.currFlightPlanManager.setArrivalEnRouteTransitionIndex(this.selectedTransition)
            this.gps.closePopUpElement()
        }
    }
    sequenceLineCallback(_index, _event) {}
    activateIcaoSearch(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.icaoSearchField
            this.icaoSearchField.StartSearch()
            this.gps.SwitchToInteractionState(3)
            this.selectedArrival = 0
            this.selectedTransition = 0
        }
    }
    activateNameSearch(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.nameSearchField
            this.nameSearchField.StartSearch()
            this.gps.SwitchToInteractionState(3)
        }
    }
    getSelectedArrival(airport) {
        if (
            airport &&
            airport.arrivals &&
            this.selectedArrival >= 0 &&
            this.selectedArrival < airport.arrivals.length
        ) {
            return airport.arrivals[this.selectedArrival]
        }
        return null
    }
    openArrivalList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            const strings = []
            if (infos && infos.icao) {
                for (let i = 0; i < infos.arrivals.length; i++) {
                    strings.push(infos.arrivals[i].name)
                }
                this.arrivalSelectableSliderGroup.setStringElements(strings)
            }
            if (strings.length > 0) {
                diffAndSetAttribute(this.arrivalList, 'state', 'Active')
                this.gps.ActiveSelection(this.arrivalSelectables)
            }
        }
    }
    selectArrival(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.arrivalList, 'state', 'Inactive')
            this.selectedArrival = _id + this.arrivalSelectableSliderGroup.getOffset()
            this.gps.SwitchToInteractionState(0)
            this.selectedTransition = 0
            this.selectedRunway = 0
        }
    }
    openTransitionList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            const arrival = this.getSelectedArrival(infos)
            let nbElems = 0
            this.transitionSelectables = []
            if (arrival && arrival.enRouteTransitions.length > 0) {
                for (let i = 0; i < arrival.enRouteTransitions.length; i++) {
                    if (i >= this.transitionLines.length) {
                        this.transitionLines.push(document.createElement('div'))
                        this.transitionList.appendChild(this.transitionLines[i])
                    }
                    diffAndSetText(this.transitionLines[i], arrival.enRouteTransitions[i].name)
                    diffAndSetAttribute(this.transitionLines[i], 'state', 'Active')
                    diffAndSetAttribute(this.transitionLines[i], 'class', 'Blinking')
                    this.transitionSelectables.push(
                        new SelectableElement(
                            this.gps,
                            this.transitionLines[i],
                            this.selectTransition.bind(this, i)
                        )
                    )
                }
                nbElems = arrival.enRouteTransitions.length
            }
            for (let i = nbElems; i < this.transitionLines.length; i++) {
                diffAndSetAttribute(this.transitionLines[i], 'state', 'Inactive')
            }
            if (this.transitionSelectables.length > 0) {
                diffAndSetAttribute(this.transitionList, 'state', 'Active')
                this.gps.ActiveSelection(this.transitionSelectables)
            }
        }
    }
    selectTransition(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
            this.selectedTransition = _id
            this.gps.SwitchToInteractionState(0)
        }
    }
    openRunwaysList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            const arrival = this.getSelectedArrival(infos)
            let nbElems = 0
            this.runwaySelectables = []
            if (arrival && arrival.runwayTransitions.length > 0) {
                for (let i = 0; i < arrival.runwayTransitions.length; i++) {
                    if (i >= this.runwayLines.length) {
                        this.runwayLines.push(document.createElement('div'))
                        this.runwayList.appendChild(this.runwayLines[i])
                    }
                    diffAndSetText(this.runwayLines[i], arrival.runwayTransitions[i].name)
                    diffAndSetAttribute(this.runwayLines[i], 'state', 'Active')
                    diffAndSetAttribute(this.runwayLines[i], 'class', 'Blinking')
                    this.runwaySelectables.push(
                        new SelectableElement(
                            this.gps,
                            this.runwayLines[i],
                            this.selectRunway.bind(this, i)
                        )
                    )
                }
                nbElems = arrival.runwayTransitions.length
            }
            for (let i = nbElems; i < this.runwayLines.length; i++) {
                diffAndSetAttribute(this.runwayLines[i], 'state', 'Inactive')
            }
            if (this.runwaySelectables.length > 0) {
                diffAndSetAttribute(this.runwayList, 'state', 'Active')
                this.gps.ActiveSelection(this.runwaySelectables)
            }
        }
    }
    selectRunway(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.runwayList, 'state', 'Inactive')
            this.selectedRunway = _id
            this.gps.SwitchToInteractionState(0)
        }
    }
}
export class MFD_DepartureSelection extends NavSystemElement {
    departureList: any
    departureSelectables: any
    elem_departure: any
    elem_transition: any
    selectedDeparture: any
    selectedRunway: any
    selectedTransition: any
    transitionList: any

    departureSelectableSliderGroup: any
    elem_airportCity: any
    elem_airportID: any
    elem_airportLogo: any
    elem_airportName: any
    elem_airportType: any
    elem_loadButton: HTMLElement
    elem_runway: any
    elem_sequence: any
    elem_sequenceTable: HTMLElement
    icaoSearchField: any
    nameSearchField: any
    nbLines: number
    root: HTMLElement
    runwayLines: any
    runwayList: any
    runwaySelectables: any
    sequenceSlider: HTMLElement
    sequenceSliderCursor: any
    sequenceSliderGroup: any
    transitionLines: any
    transitionSelectables: any

    constructor(_nbLines = 6) {
        super()
        this.selectedDeparture = 0
        this.selectedTransition = 0
        this.selectedRunway = 0
        this.nbLines = _nbLines
    }

    init(_root) {
        this.root = _root
        this.elem_airportID = this.gps.getChildById('Departure_AirportID')
        this.elem_airportLogo = this.gps.getChildById('Departure_AirportLogo')
        this.elem_airportType = this.gps.getChildById('Departure_AirportType')
        this.elem_airportName = this.gps.getChildById('Departure_AirportName')
        this.elem_airportCity = this.gps.getChildById('Departure_AirportCity')
        this.elem_departure = this.gps.getChildById('Departure_Departure')
        this.elem_transition = this.gps.getChildById('Departure_Transition')
        this.elem_runway = this.gps.getChildById('Departure_Runway')
        this.elem_sequence = this.gps.getChildById('Departure_Sequence')
        if (this.elem_sequence) {
            if (this.nbLines == 0) {
                diffAndSetStyle(
                    _root.getElementsByClassName('Sequence')[0],
                    StyleProperty.display,
                    'none'
                )
            }
            this.sequenceSlider = this.elem_sequence.getElementsByClassName('Slider')[0]
            this.sequenceSliderCursor =
                this.sequenceSlider.getElementsByClassName('SliderCursor')[0]
        }
        this.elem_sequenceTable = this.gps.getChildById('Departure_SequenceTable')
        this.elem_loadButton = this.gps.getChildById('Departure_LoadButton')
        this.departureList = this.gps.getChildById('Departure_DepartureList')
        this.transitionList = this.gps.getChildById('Departure_TransitionList')
        this.transitionLines = []
        this.runwayList = this.gps.getChildById('Departure_RunwayList')
        this.runwayLines = []
        this.icaoSearchField = new SearchFieldWaypointICAO(
            this.gps,
            [this.elem_airportID],
            this.gps,
            'A'
        )
        if (this.elem_airportName) {
            this.nameSearchField = new SearchFieldWaypointName(
                this.gps,
                [this.elem_airportName],
                this.gps,
                'A',
                this.icaoSearchField
            )
        }
        if (this.elem_sequence && this.nbLines > 0) {
            const sliderGroupElements = new Array()
            for (let i = 1; i <= this.nbLines; i++) {
                sliderGroupElements.push(
                    new SelectableElement(
                        this.gps,
                        this.elem_sequenceTable.getElementsByClassName('L' + i)[0],
                        this.sequenceLineCallback.bind(this, i)
                    )
                )
            }
            this.sequenceSliderGroup = new SelectableElementSliderGroup(
                this.gps,
                sliderGroupElements,
                this.sequenceSlider,
                this.sequenceSliderCursor
            )
        }
        this.defaultSelectables = [
            new SelectableElement(this.gps, this.elem_departure, this.openDepartureList.bind(this)),
            new SelectableElement(
                this.gps,
                this.elem_transition,
                this.openTransitionList.bind(this)
            ),
            new SelectableElement(this.gps, this.elem_runway, this.openRunwaysList.bind(this)),
        ]
        if (this.elem_sequence && this.nbLines > 0) {
            this.defaultSelectables.push(this.sequenceSliderGroup)
        }
        this.defaultSelectables.push(
            new SelectableElement(this.gps, this.elem_loadButton, this.loadDeparture.bind(this))
        )
        this.departureSelectableSliderGroup = new SelectableElementSliderGroup(
            this.gps,
            [
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L1')[0],
                    this.selectDeparture.bind(this, 0)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L2')[0],
                    this.selectDeparture.bind(this, 1)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L3')[0],
                    this.selectDeparture.bind(this, 2)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L4')[0],
                    this.selectDeparture.bind(this, 3)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L5')[0],
                    this.selectDeparture.bind(this, 4)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L6')[0],
                    this.selectDeparture.bind(this, 5)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L7')[0],
                    this.selectDeparture.bind(this, 6)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L8')[0],
                    this.selectDeparture.bind(this, 7)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L9')[0],
                    this.selectDeparture.bind(this, 8)
                ),
                new SelectableElement(
                    this.gps,
                    this.departureList.getElementsByClassName('L10')[0],
                    this.selectDeparture.bind(this, 9)
                ),
            ],
            this.departureList.getElementsByClassName('Slider')[0],
            this.departureList.getElementsByClassName('SliderCursor')[0]
        )
        this.departureSelectables = [this.departureSelectableSliderGroup]
    }

    onEnter() {
        diffAndSetAttribute(this.root, 'state', 'Active')
        this.gps.ActiveSelection(this.defaultSelectables)
        const dest = this.gps.currFlightPlanManager.getOrigin()
        if (dest) {
            this.icaoSearchField.SetWaypoint('A', dest.icao)
            const index = this.gps.currFlightPlanManager.getDepartureProcIndex()
            if (index >= 0) {
                this.selectedDeparture = index
                this.gps.cursorIndex = 1
            }
        }
    }
    onUpdate(_deltaTime) {
        if (this.elem_airportName) {
            this.nameSearchField.Update()
        }
        this.icaoSearchField.Update()
        if (this.elem_sequence && this.nbLines > 0) {
            this.sequenceSliderGroup.updateDisplay()
        }
        const infos = this.icaoSearchField.getUpdatedInfos()
        if (infos && infos.icao) {
            diffAndSetText(this.elem_airportCity, infos.city)
            switch (infos.privateType) {
                case 0:
                    diffAndSetText(this.elem_airportType, 'Unknown')
                    break
                case 1:
                    diffAndSetText(this.elem_airportType, 'Public')
                    break
                case 2:
                    diffAndSetText(this.elem_airportType, 'Military')
                    break
                case 3:
                    diffAndSetText(this.elem_airportType, 'Private')
                    break
            }
            const logo = infos.imageFileName()
            if (logo != '') {
                diffAndSetAttribute(
                    this.elem_airportLogo,
                    'src',
                    '/Pages/VCockpit/Instruments/Shared/Map/Images/' + logo
                )
            } else {
                diffAndSetAttribute(this.elem_airportLogo, 'src', '')
            }
            const departure = this.getSelectedDeparture(infos)
            if (departure) {
                diffAndSetText(this.elem_departure, departure.name)
                if (
                    this.selectedTransition >= 0 &&
                    departure.enRouteTransitions.length > this.selectedTransition
                ) {
                    diffAndSetText(
                        this.elem_transition,
                        departure.enRouteTransitions[this.selectedTransition].name
                    )
                } else {
                    diffAndSetText(this.elem_transition, 'NONE')
                }
                if (
                    this.selectedRunway >= 0 &&
                    departure.runwayTransitions.length > this.selectedRunway
                ) {
                    diffAndSetText(
                        this.elem_runway,
                        departure.runwayTransitions[this.selectedRunway].name
                    )
                } else {
                    diffAndSetText(this.elem_runway, 'ALL')
                }
            } else {
                diffAndSetText(this.elem_departure, 'NONE')
                diffAndSetText(this.elem_transition, 'NONE')
            }
            if (this.elem_sequence && this.nbLines > 0) {
                const sequence = []
                if (departure) {
                    if (
                        departure.enRouteTransitions &&
                        this.selectedTransition >= 0 &&
                        departure.enRouteTransitions.length > this.selectedTransition
                    ) {
                        for (
                            let i = 0;
                            i < departure.enRouteTransitions[this.selectedTransition].legs.length;
                            i++
                        ) {
                            sequence.push(
                                '<td class="Blinking">' +
                                    departure.enRouteTransitions[this.selectedTransition].legs[
                                        i
                                    ].fixIcao.substr(7, 5) +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    fastToFixed(
                                        departure.enRouteTransitions[this.selectedTransition].legs[
                                            i
                                        ].course,
                                        0
                                    ) +
                                    '°' +
                                    '</td><td>' +
                                    fastToFixed(
                                        departure.enRouteTransitions[this.selectedTransition].legs[
                                            i
                                        ].distance,
                                        1
                                    ) +
                                    'NM' +
                                    '</td>'
                            )
                        }
                    }
                    for (let i = 0; i < departure.commonLegs.length; i++) {
                        sequence.push(
                            '<td class="Blinking">' +
                                departure.commonLegs[i].fixIcao.substr(7, 5) +
                                '</td><td>' +
                                ' ' +
                                '</td><td>' +
                                ' ' +
                                '</td><td>' +
                                fastToFixed(departure.commonLegs[i].course, 0) +
                                '°' +
                                '</td><td>' +
                                fastToFixed(departure.commonLegs[i].distance, 1) +
                                'NM' +
                                '</td>'
                        )
                    }
                    if (
                        departure.enRouteTransitions &&
                        this.selectedRunway >= 0 &&
                        departure.enRouteTransitions.length > this.selectedRunway
                    ) {
                        for (
                            let i = 0;
                            i < departure.runwayTransitions[this.selectedRunway].legs.length;
                            i++
                        ) {
                            sequence.push(
                                '<td class="Blinking">' +
                                    departure.runwayTransitions[this.selectedRunway].legs[
                                        i
                                    ].fixIcao.substr(7, 5) +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    ' ' +
                                    '</td><td>' +
                                    fastToFixed(
                                        departure.runwayTransitions[this.selectedRunway].legs[i]
                                            .course,
                                        0
                                    ) +
                                    '°' +
                                    '</td><td>' +
                                    fastToFixed(
                                        departure.runwayTransitions[this.selectedRunway].legs[i]
                                            .distance,
                                        1
                                    ) +
                                    'NM' +
                                    '</td>'
                            )
                        }
                    }
                    this.sequenceSliderGroup.setStringElements(sequence)
                } else {
                    this.sequenceSliderGroup.setStringElements([])
                }
            }
        } else {
            diffAndSetText(this.elem_airportCity, '____________')
            diffAndSetText(this.elem_airportType, 'Unknown')
            diffAndSetAttribute(this.elem_airportLogo, 'src', '')
            if (this.elem_sequence && this.nbLines > 0) {
                this.sequenceSliderGroup.setStringElements([])
            }
        }
    }
    onExit() {
        diffAndSetAttribute(this.root, 'state', 'Inactive')
        diffAndSetAttribute(this.departureList, 'state', 'Inactive')
        diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
        this.gps.currFlightPlanManager.updateFlightPlan(() => {
            this.gps.currFlightPlanManager.updateCurrentApproach()
        })
        this.gps.SwitchToInteractionState(0)
    }
    onEvent(_event) {
        if (_event == 'NavigationPush') {
            diffAndSetAttribute(this.departureList, 'state', 'Inactive')
            diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
            diffAndSetAttribute(this.runwayList, 'state', 'Inactive')
        }
    }

    loadDeparture(_event) {
        if (_event == 'ENT_Push') {
            this.gps.currFlightPlanManager.setDepartureProcIndex(this.selectedDeparture)
            this.gps.currFlightPlanManager.setDepartureRunwayIndex(this.selectedRunway)
            this.gps.currFlightPlanManager.setDepartureEnRouteTransitionIndex(
                this.selectedTransition
            )
            this.gps.closePopUpElement()
        }
    }
    sequenceLineCallback(_index, _event) {}
    activateIcaoSearch(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.icaoSearchField
            this.icaoSearchField.StartSearch()
            this.gps.SwitchToInteractionState(3)
            this.selectedDeparture = 0
            this.selectedTransition = 0
        }
    }
    activateNameSearch(_event) {
        if (_event == 'NavigationSmallInc' || _event == 'NavigationSmallDec') {
            this.gps.currentSearchFieldWaypoint = this.nameSearchField
            this.nameSearchField.StartSearch()
            this.gps.SwitchToInteractionState(3)
        }
    }
    openDepartureList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            const strings = []
            if (infos && infos.icao) {
                for (let i = 0; i < infos.departures.length; i++) {
                    strings.push(infos.departures[i].name)
                }
                this.departureSelectableSliderGroup.setStringElements(strings)
            }
            if (strings.length > 0) {
                diffAndSetAttribute(this.departureList, 'state', 'Active')
                this.gps.ActiveSelection(this.departureSelectables)
            }
        }
    }
    selectDeparture(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.departureList, 'state', 'Inactive')
            this.selectedDeparture = _id + this.departureSelectableSliderGroup.getOffset()
            this.gps.SwitchToInteractionState(0)
            this.selectedTransition = 0
            this.selectedRunway = 0
        }
    }
    getSelectedDeparture(airport) {
        if (
            airport &&
            airport.departures &&
            this.selectedDeparture >= 0 &&
            airport.departures.length > this.selectedDeparture
        ) {
            return airport.departures[this.selectedDeparture]
        }
        return null
    }
    openTransitionList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            let nbElems = 0
            this.transitionSelectables = []
            const departure = this.getSelectedDeparture(infos)
            if (departure && departure.enRouteTransitions.length > 0) {
                for (let i = 0; i < departure.enRouteTransitions.length; i++) {
                    if (i >= this.transitionLines.length) {
                        this.transitionLines.push(document.createElement('div'))
                        this.transitionList.appendChild(this.transitionLines[i])
                    }
                    diffAndSetText(this.transitionLines[i], departure.enRouteTransitions[i].name)
                    diffAndSetAttribute(this.transitionLines[i], 'state', 'Active')
                    diffAndSetAttribute(this.transitionLines[i], 'class', 'Blinking')
                    this.transitionSelectables.push(
                        new SelectableElement(
                            this.gps,
                            this.transitionLines[i],
                            this.selectTransition.bind(this, i)
                        )
                    )
                }
                nbElems = departure.enRouteTransitions.length
            }
            for (let i = nbElems; i < this.transitionLines.length; i++) {
                diffAndSetAttribute(this.transitionLines[i], 'state', 'Inactive')
            }
            if (this.transitionSelectables.length > 0) {
                diffAndSetAttribute(this.transitionList, 'state', 'Active')
                this.gps.ActiveSelection(this.transitionSelectables)
            }
        }
    }
    selectTransition(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.transitionList, 'state', 'Inactive')
            this.selectedTransition = _id
            this.gps.SwitchToInteractionState(0)
        }
    }
    openRunwaysList(_event) {
        if (
            _event == 'ENT_Push' ||
            _event == 'NavigationSmallInc' ||
            _event == 'NavigationSmallDec'
        ) {
            const infos = this.icaoSearchField.getUpdatedInfos()
            let nbElems = 0
            this.runwaySelectables = []
            const departure = this.getSelectedDeparture(infos)
            if (departure && departure.runwayTransitions.length > 0) {
                for (let i = 0; i < departure.runwayTransitions.length; i++) {
                    if (i >= this.runwayLines.length) {
                        this.runwayLines.push(document.createElement('div'))
                        this.runwayList.appendChild(this.runwayLines[i])
                    }
                    diffAndSetText(this.runwayLines[i], departure.runwayTransitions[i].name)
                    diffAndSetAttribute(this.runwayLines[i], 'state', 'Active')
                    diffAndSetAttribute(this.runwayLines[i], 'class', 'Blinking')
                    this.runwaySelectables.push(
                        new SelectableElement(
                            this.gps,
                            this.runwayLines[i],
                            this.selectRunway.bind(this, i)
                        )
                    )
                }
                nbElems = departure.runwayTransitions.length
            }
            for (let i = nbElems; i < this.runwayLines.length; i++) {
                diffAndSetAttribute(this.runwayLines[i], 'state', 'Inactive')
            }
            if (this.runwaySelectables.length > 0) {
                diffAndSetAttribute(this.runwayList, 'state', 'Active')
                this.gps.ActiveSelection(this.runwaySelectables)
            }
        }
    }
    selectRunway(_id, _event) {
        if (_event == 'ENT_Push') {
            diffAndSetAttribute(this.runwayList, 'state', 'Inactive')
            this.selectedRunway = _id
            this.gps.SwitchToInteractionState(0)
        }
    }
}
