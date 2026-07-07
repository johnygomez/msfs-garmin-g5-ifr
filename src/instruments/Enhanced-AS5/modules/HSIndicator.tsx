import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    Subject,
    Subscription,
} from '@microsoft/msfs-sdk'
import { SimVarValueType } from '@microsoft/msfs-sdk'

export enum HSIndicatorDisplayType {
    GlassCockpit = 0,
    HUD = 1,
    HUD_Simplified = 2,
}

export interface HSIComponentProps extends ComponentProps {
    noHeadingValue: boolean
    noCourseValue: boolean
    noCenterText: boolean
    noTurnRateIndicator: boolean
    noBackground: boolean
    noAffectSimRadioNav: boolean
    largeCompass: boolean
    displayStyle: HSIndicatorDisplayType
    fmsAlias: string
    chevronBug2?: SVGElement
    diamondBug2?: SVGElement
    hollowDiamondBug2?: SVGElement
    heading: Subject<number>
    course: Subject<number>
    cdiDeviation: Subject<number>
    bearing1: Subject<number>
    bearing2: Subject<number>
    dmeDistance: Subject<number>
    turnRate: Subject<number>
    headingValue: Subject<string>
    groundSpeedValue: Subject<string>
    waypointDistanceValue: Subject<string>
    waypointMode: Subject<string>
}

export class HSIComponent extends DisplayComponent<HSIComponentProps> {
    chevronBug2: any
    diamondBug2: any
    hollowDiamondBug2: any

    private readonly rootRef = FSComponent.createRef<SVGSVGElement>()
    private readonly rotatingRoseRef = FSComponent.createRef<SVGGElement>()
    private readonly headingBugRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly courseGroupRef = FSComponent.createRef<SVGGElement>()
    private readonly courseDeviationNeedleRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly beginArrowRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly endArrowRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly toIndicatorRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly fromIndicatorRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly turnRateArcRef = FSComponent.createRef<SVGPathElement>()
    private readonly navSourceRef = FSComponent.createRef<SVGTextElement>()
    private readonly flightPhaseRef = FSComponent.createRef<SVGTextElement>()
    private readonly flightPhaseBgRef = FSComponent.createRef<SVGRectElement>()
    private readonly xtkRef = FSComponent.createRef<SVGTextElement>()
    private readonly xtkBgRef = FSComponent.createRef<SVGRectElement>()
    private readonly dmeGroupRef = FSComponent.createRef<SVGGElement>()
    private readonly dmeSourceRef = FSComponent.createRef<SVGTextElement>()
    private readonly dmeIdentRef = FSComponent.createRef<SVGTextElement>()
    private readonly dmeDistanceRef = FSComponent.createRef<SVGTextElement>()
    private readonly bearing1Ref = FSComponent.createRef<SVGGElement>()
    private readonly bearing2Ref = FSComponent.createRef<SVGGElement>()
    private readonly innerCircleRef = FSComponent.createRef<SVGCircleElement>()
    private readonly bearing1FixedGroupRef = FSComponent.createRef<SVGGElement>()
    private readonly bearing2FixedGroupRef = FSComponent.createRef<SVGGElement>()
    private readonly bearing1SourceRef = FSComponent.createRef<SVGTextElement>()
    private readonly bearing1IdentRef = FSComponent.createRef<SVGTextElement>()
    private readonly bearing1DistanceRef = FSComponent.createRef<SVGTextElement>()
    private readonly bearing2SourceRef = FSComponent.createRef<SVGTextElement>()
    private readonly bearing2IdentRef = FSComponent.createRef<SVGTextElement>()
    private readonly bearing2DistanceRef = FSComponent.createRef<SVGTextElement>()
    private readonly bearingTextRef = FSComponent.createRef<SVGTextElement>()
    private readonly headingValueRef = FSComponent.createRef<SVGTextElement>()
    private readonly courseValueRef = FSComponent.createRef<SVGTextElement>()
    private readonly currentTrackIndicatorRef = FSComponent.createRef<SVGPolygonElement>()
    private readonly navSourceBgRef = FSComponent.createRef<SVGRectElement>()

    private readonly subs: Subscription[] = []

    get noHeadingValue(): boolean {
        return this.props.noHeadingValue
    }
    get noCourseValue(): boolean {
        return this.props.noCourseValue
    }
    get noCenterText(): boolean {
        return this.props.noCenterText
    }
    get noTurnRateIndicator(): boolean {
        return this.props.noTurnRateIndicator
    }
    get noBackground(): boolean {
        return this.props.noBackground
    }
    get noAffectSimRadioNav(): boolean {
        return this.props.noAffectSimRadioNav
    }
    get largeCompass(): boolean {
        return this.props.largeCompass
    }
    get displayStyle(): HSIndicatorDisplayType {
        return this.props.displayStyle
    }
    get fmsAlias(): string {
        return this.props.fmsAlias
    }

    crosstrackFullError: number
    isDmeDisplayed: boolean
    isBearing1Displayed: boolean
    isBearing2Displayed: boolean
    crossTrackCurrent: number
    crossTrackGoal: number
    sourceIsGps: boolean
    logic_dmeDisplayed: boolean
    logic_dmeSource: number
    logic_cdiSource: number
    logic_brg1Source: number
    logic_brg2Source: number
    logic_navSelected: number
    gpsNextWpIdValidFrames: any[]
    gpsNextWpDesiredTrkFrames: any[]
    gpsNextWpXTrkFrames: any[]
    gpsNextWpIdValid: boolean
    _lastAPPRHold: boolean
    GF_font: string
    font: string
    curPhase: number
    curDeviation: number

    get displayHeight() {
        return this.largeCompass ? 156 : 116
    }

    constructor(props: HSIComponentProps) {
        super(props)
        this.crosstrackFullError = 2
        this.isDmeDisplayed = false
        this.isBearing1Displayed = false
        this.isBearing2Displayed = false
        this.crossTrackCurrent = 0
        this.crossTrackGoal = 0
        this.sourceIsGps = true
        this.logic_dmeDisplayed = false
        this.logic_dmeSource = 1
        this.logic_cdiSource = 0
        this.logic_brg1Source = 0
        this.logic_brg2Source = 0
        this.logic_navSelected = 0
        this.gpsNextWpIdValidFrames = []
        this.gpsNextWpDesiredTrkFrames = []
        this.gpsNextWpXTrkFrames = []
        this.gpsNextWpIdValid = false
        this._lastAPPRHold = false
        this.GF_font = 'Montserrat-Bold'
        this.font = 'Roboto-Bold'
        this.chevronBug2 = props.chevronBug2 || null
        this.diamondBug2 = props.diamondBug2 || null
        this.hollowDiamondBug2 = props.hollowDiamondBug2 || null
    }

