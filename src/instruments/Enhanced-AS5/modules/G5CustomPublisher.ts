import {
    EventBus,
    SimVarPublisher,
    SimVarPublisherEntry,
    SimVarValueType,
} from '@microsoft/msfs-sdk'

/**
 * SimVar events not covered by the SDK's built-in publishers.
 * Topics are added incrementally as components migrate to the EventBus.
 */
export interface G5CustomEvents {
    /** Whether GPS drives NAV1. */
    gps_drives_nav1: boolean
    /** Ground track angle, degrees magnetic. */
    track_angle_magnetic: number
    /** Selected course/OBS for NAV1, in degrees. */
    nav1_obs: number
    /** Autopilot selected altitude, in feet. */
    ap_altitude_selected: number
    /** Autopilot selected vertical speed, in feet per minute. */
    ap_vs_selected: number
    /** Ground speed, in knots. */
    ground_speed: number
    /** Whether the flight director is active. */
    flight_director_is_active: boolean
    /** Flight director pitch command, in degrees. */
    flight_director_pitch: number
    /** Flight director bank command, in degrees. */
    flight_director_bank: number
    /** Autopilot max bank angle, in degrees. */
    ap_max_bank_value: number
    /** Autopilot selected heading, in degrees. */
    ap_heading_selected: number
    /** Number of engines installed on the aircraft (static per airframe). */
    number_of_engines: number
    /** Autopilot selected navigation source (1=NAV1, 2=NAV2, 0=GPS). */
    nav_selected: number
    /** Whether autopilot flight-level-change mode is active. */
    ap_flc_active: boolean
    /** Whether autopilot Mach hold is active. */
    ap_mach_hold: boolean
    /** Whether the autopilot managed speed reference is in Mach. */
    ap_managed_speed_in_mach: boolean
    /** Autopilot selected Mach reference. */
    ap_mach_selected: number
    /** Autopilot selected airspeed reference, in knots. */
    ap_ias_selected: number
}

/**
 * SimVar definitions for the G5 custom publisher.
 */
const G5_CUSTOM_SIMVARS = new Map<keyof G5CustomEvents, SimVarPublisherEntry<any>>([
    ['gps_drives_nav1', { name: 'GPS DRIVES NAV1', type: SimVarValueType.Bool }],
    ['track_angle_magnetic', { name: 'GPS GROUND MAGNETIC TRACK', type: SimVarValueType.Degree }],
    ['nav1_obs', { name: 'NAV OBS:1', type: SimVarValueType.Degree }],
    ['ap_altitude_selected', { name: 'AUTOPILOT ALTITUDE LOCK VAR', type: SimVarValueType.Feet }],
    ['ap_vs_selected', { name: 'AUTOPILOT VERTICAL HOLD VAR', type: SimVarValueType.FPM }],
    ['ground_speed', { name: 'GROUND VELOCITY', type: SimVarValueType.Knots }],
    [
        'flight_director_is_active',
        { name: 'AUTOPILOT FLIGHT DIRECTOR ACTIVE', type: SimVarValueType.Bool },
    ],
    [
        'flight_director_pitch',
        { name: 'AUTOPILOT FLIGHT DIRECTOR PITCH', type: SimVarValueType.Degree },
    ],
    [
        'flight_director_bank',
        { name: 'AUTOPILOT FLIGHT DIRECTOR BANK', type: SimVarValueType.Degree },
    ],
    ['ap_max_bank_value', { name: 'AUTOPILOT MAX BANK', type: SimVarValueType.Degree }],
    ['ap_heading_selected', { name: 'AUTOPILOT HEADING LOCK DIR:1', type: SimVarValueType.Degree }],
    ['number_of_engines', { name: 'NUMBER OF ENGINES', type: SimVarValueType.Number }],
    ['nav_selected', { name: 'AUTOPILOT NAV SELECTED', type: SimVarValueType.Number }],
    ['ap_flc_active', { name: 'AUTOPILOT FLIGHT LEVEL CHANGE', type: SimVarValueType.Bool }],
    ['ap_mach_hold', { name: 'AUTOPILOT MACH HOLD', type: SimVarValueType.Bool }],
    [
        'ap_managed_speed_in_mach',
        { name: 'AUTOPILOT MANAGED SPEED IN MACH', type: SimVarValueType.Bool },
    ],
    ['ap_mach_selected', { name: 'AUTOPILOT MACH HOLD VAR', type: SimVarValueType.Mach }],
    ['ap_ias_selected', { name: 'AUTOPILOT AIRSPEED HOLD VAR', type: SimVarValueType.Knots }],
])

/**
 * A publisher for G5-specific SimVars not covered by the built-in SDK publishers.
 */
export class G5CustomPublisher extends SimVarPublisher<G5CustomEvents> {
    constructor(bus: EventBus) {
        super(G5_CUSTOM_SIMVARS, bus)
    }
}
