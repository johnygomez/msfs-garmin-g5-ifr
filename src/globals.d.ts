/// <reference types="@microsoft/msfs-types/pages/vcockpit/instruments/shared/baseinstrument" />
/// <reference types="@microsoft/msfs-types/pages/vcockpit/instruments/shared/utils/xmllogic" />
/// <reference types="@microsoft/msfs-types/pages/vcockpit/instruments/shared/flightelements/flightplanmanager" />
/// <reference types="@microsoft/msfs-types/js/simvar" />
/// <reference types="@microsoft/msfs-types/js/simplane" />
/// <reference types="@microsoft/msfs-types/js/avionics" />
/// <reference types="@microsoft/msfs-types/pages/vcockpit/core/vcockpit" />

declare function diffAndSetAttribute(_element: any, _attribute: string, _newValue: any): void
declare function diffAndSetText(_element: any, _value: any): void
declare function diffAndSetHTML(_element: any, _value: any): void
declare function diffAndSetStyle(_element: any, _property: number, _newValue: any): void

declare namespace StyleProperty {
    const display: number
}

declare function fastToFixed(_val: any, _fraction: any): string
declare function registerInstrument(_name: string, _class: any): void

declare var EmptyCallback: { Void: () => void }
declare var ApproachType: any
declare var EWeatherRadar: any
declare var EngineType: any
declare var LatLong: any
declare var Name_Z: any
declare var globalPanelData: any
declare var engine: any
declare class Vec2 {}

declare type Name_Z = any

declare namespace Simplane {
    function getNavObs(_index: number): number
    function getNavCdi(_index: number): number
    function getNavToFrom(_index: number): number
    function getNavSignal(_index: number): number
    function getNavHasDme(_index: number): boolean
    function getNavDme(_index: number): number
    function getNavRadial(_index: number): number
    function getNavLocalizer(_index: number): number
    function getNavIdent(_index: number): string
    function getNavHasTacan(_index: number): boolean
    function getAutopilotTacanDriven(): boolean
    function getAdfSignal(_index: number): number
    function getAdfRadial(_index: number): number
    function getAdfActFreq(_index: number): number
    function getTacanToFrom(_index: number): number
    function getTacanObs(_index: number): number
    function getTacanCdi(_index: number): number
    function getCrossoverAltitude(_speed: number, _mach: number): number
    function getCrossoverSpeedFactor(_speed: number, _mach: number): number
    function getMachSpeed(): number
    function getDesignSpeeds(): any
}

declare namespace Utils {
    function isValueOutlier(_value: any, _array: any[]): boolean
    function RemoveAllChildren(_element: Element): void
    function Clamp(_value: number, _min: number, _max: number): number
    function SecondsToDisplayTime(..._args: any[]): string
    var EmptyCallback: { Void: () => void }
}

declare class TemplateElement extends HTMLElement {
    getElementsByClassName(className: string): HTMLElement[]
    static callNoBinding(_el: any, _func: any, ..._args: any[]): void
}

declare class NearestAirportList {
    constructor(_gps: any)
}
declare class NearestVORList {
    constructor(_gps: any)
}
declare class NearestNDBList {
    constructor(_gps: any)
}
declare class NearestIntersectionList {
    constructor(_gps: any)
}
declare class WayPoint {
    constructor(_data: any)
}
declare class SearchFieldWaypointICAO {
    constructor(_gps: any, _elements: any[], _parent: any, _type: string)
    StartSearch(_callback: any): void
}
declare class SearchFieldWaypointName {
    constructor(..._args: any[])
}
declare class SearchFieldAdfFrequency {
    constructor(_elements: any[], _parent: any)
    Update(): void
    StartSearch(_callback: any): void
}
declare class SearchFieldAltitude {
    constructor(_elements: any[], _parent: any)
    Update(): void
    elements: any[]
    StartSearch(_callback: any): void
}
declare class SelectableElement {
    constructor(..._args: any[])
}
declare class SelectableElementGroup {
    constructor(..._args: any[])
}
declare class SelectableElementSliderGroup {
    constructor(..._args: any[])
}