    onAfterRender(): void {
        this.subs.push(
            this.props.heading.sub(value => {
                const hb = this.headingBugRef.getOrDefault()
                if (hb) diffAndSetAttribute(hb, 'transform', `rotate(${value}, 50, 50)`)
            }, true),

            this.props.course.sub(value => {
                const cg = this.courseGroupRef.getOrDefault()
                if (cg) diffAndSetAttribute(cg, 'transform', `rotate(${value}, 50, 50)`)
                const ct = this.courseValueRef.getOrDefault()
                if (ct) {
                    const crs = fastToFixed(value, 0)
                    diffAndSetText(ct, '000'.slice(crs.length) + crs + Avionics.Utils.DEGREE_SYMBOL)
                }
            }, true),

            this.props.cdiDeviation.sub(deviation => {
                const cdi = this.courseDeviationNeedleRef.getOrDefault()
                if (!cdi) return
                const clampedPosition = Math.min(Math.max(deviation, -1), 1) * 30
                diffAndSetAttribute(cdi, 'transform', `translate(${clampedPosition}, 0)`)
            }, true),

            this.props.bearing1.sub(value => {
                const b1 = this.bearing1Ref.getOrDefault()
                if (!b1) return
                if (isNaN(value) || value === null || value === undefined) {
                    diffAndSetAttribute(b1, 'visibility', 'hidden')
                } else {
                    diffAndSetAttribute(b1, 'transform', `rotate(${value}, 50, 50)`)
                    diffAndSetAttribute(b1, 'visibility', 'visible')
                }
            }, true),

            this.props.bearing2.sub(value => {
                const b2 = this.bearing2Ref.getOrDefault()
                if (!b2) return
                if (isNaN(value) || value === null || value === undefined) {
                    diffAndSetAttribute(b2, 'visibility', 'hidden')
                } else {
                    diffAndSetAttribute(b2, 'transform', `rotate(${value}, 50, 50)`)
                    diffAndSetAttribute(b2, 'visibility', 'visible')
                }
            }, true),

            this.props.dmeDistance.sub(distance => {
                const el = this.dmeDistanceRef.getOrDefault()
                if (el) diffAndSetText(el, fastToFixed(distance, 1) + 'NM')
            }, true),

            this.props.turnRate.sub(rate => {
                this.setTurnRate(String(rate))
            }, true),

            this.props.headingValue.sub(value => {
                const ht = this.headingValueRef.getOrDefault()
                if (ht) diffAndSetText(ht, value)
            }, true),

            this.props.groundSpeedValue.sub(_value => {}, true),

            this.props.waypointDistanceValue.sub(_value => {}, true),

            this.props.waypointMode.sub(_mode => {}, true)
        )
    }

    destroy(): void {
        this.subs.forEach(s => s.destroy())
        super.destroy()
    }

    init() {
        this.logic_brg1Source = SimVar.GetSimVarValue('L:PFD_BRG1_Source', SimVarValueType.Number)
        this.logic_brg2Source = SimVar.GetSimVarValue('L:PFD_BRG2_Source', SimVarValueType.Number)
        if (this.logic_brg1Source != 0) {
            this.setShowBearing1(true)
        }
        if (this.logic_brg2Source != 0) {
            this.setShowBearing2(true)
        }
    }

    onExit() {}

    onEvent(_event: any) {
        switch (_event) {
            case 'CRS_INC':
                if (!this.noAffectSimRadioNav) {
                    if (this.logic_cdiSource == 1) {
                        SimVar.SetSimVarValue('K:VOR1_OBI_INC', SimVarValueType.Number, 0)
                    } else if (this.logic_cdiSource == 2) {
                        SimVar.SetSimVarValue('K:VOR2_OBI_INC', SimVarValueType.Number, 0)
                    } else if (SimVar.GetSimVarValue('GPS OBS ACTIVE', SimVarValueType.Bool)) {
                        SimVar.SetSimVarValue('K:GPS_OBS_INC', SimVarValueType.Number, 0)
                    }
                }
                break
            case 'CRS_DEC':
                if (!this.noAffectSimRadioNav) {
                    if (this.logic_cdiSource == 1) {
                        SimVar.SetSimVarValue('K:VOR1_OBI_DEC', SimVarValueType.Number, 0)
                    } else if (this.logic_cdiSource == 2) {
                        SimVar.SetSimVarValue('K:VOR2_OBI_DEC', SimVarValueType.Number, 0)
                    } else if (SimVar.GetSimVarValue('GPS OBS ACTIVE', SimVarValueType.Bool)) {
                        SimVar.SetSimVarValue('K:GPS_OBS_DEC', SimVarValueType.Number, 0)
                    }
                }
                break
            case 'CRS_PUSH':
                if (!this.noAffectSimRadioNav) {
                    if (this.logic_cdiSource == 1) {
                        SimVar.SetSimVarValue(
                            'K:VOR1_SET',
                            SimVarValueType.Number,
                            (180 + SimVar.GetSimVarValue('NAV RADIAL:1', SimVarValueType.Degree)) %
                                360
                        )
                    } else if (this.logic_cdiSource == 2) {
                        SimVar.SetSimVarValue(
                            'K:VOR2_SET',
                            SimVarValueType.Number,
                            (180 + SimVar.GetSimVarValue('NAV RADIAL:2', SimVarValueType.Degree)) %
                                360
                        )
                    }
                }
                break
            case 'SoftKeys_PFD_DME':
                this.logic_dmeDisplayed = !this.logic_dmeDisplayed
                if (!this.noAffectSimRadioNav) {
                    SimVar.SetSimVarValue(
                        'L:PFD_DME_Displayed',
                        SimVarValueType.Number,
                        this.logic_dmeDisplayed ? 1 : 0
                    )
                }
                if (this.logic_dmeDisplayed) {
                    this.setShowDme(true)
                } else {
                    this.setShowDme(false)
                }
                break
            case 'SoftKeys_PFD_BRG1':
            case 'BRG1Switch':
                this.logic_brg1Source =
                    (SimVar.GetSimVarValue('L:PFD_BRG1_Source', SimVarValueType.Number) + 1) % 5
                if (!this.noAffectSimRadioNav) {
                    SimVar.SetSimVarValue(
                        'L:PFD_BRG1_Source',
                        SimVarValueType.Number,
                        this.logic_brg1Source
                    )
                }
                if (this.logic_brg1Source == 0) {
                    this.setShowBearing1(false)
                } else {
                    this.setShowBearing1(true)
                }
                break
            case 'SoftKeys_PFD_BRG2':
            case 'BRG2Switch':
                this.logic_brg2Source =
                    (SimVar.GetSimVarValue('L:PFD_BRG2_Source', SimVarValueType.Number) + 1) % 5
                if (!this.noAffectSimRadioNav) {
                    SimVar.SetSimVarValue(
                        'L:PFD_BRG2_Source',
                        SimVarValueType.Number,
                        this.logic_brg2Source
                    )
                }
                if (this.logic_brg2Source == 0) {
                    this.setShowBearing2(false)
                } else {
                    this.setShowBearing2(true)
                }
                break
            case 'SoftKey_CDI':
            case 'NavSourceSwitch':
                this.logic_cdiSource = (this.logic_cdiSource % 3) + 1
                const isGPSDrived = SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)
                if (
                    this.logic_cdiSource == 2 &&
                    !SimVar.GetSimVarValue('NAV AVAILABLE:2', SimVarValueType.Bool)
                ) {
                    this.logic_cdiSource = 3
                }
                if (!this.noAffectSimRadioNav) {
                    if ((this.logic_cdiSource == 3) != isGPSDrived) {
                        SimVar.SetSimVarValue('K:TOGGLE_GPS_DRIVES_NAV1', SimVarValueType.Bool, 0)
                    }
                    if (this.logic_cdiSource != 3) {
                        ;(Simplane as any).setAutoPilotSelectedNav(this.logic_cdiSource)
                    }
                }
                break
        }
    }

    private applyHUDStyle(_elem: Element) {
        diffAndSetAttribute(_elem, 'fill', 'rgb(26,29,33)')
        diffAndSetAttribute(_elem, 'fill-opacity', '0.5')
        diffAndSetAttribute(_elem, 'stroke', 'rgb(255, 255, 255)')
        diffAndSetAttribute(_elem, 'stroke-width', '0.75')
        diffAndSetAttribute(_elem, 'stroke-opacity', '0.2')
    }

    private getExternalTextZonePath(
        radius: number,
        beginAngle: number,
        endAngle: number,
        xEnd: number,
        reverse = false
    ): string {
        const beginX = 50 - radius * Math.cos(beginAngle)
        const beginY = 50 - radius * Math.sin(beginAngle)
        const endX = 50 - radius * Math.cos(endAngle)
        const endY = 50 - radius * Math.sin(endAngle)
        let path =
            'M' +
            beginX +
            ' ' +
            beginY +
            'L' +
            xEnd +
            ' ' +
            beginY +
            'L' +
            xEnd +
            ' ' +
            endY +
            'L' +
            endX +
            ' ' +
            endY
        path +=
            'A ' + radius + ' ' + radius + ' 0 0 ' + (reverse ? 0 : 1) + ' ' + beginX + ' ' + beginY
        return path
    }

    private addValueInFrames(value: any, frames: any[], maxFrames: number) {
        if (frames != undefined) {
            frames.push(value)
            while (frames.length > maxFrames) {
                frames.shift()
            }
        }
    }

    private setToggleDme(visible: boolean) {
        this.isDmeDisplayed = visible
        const el = this.dmeGroupRef.getOrDefault()
        if (el) {
            diffAndSetAttribute(el, 'display', visible ? 'inherit' : 'none')
        }
    }

    private setShowDme(visible: boolean) {
        this.setToggleDme(visible)
    }

    private updateBearingVisibility() {
        const inner = this.innerCircleRef.getOrDefault()
        if (inner) {
            diffAndSetAttribute(
                inner,
                'display',
                this.isBearing1Displayed || this.isBearing2Displayed ? 'inherit' : 'none'
            )
        }
    }

    private setToggleBearing1(visible: boolean) {
        this.isBearing1Displayed = visible
        this.updateBearingVisibility()
        const b1 = this.bearing1Ref.getOrDefault()
        if (b1) {
            diffAndSetAttribute(b1, 'display', visible ? 'inherit' : 'none')
        }
        const b1f = this.bearing1FixedGroupRef.getOrDefault()
        if (b1f) {
            diffAndSetAttribute(b1f, 'display', visible ? 'inherit' : 'none')
        }
    }

    private setShowBearing1(visible: boolean) {
        this.setToggleBearing1(visible)
    }

    private setToggleBearing2(visible: boolean) {
        this.isBearing2Displayed = visible
        this.updateBearingVisibility()
        const b2 = this.bearing2Ref.getOrDefault()
        if (b2) {
            diffAndSetAttribute(b2, 'display', visible ? 'inherit' : 'none')
        }
        const b2f = this.bearing2FixedGroupRef.getOrDefault()
        if (b2f) {
            diffAndSetAttribute(b2f, 'display', visible ? 'inherit' : 'none')
        }
    }

    private setShowBearing2(visible: boolean) {
        this.setToggleBearing2(visible)
    }

    private setRotation(value: string) {
        const bg = this.rotatingRoseRef.getOrDefault()
        if (bg) {
            diffAndSetAttribute(bg, 'transform', 'rotate(' + -value + ' 50 50)')
        }
        const bt = this.bearingTextRef.getOrDefault()
        if (bt) {
            let brg = Math.round(parseFloat(value))
            brg = brg == 0 ? 360 : brg
            diffAndSetText(bt, '000'.slice((brg + '').length) + brg + Avionics.Utils.DEGREE_SYMBOL)
        }
    }

    private setHeadingBugRotation(value: string) {
        const hb = this.headingBugRef.getOrDefault()
        if (hb) {
            diffAndSetAttribute(hb, 'transform', 'rotate(' + value + ', 50, 50)')
        }
        const ht = this.headingValueRef.getOrDefault()
        if (ht) {
            let headingValue = parseFloat(value)
            if (headingValue == 0) {
                headingValue = 360
            }
            const hdg = fastToFixed(headingValue, 0)
            diffAndSetText(ht, '000'.slice(hdg.length) + hdg + Avionics.Utils.DEGREE_SYMBOL)
        }
    }

    private setCourse(value: string) {
        const cg = this.courseGroupRef.getOrDefault()
        if (cg) {
            diffAndSetAttribute(cg, 'transform', 'rotate(' + value + ', 50, 50)')
        }
        const ct = this.courseValueRef.getOrDefault()
        if (ct) {
            const crs = fastToFixed(parseFloat(value), 0)
            diffAndSetText(ct, '000'.slice(crs.length) + crs + Avionics.Utils.DEGREE_SYMBOL)
        }
    }

    private setCourseDeviation(value: string) {
        const cdi = this.courseDeviationNeedleRef.getOrDefault()
        if (cdi) {
            const deviation = parseFloat(value)
            if (this.sourceIsGps) {
                this.crossTrackGoal =
                    Math.min(
                        Math.max(deviation, -this.crosstrackFullError),
                        this.crosstrackFullError
                    ) *
                    (20 / this.crosstrackFullError)
                if (Math.abs(deviation) < this.crosstrackFullError) {
                    diffAndSetAttribute(this.xtkRef.getOrDefault()!, 'visibility', 'hidden')
                    diffAndSetAttribute(this.xtkBgRef.getOrDefault()!, 'visibility', 'hidden')
                } else {
                    diffAndSetAttribute(this.xtkRef.getOrDefault()!, 'visibility', 'visible')
                    diffAndSetAttribute(this.xtkBgRef.getOrDefault()!, 'visibility', 'visible')
                    diffAndSetText(
                        this.xtkRef.getOrDefault()!,
                        'XTK ' + fastToFixed(deviation, 2) + 'NM'
                    )
                }
            } else {
                this.crossTrackGoal = Math.min(Math.max(deviation, -1), 1) * 20
            }
        }
    }

    private setDisplayDeviation(value: string) {
        const cdi = this.courseDeviationNeedleRef.getOrDefault()
        if (cdi) {
            diffAndSetAttribute(cdi, 'display', value == 'True' ? '' : 'none')
        }
    }

    private setTurnRate(value: string) {
        const arc = this.turnRateArcRef.getOrDefault()
        if (arc) {
            const turnRate = Math.max(Math.min(parseFloat(value), 4), -4)
            const arcAngle = (6 * turnRate * Math.PI) / 180
            const arcRadius = 53
            const arcWidth = 2
            const arrowWidth = 6
            const beginPointTopX = 50
            const beginPointBotX = 50
            const beginPointTopY = 50 - arcRadius - arcWidth / 2
            const beginPointBotY = 50 - arcRadius + arcWidth / 2
            const endPointTopX = 50 + Math.sin(arcAngle) * (arcRadius + arcWidth / 2)
            const endPointBotX = 50 + Math.sin(arcAngle) * (arcRadius - arcWidth / 2)
            const endPointTopY = 50 - Math.cos(arcAngle) * (arcRadius + arcWidth / 2)
            const endPointBotY = 50 - Math.cos(arcAngle) * (arcRadius - arcWidth / 2)
            let path
            if (turnRate == 4 || turnRate == -4) {
                const endPointArrowTopX = 50 + Math.sin(arcAngle) * (arcRadius + arrowWidth / 2)
                const endPointArrowBotX = 50 + Math.sin(arcAngle) * (arcRadius - arrowWidth / 2)
                const endPointArrowTopY = 50 - Math.cos(arcAngle) * (arcRadius + arrowWidth / 2)
                const endPointArrowBotY = 50 - Math.cos(arcAngle) * (arcRadius - arrowWidth / 2)
                const endPointArrowEndX =
                    50 + Math.sin(arcAngle + (turnRate > 0 ? 0.1 : -0.1)) * arcRadius
                const endPointArrowEndY =
                    50 - Math.cos(arcAngle + (turnRate > 0 ? 0.1 : -0.1)) * arcRadius
                path =
                    'M' +
                    beginPointBotX +
                    ' ' +
                    beginPointBotY +
                    'A ' +
                    (arcRadius - arcWidth / 2) +
                    ' ' +
                    (arcRadius - arcWidth / 2) +
                    ' 0 0 ' +
                    (arcAngle > 0 ? '1' : '0') +
                    ' ' +
                    endPointBotX +
                    ' ' +
                    endPointBotY
                path +=
                    'L' +
                    endPointArrowBotX +
                    ' ' +
                    endPointArrowBotY +
                    ' L' +
                    endPointArrowEndX +
                    ' ' +
                    endPointArrowEndY +
                    ' L' +
                    endPointArrowTopX +
                    ' ' +
                    endPointArrowTopY
                path +=
                    'L' +
                    endPointTopX +
                    ' ' +
                    endPointTopY +
                    'A ' +
                    (arcRadius + arcWidth / 2) +
                    ' ' +
                    (arcRadius + arcWidth / 2) +
                    ' 0 0 ' +
                    (arcAngle > 0 ? '0' : '1') +
                    ' ' +
                    beginPointTopX +
                    ' ' +
                    beginPointTopY
            } else {
                path =
                    'M' +
                    beginPointBotX +
                    ' ' +
                    beginPointBotY +
                    'A ' +
                    (arcRadius - arcWidth / 2) +
                    ' ' +
                    (arcRadius - arcWidth / 2) +
                    ' 0 0 ' +
                    (arcAngle > 0 ? '1' : '0') +
                    ' ' +
                    endPointBotX +
                    ' ' +
                    endPointBotY
                path +=
                    'L' +
                    endPointTopX +
                    ' ' +
                    endPointTopY +
                    'A ' +
                    (arcRadius + arcWidth / 2) +
                    ' ' +
                    (arcRadius + arcWidth / 2) +
                    ' 0 0 ' +
                    (arcAngle > 0 ? '0' : '1') +
                    ' ' +
                    beginPointTopX +
                    ' ' +
                    beginPointTopY
            }
            diffAndSetAttribute(arc, 'd', path)
        }
    }

    private setNavSource(value: string) {
        const ns = this.navSourceRef.getOrDefault()
        if (ns) {
            diffAndSetText(ns, value == 'GPS' ? this.fmsAlias : value)
            switch (value) {
                case 'GPS':
                    this.sourceIsGps = true
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'fill', 'magenta')
                    diffAndSetAttribute(
                        this.courseDeviationNeedleRef.getOrDefault()!,
                        'fill',
                        'magenta'
                    )
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'fill', 'magenta')
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'fill-opacity', '1')
                    diffAndSetAttribute(
                        this.courseDeviationNeedleRef.getOrDefault()!,
                        'fill-opacity',
                        '1'
                    )
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'fill-opacity', '1')
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'stroke', '')
                    diffAndSetAttribute(this.courseDeviationNeedleRef.getOrDefault()!, 'stroke', '')
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'stroke', '')
                    diffAndSetAttribute(ns, 'fill', 'magenta')
                    diffAndSetAttribute(
                        this.flightPhaseRef.getOrDefault()!,
                        'visibility',
                        'visible'
                    )
                    diffAndSetAttribute(
                        this.flightPhaseBgRef.getOrDefault()!,
                        'visibility',
                        'visible'
                    )
                    diffAndSetAttribute(this.toIndicatorRef.getOrDefault()!, 'fill', 'magenta')
                    diffAndSetAttribute(this.fromIndicatorRef.getOrDefault()!, 'fill', 'magenta')
                    SimVar.SetSimVarValue('L:PFD_CDI_Source', SimVarValueType.Number, 3)
                    break
                case 'VOR1':
                case 'LOC1':
                case 'TCN1':
                    this.sourceIsGps = false
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'fill', 'lime')
                    diffAndSetAttribute(
                        this.courseDeviationNeedleRef.getOrDefault()!,
                        'fill',
                        'lime'
                    )
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'fill', 'lime')
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'fill-opacity', '1')
                    diffAndSetAttribute(
                        this.courseDeviationNeedleRef.getOrDefault()!,
                        'fill-opacity',
                        '1'
                    )
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'fill-opacity', '1')
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'stroke', '')
                    diffAndSetAttribute(this.courseDeviationNeedleRef.getOrDefault()!, 'stroke', '')
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'stroke', '')
                    diffAndSetAttribute(ns, 'fill', 'lime')
                    diffAndSetAttribute(this.flightPhaseRef.getOrDefault()!, 'visibility', 'hidden')
                    diffAndSetAttribute(
                        this.flightPhaseBgRef.getOrDefault()!,
                        'visibility',
                        'hidden'
                    )
                    diffAndSetAttribute(this.xtkRef.getOrDefault()!, 'visibility', 'hidden')
                    diffAndSetAttribute(this.xtkBgRef.getOrDefault()!, 'visibility', 'hidden')
                    diffAndSetAttribute(this.toIndicatorRef.getOrDefault()!, 'fill', 'lime')
                    diffAndSetAttribute(this.fromIndicatorRef.getOrDefault()!, 'fill', 'lime')
                    SimVar.SetSimVarValue('L:PFD_CDI_Source', SimVarValueType.Number, 1)
                    break
                case 'VOR2':
                case 'LOC2':
                case 'TCN2':
                    this.sourceIsGps = false
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'fill-opacity', '0')
                    diffAndSetAttribute(
                        this.courseDeviationNeedleRef.getOrDefault()!,
                        'fill-opacity',
                        '0'
                    )
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'fill-opacity', '0')
                    diffAndSetAttribute(this.beginArrowRef.getOrDefault()!, 'stroke', 'lime')
                    diffAndSetAttribute(
                        this.courseDeviationNeedleRef.getOrDefault()!,
                        'stroke',
                        'lime'
                    )
                    diffAndSetAttribute(this.endArrowRef.getOrDefault()!, 'stroke', 'lime')
                    diffAndSetAttribute(ns, 'fill', 'lime')
                    diffAndSetAttribute(this.flightPhaseRef.getOrDefault()!, 'visibility', 'hidden')
                    diffAndSetAttribute(
                        this.flightPhaseBgRef.getOrDefault()!,
                        'visibility',
                        'hidden'
                    )
                    diffAndSetAttribute(this.xtkRef.getOrDefault()!, 'visibility', 'hidden')
                    diffAndSetAttribute(this.xtkBgRef.getOrDefault()!, 'visibility', 'hidden')
                    diffAndSetAttribute(this.toIndicatorRef.getOrDefault()!, 'fill', 'lime')
                    diffAndSetAttribute(this.fromIndicatorRef.getOrDefault()!, 'fill', 'lime')
                    SimVar.SetSimVarValue('L:PFD_CDI_Source', SimVarValueType.Number, 2)
                    break
            }
        }
    }

    private setFlightPhase(value: string) {
        const fp = this.flightPhaseRef.getOrDefault()
        if (fp) {
            diffAndSetText(fp, value)
        }
    }

    private setBearing1Bearing(value: string) {
        const b1 = this.bearing1Ref.getOrDefault()
        if (b1) {
            if (value != '') {
                diffAndSetAttribute(b1, 'transform', 'rotate(' + value + ', 50, 50)')
                diffAndSetAttribute(b1, 'visibility', 'visible')
            } else {
                diffAndSetAttribute(b1, 'visibility', 'hidden')
            }
        }
    }

    private setBearing2Bearing(value: string) {
        const b2 = this.bearing2Ref.getOrDefault()
        if (b2) {
            if (value != '') {
                diffAndSetAttribute(b2, 'transform', 'rotate(' + value + ', 50, 50)')
                diffAndSetAttribute(b2, 'visibility', 'visible')
            } else {
                diffAndSetAttribute(b2, 'visibility', 'hidden')
            }
        }
    }

    private setToFrom(value: string) {
        const ti = this.toIndicatorRef.getOrDefault()
        const fi = this.fromIndicatorRef.getOrDefault()
        if (ti && fi) {
            switch (value) {
                case '0':
                    diffAndSetAttribute(ti, 'display', 'none')
                    diffAndSetAttribute(fi, 'display', 'none')
                    break
                case '1':
                    diffAndSetAttribute(ti, 'display', 'inherit')
                    diffAndSetAttribute(fi, 'display', 'none')
                    break
                case '2':
                    diffAndSetAttribute(ti, 'display', 'none')
                    diffAndSetAttribute(fi, 'display', 'inherit')
                    break
            }
        }
    }

    private setCurrentTrack(value: string) {
        const ct = this.currentTrackIndicatorRef.getOrDefault()
        if (ct) {
            diffAndSetAttribute(ct, 'transform', 'rotate(' + value + ', 50, 50)')
        }
    }

    update(_deltaTime: number) {
        const compass = Simplane.getHeadingMagnetic()
        const roundedCompass = fastToFixed(compass, 3)
        this.setRotation(roundedCompass)
        const turnRate = SimVar.GetSimVarValue('TURN INDICATOR RATE', 'degree per second')
        const roundedTurnRate = fastToFixed(turnRate, 3)
        this.setTurnRate(roundedTurnRate)
        const heading = Simplane.getAutoPilotHeadingLockValueDegrees()
        const roundedHeading = fastToFixed(heading, 3)
        this.setHeadingBugRotation(roundedHeading)
        this.setCurrentTrack('' + Simplane.getTrackAngle())
        this.logic_cdiSource = 3
        const isGPSDriven = SimVar.GetSimVarValue('GPS DRIVES NAV1', SimVarValueType.Bool)
        const apprHold = Simplane.getAutoPilotAPPRHold()
        const approachType = Simplane.getAutoPilotApproachType()
        if (
            !this.noAffectSimRadioNav &&
            apprHold &&
            approachType != ApproachType.APPROACH_TYPE_RNAV &&
            apprHold != this._lastAPPRHold
        ) {
            if (isGPSDriven) {
                SimVar.SetSimVarValue('K:TOGGLE_GPS_DRIVES_NAV1', SimVarValueType.Bool, 0)
            }
        }
        this._lastAPPRHold = apprHold
        if (!isGPSDriven || (apprHold && approachType != ApproachType.APPROACH_TYPE_RNAV)) {
            this.logic_navSelected = Simplane.getAutoPilotSelectedNav()
            if (this.logic_navSelected !== 0) {
                this.logic_cdiSource = ((this.logic_navSelected - 1) % 2) + 1
            }
        }
        if (
            this.displayStyle === HSIndicatorDisplayType.HUD ||
            this.displayStyle === HSIndicatorDisplayType.HUD_Simplified
        ) {
            this.logic_brg1Source = SimVar.GetSimVarValue(
                'L:PFD_BRG1_Source',
                SimVarValueType.Number
            )
            if (this.logic_brg1Source == 0) {
                this.setShowBearing1(false)
            } else {
                this.setShowBearing1(true)
            }
            this.logic_brg2Source = SimVar.GetSimVarValue(
                'L:PFD_BRG2_Source',
                SimVarValueType.Number
            )
            if (this.logic_brg2Source == 0) {
                this.setShowBearing2(false)
            } else {
                this.setShowBearing2(true)
            }
        }
        switch (this.logic_cdiSource) {
            case 1:
                if (Simplane.getAutopilotTacanDriven()) {
                    this.setDisplayDeviation(
                        Simplane.getNavHasTacan(this.logic_navSelected) ? 'True' : 'False'
                    )
                    this.setNavSource('TCN' + this.logic_navSelected)
                    this.setCourse(Simplane.getTacanObs(this.logic_navSelected) + '')
                    this.setCourseDeviation(Simplane.getTacanCdi(this.logic_navSelected) / 127 + '')
                    this.setToFrom(Simplane.getTacanToFrom(this.logic_navSelected) + '')
                } else {
                    this.setDisplayDeviation(
                        Simplane.getNavHasNav(this.logic_navSelected) ? 'True' : 'False'
                    )
                    if (Simplane.getAutoPilotNavHasLoc(this.logic_navSelected)) {
                        this.setNavSource('LOC' + this.logic_navSelected)
                        this.setCourse(Simplane.getNavLocalizer(this.logic_navSelected) + '')
                    } else {
                        this.setNavSource('VOR' + this.logic_navSelected)
                        this.setCourse(Simplane.getNavObs(this.logic_navSelected) + '')
                    }
                    this.setCourseDeviation(Simplane.getNavCdi(this.logic_navSelected) / 127 + '')
                    this.setToFrom(Simplane.getNavToFrom(this.logic_navSelected) + '')
                }
                this.updateHSIDeviation()
                break
            case 2:
                if (Simplane.getAutopilotTacanDriven()) {
                    this.setDisplayDeviation(
                        Simplane.getNavHasTacan(this.logic_navSelected) ? 'True' : 'False'
                    )
                    this.setNavSource('TCN' + this.logic_navSelected)
                    this.setCourse(Simplane.getTacanObs(this.logic_navSelected) + '')
                    this.setCourseDeviation(Simplane.getTacanCdi(this.logic_navSelected) / 127 + '')
                    this.setToFrom(Simplane.getTacanToFrom(this.logic_navSelected) + '')
                } else {
                    this.setDisplayDeviation(
                        Simplane.getNavHasNav(this.logic_navSelected) ? 'True' : 'False'
                    )
                    if (Simplane.getAutoPilotNavHasLoc(this.logic_navSelected)) {
                        this.setNavSource('LOC' + this.logic_navSelected)
                        this.setCourse(Simplane.getNavLocalizer(this.logic_navSelected) + '')
                    } else {
                        this.setNavSource('VOR' + this.logic_navSelected)
                        this.setCourse(Simplane.getNavObs(this.logic_navSelected) + '')
                    }
                    this.setCourseDeviation(Simplane.getNavCdi(this.logic_navSelected) / 127 + '')
                    this.setToFrom(Simplane.getNavToFrom(this.logic_navSelected) + '')
                }
                break
            case 3:
                this.setNavSource('GPS')
                const gpsNextWpIdValid =
                    SimVar.GetSimVarValue('GPS IS ACTIVE WAY POINT', SimVarValueType.Bool) == true
                        ? 1
                        : 0
                const gpsNextWpDesiredTrk = SimVar.GetSimVarValue(
                    'GPS WP DESIRED TRACK',
                    SimVarValueType.Degree
                )
                const gpsNextWpXTrk = SimVar.GetSimVarValue('GPS WP CROSS TRK', SimVarValueType.NM)
                this.addValueInFrames(+gpsNextWpIdValid, this.gpsNextWpIdValidFrames, 20)
                this.addValueInFrames(gpsNextWpDesiredTrk, this.gpsNextWpDesiredTrkFrames, 20)
                this.addValueInFrames(gpsNextWpXTrk, this.gpsNextWpXTrkFrames, 20)
                if (
                    !(Avionics.Utils as any).isValueOutlier(
                        +gpsNextWpIdValid,
                        this.gpsNextWpIdValidFrames
                    )
                ) {
                    this.gpsNextWpIdValid = !!gpsNextWpIdValid
                }
                this.setDisplayDeviation(
                    SimVar.GetSimVarValue('HSI CDI NEEDLE VALID', SimVarValueType.Bool)
                        ? 'True'
                        : 'False'
                )
                if (
                    !(Avionics.Utils as any).isValueOutlier(
                        gpsNextWpDesiredTrk,
                        this.gpsNextWpDesiredTrkFrames
                    )
                )
                    this.setCourse(this.gpsNextWpIdValid ? gpsNextWpDesiredTrk + '' : '0')
                if (
                    !(Avionics.Utils as any).isValueOutlier(gpsNextWpXTrk, this.gpsNextWpXTrkFrames)
                )
                    this.setCourseDeviation(this.gpsNextWpIdValid ? gpsNextWpXTrk + '' : '0')
                this.setToFrom('1')
                this.curPhase = SimVar.GetSimVarValue('L:GPS_Current_Phase', SimVarValueType.Number)
                this.curDeviation = SimVar.GetSimVarValue('GPS CDI SCALING', SimVarValueType.NM)
                const DEFAULT_CROSSTRACK_ERROR = '2.0'
                const phases: any = {
                    0: 'OCN',
                    1: 'ENR',
                    2: '1 NM',
                    3: 'TERM',
                    4: '0.3 NM',
                    5: 'DPRT',
                    6: 'MAPR',
                    7: 'LNAV',
                    8: 'LNAV+V',
                    9: 'L/VNAV',
                    10: 'LP',
                    11: 'LPV',
                    12: 'RNP',
                    13: 'VISUAL',
                }
                const phaseLabel = phases[this.curPhase] || 'ENR'
                this.setFlightPhase(phaseLabel)
                if (SimVar.GetSimVarValue('GPS IS ACTIVE WAY POINT', SimVarValueType.Bool) == false)
                    this.setFlightPhase('ENR')
                this.crosstrackFullError =
                    this.curPhase in phases
                        ? this.curDeviation
                        : parseFloat(DEFAULT_CROSSTRACK_ERROR)
                this.updateHSIDeviation()
                break
        }
        this.logic_brg1Source = SimVar.GetSimVarValue('L:PFD_BRG1_Source', 'Number')
        switch (this.logic_brg1Source) {
            case 0:
                diffAndSetText(this.bearing1SourceRef.getOrDefault()!, '')
                break
            case 1:
            case 2:
                diffAndSetText(
                    this.bearing1SourceRef.getOrDefault()!,
                    'NAV' + this.logic_brg1Source
                )
                if (Simplane.getNavHasNav(this.logic_brg1Source)) {
                    diffAndSetText(
                        this.bearing1IdentRef.getOrDefault()!,
                        Simplane.getNavSignal(this.logic_brg1Source) > 0
                            ? Simplane.getNavIdent(this.logic_brg1Source)
                            : ''
                    )
                    diffAndSetText(
                        this.bearing1DistanceRef.getOrDefault()!,
                        Simplane.getNavHasDme(this.logic_brg1Source)
                            ? Simplane.getNavDme(this.logic_brg1Source) + ''
                            : ''
                    )
                    this.setBearing1Bearing(
                        ((180 + Simplane.getNavRadial(this.logic_brg1Source)) % 360) + ''
                    )
                } else {
                    diffAndSetText(this.bearing1IdentRef.getOrDefault()!, 'NO DATA')
                    diffAndSetText(this.bearing1DistanceRef.getOrDefault()!, '')
                    this.setBearing1Bearing('')
                }
                break
            case 3:
                diffAndSetText(this.bearing1SourceRef.getOrDefault()!, 'GPS')
                diffAndSetText(this.bearing1IdentRef.getOrDefault()!, Simplane.getGPSWpNextID())
                diffAndSetText(
                    this.bearing1DistanceRef.getOrDefault()!,
                    Simplane.getNextWaypointDistance() + ''
                )
                this.setBearing1Bearing(Simplane.getNextWaypointTrack() + '')
                break
            case 4:
                diffAndSetText(this.bearing1SourceRef.getOrDefault()!, 'ADF')
                diffAndSetText(this.bearing1DistanceRef.getOrDefault()!, '')
                if (Simplane.getAdfSignal(1) > 0) {
                    diffAndSetText(
                        this.bearing1IdentRef.getOrDefault()!,
                        fastToFixed(Simplane.getAdfActFreq(1), 1)
                    )
                    this.setBearing1Bearing(((Simplane.getAdfRadial(1) + compass) % 360) + '')
                } else {
                    diffAndSetText(this.bearing1IdentRef.getOrDefault()!, 'NO DATA')
                    this.setBearing1Bearing('')
                }
                break
        }
        this.logic_brg2Source = SimVar.GetSimVarValue('L:PFD_BRG2_Source', 'Number')
        switch (this.logic_brg2Source) {
            case 1:
            case 2:
                diffAndSetText(
                    this.bearing2SourceRef.getOrDefault()!,
                    'NAV' + this.logic_brg2Source
                )
                if (Simplane.getNavHasNav(this.logic_brg2Source)) {
                    diffAndSetText(
                        this.bearing2IdentRef.getOrDefault()!,
                        Simplane.getNavSignal(this.logic_brg2Source) > 0
                            ? Simplane.getNavIdent(this.logic_brg2Source)
                            : ''
                    )
                    diffAndSetText(
                        this.bearing2DistanceRef.getOrDefault()!,
                        Simplane.getNavHasDme(this.logic_brg2Source)
                            ? Simplane.getNavDme(this.logic_brg2Source) + ''
                            : ''
                    )
                    this.setBearing2Bearing(
                        ((180 + Simplane.getNavRadial(this.logic_brg2Source)) % 360) + ''
                    )
                } else {
                    diffAndSetText(this.bearing2IdentRef.getOrDefault()!, 'NO DATA')
                    diffAndSetText(this.bearing2DistanceRef.getOrDefault()!, '')
                    this.setBearing2Bearing('')
                }
                break
            case 3:
                diffAndSetText(this.bearing2SourceRef.getOrDefault()!, 'GPS')
                diffAndSetText(this.bearing2IdentRef.getOrDefault()!, Simplane.getGPSWpNextID())
                diffAndSetText(
                    this.bearing2DistanceRef.getOrDefault()!,
                    Simplane.getNextWaypointDistance() + ''
                )
                this.setBearing2Bearing(Simplane.getNextWaypointTrack() + '')
                break
            case 4:
                diffAndSetText(this.bearing2SourceRef.getOrDefault()!, 'ADF')
                diffAndSetText(this.bearing2DistanceRef.getOrDefault()!, '')
                if (Simplane.getAdfSignal(1) > 0) {
                    diffAndSetText(
                        this.bearing2IdentRef.getOrDefault()!,
                        fastToFixed(Simplane.getAdfActFreq(1), 1)
                    )
                    this.setBearing2Bearing(((Simplane.getAdfRadial(1) + compass) % 360) + '')
                } else {
                    diffAndSetText(this.bearing2IdentRef.getOrDefault()!, 'NO DATA')
                    this.setBearing2Bearing('')
                }
                break
        }
        this.logic_dmeSource = SimVar.GetSimVarValue('L:Glasscockpit_DmeSource', 'Number')
        switch (this.logic_dmeSource) {
            case 0:
                SimVar.SetSimVarValue('L:Glasscockpit_DmeSource', 'Number', 1)
            case 1:
            case 2:
                diffAndSetText(this.dmeSourceRef.getOrDefault()!, 'NAV' + this.logic_dmeSource)
                if (
                    Simplane.getNavSignal(this.logic_dmeSource) > 0 &&
                    Simplane.getNavHasDme(this.logic_dmeSource)
                ) {
                    diffAndSetText(
                        this.dmeIdentRef.getOrDefault()!,
                        fastToFixed(Simplane.getNavActFreq(this.logic_dmeSource), 2)
                    )
                    diffAndSetText(
                        this.dmeDistanceRef.getOrDefault()!,
                        Simplane.getNavDme(this.logic_dmeSource) + ''
                    )
                } else {
                    diffAndSetText(this.dmeIdentRef.getOrDefault()!, '')
                    diffAndSetText(this.dmeDistanceRef.getOrDefault()!, '')
                }
                break
        }
        const diff = this.crossTrackGoal - this.crossTrackCurrent
        let toAdd = (_deltaTime / 1000) * diff * 7.5
        if (Math.abs(toAdd) < 0.75) {
            toAdd = toAdd > 0 ? 0.75 : -0.75
        }
        if (Math.abs(diff) < 0.1 || Math.abs(toAdd) > Math.abs(diff)) {
            this.crossTrackCurrent = this.crossTrackGoal
        } else {
            this.crossTrackCurrent += toAdd
        }
    }

    updateHSIDeviation() {
        const cdi = this.courseDeviationNeedleRef.getOrDefault()
        if (!cdi) return
        const HSIneedleValue = SimVar.GetSimVarValue('HSI CDI NEEDLE', SimVarValueType.Number) || 0
        const HSIclampedPosition = (HSIneedleValue / 127) * 30
        diffAndSetAttribute(cdi, 'transform', `translate(${HSIclampedPosition}, 0)`)
        const gsiNeedleValue = SimVar.GetSimVarValue('HSI GSI NEEDLE', SimVarValueType.Number) || 0
        const clampedValue = Math.min(Math.max(gsiNeedleValue, -127), 127)
        const pos = (clampedValue / 127) * 35
        if (this.chevronBug2) {
            diffAndSetAttribute(this.chevronBug2, 'transform', `translate(0, ${pos})`)
        }
        if (this.diamondBug2) {
            diffAndSetAttribute(this.diamondBug2, 'transform', `translate(0, ${pos})`)
        }
        if (SimVar.GetSimVarValue('AUTOPILOT NAV SELECTED', SimVarValueType.Number) == 1) {
            const nav1gsiNeedleValue =
                SimVar.GetSimVarValue('NAV GSI:1', SimVarValueType.Number) || 0
            const nav1clampedValue = Math.min(Math.max(nav1gsiNeedleValue, -127), 127)
            const nav1pos = (nav1clampedValue / 127) * 35
            if (this.hollowDiamondBug2) {
                diffAndSetAttribute(this.hollowDiamondBug2, 'transform', `translate(0, ${nav1pos})`)
            }
        } else if (SimVar.GetSimVarValue('AUTOPILOT NAV SELECTED', SimVarValueType.Number) == 2) {
            const nav2gsiNeedleValue =
                SimVar.GetSimVarValue('NAV GSI:2', SimVarValueType.Number) || 0
            const nav2clampedValue = Math.min(Math.max(nav2gsiNeedleValue, -127), 127)
            const nav2pos = (nav2clampedValue / 127) * 35
            if (this.hollowDiamondBug2) {
                diffAndSetAttribute(this.hollowDiamondBug2, 'transform', `translate(0, ${nav2pos})`)
            }
        }
    }

    render(): VNode {
        const arcRadius = 53
        const arcWidth = 5
        const viewBox = this.largeCompass ? '-28 -28 156 156' : '-28 -15 156 116'

        return (
            <svg ref={this.rootRef} class="hsi" width="100%" height="100%" viewBox={viewBox}>
                {/* Compass lines */}
                {!this.largeCompass &&
                    [-135, -90, -45, 45, 90, 135].map(angle => (
                        <rect
                            key={`compass-line-${angle}`}
                            x="49.5"
                            y="-7"
                            width="1"
                            height="6"
                            transform={`rotate(${angle} 50 50)`}
                            fill="white"
                        />
                    ))}

                {/* Turn rate indicator */}
                {!this.noTurnRateIndicator && (
                    <>
                        <path
                            class="hsi-indicator-turnrate-background"
                            d={(() => {
                                const arcSize = 45
                                const beginPointHalfUnitSize = arcSize / 2 / arcRadius
                                const beginPointTopX =
                                    50 -
                                    Math.sin(beginPointHalfUnitSize) * (arcRadius + arcWidth / 2)
                                const beginPointBotX =
                                    50 -
                                    Math.sin(beginPointHalfUnitSize) * (arcRadius - arcWidth / 2)
                                const endPointTopX =
                                    50 +
                                    Math.sin(beginPointHalfUnitSize) * (arcRadius + arcWidth / 2)
                                const endPointBotX =
                                    50 +
                                    Math.sin(beginPointHalfUnitSize) * (arcRadius - arcWidth / 2)
                                const pointTopY =
                                    50 -
                                    Math.cos(beginPointHalfUnitSize) * (arcRadius + arcWidth / 2)
                                const pointBotY =
                                    50 -
                                    Math.cos(beginPointHalfUnitSize) * (arcRadius - arcWidth / 2)
                                let p =
                                    'M' +
                                    beginPointBotX +
                                    ' ' +
                                    pointBotY +
                                    'A ' +
                                    (arcRadius - arcWidth / 2) +
                                    ' ' +
                                    (arcRadius - arcWidth / 2) +
                                    ' 0 0 1 ' +
                                    endPointBotX +
                                    ' ' +
                                    pointBotY
                                p +=
                                    'L' +
                                    endPointTopX +
                                    ' ' +
                                    pointTopY +
                                    'A ' +
                                    (arcRadius + arcWidth / 2) +
                                    ' ' +
                                    (arcRadius + arcWidth / 2) +
                                    ' 0 0 0 ' +
                                    beginPointTopX +
                                    ' ' +
                                    pointTopY
                                return p
                            })()}
                            fill="#1a1d21"
                            fill-opacity="0.25"
                        />
                        {[-18, -9, 9, 18].map(angle => (
                            <rect
                                key={`turnrate-line-${angle}`}
                                x="49.5"
                                y={-arcWidth}
                                width="1"
                                height={String(arcWidth)}
                                transform={`rotate(${angle} 50 50)`}
                                fill="white"
                            />
                        ))}
                        <path ref={this.turnRateArcRef} fill="magenta" />
                    </>
                )}

                {/* Rotating rose group */}
                <g ref={this.rotatingRoseRef}>
                    {!this.noBackground && (
                        <circle
                            cx="50"
                            cy="50"
                            r={this.largeCompass ? '65' : '50'}
                            fill="#1a1d21"
                            fill-opacity="0.25"
                        />
                    )}

                    {/* Tick marks - 72 ticks at 5-degree intervals */}
                    {[...Array(72)].map((_, i) => {
                        let length = i % 2 == 0 ? 4 : 2
                        if (this.largeCompass && i % 6 === 0) {
                            length = 6
                        }
                        const angle = (i * (2 * Math.PI)) / 72
                        const rotation = (-angle / Math.PI) * 180 + 180
                        return (
                            <rect
                                key={`tick-${i}`}
                                x="49.5"
                                y={this.largeCompass ? 115 - length : 100 - length}
                                width="1"
                                height={String(length)}
                                transform={`rotate(${rotation} 50 50)`}
                                fill="white"
                            />
                        )
                    })}

                    {/* Compass labels */}
                    {['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'].map(
                        (text, i) => {
                            const angle = i * (360 / 12)
                            return (
                                <text
                                    key={`label-${i}`}
                                    x="50"
                                    y={this.largeCompass ? '-5' : i % 3 == 0 ? '12' : '9'}
                                    fill="white"
                                    font-size={this.largeCompass ? '7' : i % 3 == 0 ? '15' : '8'}
                                    font-family={this.font}
                                    text-anchor="middle"
                                    alignment-baseline="central"
                                    transform={`rotate(${angle} 50 50)`}
                                >
                                    {text}
                                </text>
                            )
                        }
                    )}

                    {/* Heading bug */}
                    <polygon
                        ref={this.headingBugRef}
                        points={
                            this.largeCompass
                                ? '42,-19 47,-19 50,-16 53,-19 58,-19 58,-15 42,-15'
                                : '46,0 47,0 50,4 53,0 54,0 54,5 46,5'
                        }
                        fill="aqua"
                    />

                    {/* Inner circle for bearing display */}
                    <circle
                        ref={this.innerCircleRef}
                        cx="50"
                        cy="50"
                        r="30"
                        stroke="white"
                        stroke-width="0.8"
                        fill-opacity="0"
                        display="none"
                    />

                    {this.displayStyle != HSIndicatorDisplayType.HUD_Simplified && (
                        <>
                            {/* Current track indicator */}
                            <polygon
                                ref={this.currentTrackIndicatorRef}
                                points="50,-4 52,0 50,4 48,0"
                                fill="magenta"
                            />

                            {/* Bearing 1 */}
                            <g ref={this.bearing1Ref} display="none">
                                <path
                                    d="M50 96 L50 80 M50 4 L50 20 M50 8 L57 15 M50 8 L43 15"
                                    stroke="aqua"
                                    stroke-width="1"
                                    fill-opacity="0"
                                />
                            </g>

                            {/* Bearing 2 */}
                            <g ref={this.bearing2Ref} display="none">
                                <path
                                    d="M50 96 L50 92 M47 80 L47 90 Q50 96 53 90 L53 80 M50 4 L50 8 L57 15 M50 8 L43 15 M47 11 L47 20 M53 11 L53 20"
                                    stroke="aqua"
                                    stroke-width="1"
                                    fill-opacity="0"
                                />
                            </g>

                            {/* Course group */}
                            <g ref={this.courseGroupRef}>
                                {/* Begin arrow + from indicator */}
                                <polygon
                                    ref={this.beginArrowRef}
                                    points="51,96 49,96 49,75 51,75"
                                    fill="magenta"
                                />
                                <polygon
                                    ref={this.fromIndicatorRef}
                                    points="46,75 54,75 50,80"
                                    fill="magenta"
                                    stroke="black"
                                    stroke-width="0.2"
                                    display="none"
                                />

                                {/* CDI needle */}
                                <polygon
                                    ref={this.courseDeviationNeedleRef}
                                    points="49,74.5 51,74.5 51,25.5 49,25.5"
                                    fill="magenta"
                                />

                                {/* End arrow + to indicator */}
                                <polygon
                                    ref={this.endArrowRef}
                                    points="51,25 49,25 49,15 45,15 50,4 55,15 51,15"
                                    fill="magenta"
                                />
                                <polygon
                                    ref={this.toIndicatorRef}
                                    points="46,25 54,25 50,20"
                                    fill="magenta"
                                    stroke="black"
                                    stroke-width="0.2"
                                    display="none"
                                />

                                {/* CDI scale circles */}
                                {(this.largeCompass ? [-30, -15, 15, 30] : [-20, -10, 10, 20]).map(
                                    pos => (
                                        <circle
                                            key={`cdi-dot-${pos}`}
                                            cx={String(50 + pos)}
                                            cy="50"
                                            r={this.largeCompass ? '1.5' : '2'}
                                            stroke="white"
                                            stroke-width={this.largeCompass ? '0.8' : '1'}
                                            fill-opacity="0"
                                        />
                                    )
                                )}
                            </g>
                        </>
                    )}
                </g>

                {/* Top triangle */}
                <polygon
                    points={this.largeCompass ? '48,-20 52,-20 50,-15' : '46,-3 54,-3 50,3'}
                    fill="white"
                    {...(this.largeCompass ? {} : { stroke: 'black' })}
                />

                {/* Plane symbol */}
                <path
                    d="M44 50 L49 50 L49 53 L48 54 L48 55 L52 55 L52 54 L51 53 L51 50 L56 50 L56 49 L51 48 L51 46 Q50 44 49 46 L49 48 L44 49 Z"
                    fill="white"
                />

                {/* Bearing text */}
                {!this.largeCompass && (
                    <>
                        <rect x="35" y="-15" height="12" width="30" fill="#1a1d21" />
                        <text
                            ref={this.bearingTextRef}
                            fill="white"
                            text-anchor="middle"
                            x="50"
                            y="-5"
                            font-size="11"
                            font-family={this.font}
                        />
                    </>
                )}

                {this.displayStyle != HSIndicatorDisplayType.HUD_Simplified && (
                    <>
                        {/* Heading value */}
                        {!this.noHeadingValue && (
                            <>
                                <rect
                                    x="-13"
                                    y="-7"
                                    height="8"
                                    width="36"
                                    fill="#1a1d21"
                                    fill-opacity="1"
                                />
                                <text
                                    fill="white"
                                    x="-11"
                                    y="-0.6"
                                    font-size="7"
                                    font-family={this.font}
                                >
                                    HDG
                                </text>
                                <text
                                    ref={this.headingValueRef}
                                    fill="aqua"
                                    x="5"
                                    y="-0.6"
                                    font-size="7"
                                    font-family={this.font}
                                />
                            </>
                        )}

                        {/* Course value */}
                        {!this.noCourseValue && (
                            <>
                                <rect x="77" y="-7" height="8" width="36" fill="#1a1d21" />
                                <text
                                    fill="white"
                                    x="79"
                                    y="-0.6"
                                    font-size="7"
                                    font-family={this.font}
                                >
                                    CRS
                                </text>
                                <text
                                    ref={this.courseValueRef}
                                    fill="magenta"
                                    x="95"
                                    y="-0.6"
                                    font-size="7"
                                    font-family={this.font}
                                />
                            </>
                        )}

                        {/* Center text: nav source, flight phase, XTK */}
                        {!this.noCenterText && (
                            <>
                                <rect
                                    ref={this.navSourceBgRef}
                                    fill="#1a1d21"
                                    fill-opacity="1"
                                    x="27"
                                    y="34.5"
                                    height="7"
                                    width="16"
                                />
                                <text
                                    ref={this.navSourceRef}
                                    fill="magenta"
                                    x="35"
                                    y="40"
                                    font-size="6"
                                    font-family={this.font}
                                    text-anchor="middle"
                                >
                                    GPS
                                </text>
                                <rect
                                    ref={this.flightPhaseBgRef}
                                    fill="#1a1d21"
                                    fill-opacity="1"
                                    x="56"
                                    y="34.5"
                                    height="7"
                                    width="18"
                                />
                                <text
                                    ref={this.flightPhaseRef}
                                    fill="magenta"
                                    x="65"
                                    y="40"
                                    font-size="6"
                                    font-family={this.font}
                                    text-anchor="middle"
                                >
                                    TERM
                                </text>
                                <rect
                                    ref={this.xtkBgRef}
                                    fill="#1a1d21"
                                    fill-opacity="1"
                                    x="29"
                                    y="60.5"
                                    height="7"
                                    width="40"
                                />
                                <text
                                    ref={this.xtkRef}
                                    fill="magenta"
                                    x="50"
                                    y="66"
                                    font-size="6"
                                    font-family={this.font}
                                    text-anchor="middle"
                                >
                                    XTK 3.15NM
                                </text>
                            </>
                        )}

                        {/* DME group */}
                        <g ref={this.dmeGroupRef} display="none">
                            <path
                                d={this.getExternalTextZonePath(57, 0, -0.58, -28)}
                                fill="#1a1d21"
                            />
                            <text
                                fill="white"
                                x="-27"
                                y="57"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="start"
                            >
                                DME
                            </text>
                            <text
                                ref={this.dmeSourceRef}
                                fill="aqua"
                                x="-27"
                                y="64"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="start"
                            >
                                NAV1
                            </text>
                            <text
                                ref={this.dmeIdentRef}
                                fill="aqua"
                                x="-27"
                                y="71"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="start"
                            >
                                117.80
                            </text>
                            <text
                                ref={this.dmeDistanceRef}
                                fill="white"
                                x="-27"
                                y="78"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="start"
                            >
                                97.7NM
                            </text>
                        </g>

                        {/* Bearing 1 fixed group */}
                        <g ref={this.bearing1FixedGroupRef} display="none">
                            <path
                                d={this.getExternalTextZonePath(57, -0.6, -1.1, -28)}
                                fill="#1a1d21"
                            />
                            <text
                                ref={this.bearing1DistanceRef}
                                fill="white"
                                x="-27"
                                y="88"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="start"
                            >
                                16.2 NM
                            </text>
                            <text
                                ref={this.bearing1IdentRef}
                                fill="aqua"
                                x="-27"
                                y="94"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="start"
                            >
                                ATL
                            </text>
                            <text
                                ref={this.bearing1SourceRef}
                                fill="white"
                                x="-27"
                                y="100"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="left"
                            >
                                NAV1
                            </text>
                            {/* Bearing 1 pointer */}
                            <rect x="-5" y="96.875" width="15" height="0.25" fill="aqua" />
                            <rect
                                x="-3"
                                y="96.875"
                                width="4"
                                height="0.25"
                                transform="rotate(-45 -3 97)"
                                fill="aqua"
                            />
                            <rect
                                x="-3"
                                y="96.875"
                                width="4"
                                height="0.25"
                                transform="rotate(45 -3 97)"
                                fill="aqua"
                            />
                        </g>

                        {/* Bearing 2 fixed group */}
                        <g ref={this.bearing2FixedGroupRef} display="none">
                            <path
                                d={this.getExternalTextZonePath(
                                    57,
                                    Math.PI + 0.6,
                                    Math.PI + 1.1,
                                    128,
                                    true
                                )}
                                fill="#1a1d21"
                            />
                            <text
                                ref={this.bearing2DistanceRef}
                                fill="white"
                                x="127"
                                y="88"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="end"
                            >
                                16.2 NM
                            </text>
                            <text
                                ref={this.bearing2IdentRef}
                                fill="aqua"
                                x="127"
                                y="94"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="end"
                            >
                                ATL
                            </text>
                            <text
                                ref={this.bearing2SourceRef}
                                fill="white"
                                x="127"
                                y="100"
                                font-size="6"
                                font-family={this.font}
                                text-anchor="end"
                            >
                                NAV1
                            </text>
                            <path
                                d="M90 97 L92 97 M105 97 L103 97 L100 100 M103 97 L100 94 M101.5 98.5 L93 98.5 Q90 97 93 95.5 L101.5 95.5"
                                stroke="aqua"
                                stroke-width="0.5"
                                fill-opacity="0"
                            />
                        </g>
                    </>
                )}
            </svg>
        )
    }
}
