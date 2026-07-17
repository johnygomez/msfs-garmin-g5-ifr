import {
    EventBus,
    SimVarPublisher,
    SimVarPublisherEntry,
    SimVarValueType,
} from '@microsoft/msfs-sdk'

/**
 * Navigation-related events published to the EventBus by {@link G5NavPublisher}.
 */
export interface G5NavEvents {
    // ---- GPS ----
    gps_active_waypoint: boolean
    gps_wp_desired_track: number
    gps_wp_cross_track: number
    gps_cdi_scaling: number
    gps_wp_next_id: string
    gps_wp_distance: number
    gps_wp_bearing: number
    gps_obs_active: boolean
    gps_approach_active: boolean
    gps_has_glidepath: boolean
    gps_vertical_error: number
    gps_gsi_scaling: number

    // ---- HSI ----
    hsi_cdi_needle: number
    hsi_cdi_needle_valid: boolean
    hsi_gsi_needle: number
    nav1_gsi: number
    nav2_gsi: number

    // ---- NAV 1 ----
    nav1_has_nav: boolean
    nav1_cdi: number
    nav1_signal: number
    nav1_ident: string
    nav1_has_dme: boolean
    nav1_dme: number
    nav1_radial: number
    nav1_has_loc: boolean
    nav1_localizer: number
    nav1_obs: number
    nav1_to_from: number
    nav1_act_freq: number
    nav1_has_glideslope: boolean

    // ---- NAV 2 ----
    nav2_has_nav: boolean
    nav2_cdi: number
    nav2_signal: number
    nav2_ident: string
    nav2_has_dme: boolean
    nav2_dme: number
    nav2_radial: number
    nav2_has_loc: boolean
    nav2_localizer: number
    nav2_obs: number
    nav2_to_from: number
    nav2_act_freq: number
    nav2_available: boolean
    nav2_has_glideslope: boolean

    // ---- ADF 1 ----
    adf1_signal: number
    adf1_act_freq: number
    adf1_radial: number

    // ---- TACAN ----
    tacan_drives_nav1: boolean
    nav1_has_tacan: boolean
    nav1_tacan_obs: number
    nav1_tacan_cdi: number
    nav1_tacan_to_from: number
    nav2_has_tacan: boolean
    nav2_tacan_obs: number
    nav2_tacan_cdi: number
    nav2_tacan_to_from: number

    // ---- Autopilot ----
    ap_appr_hold: boolean
    ap_approach_type: number

    // ---- Bearing sources (L: vars) ----
    brg1_source: number
    brg2_source: number

    // ---- DME (L: vars) ----
    dme_source: number
    dme_displayed: boolean
}

const NAV_SIMVARS = new Map<keyof G5NavEvents, SimVarPublisherEntry<any>>([
    // GPS
    ['gps_active_waypoint', { name: 'GPS IS ACTIVE WAY POINT', type: SimVarValueType.Bool }],
    ['gps_wp_desired_track', { name: 'GPS WP DESIRED TRACK', type: SimVarValueType.Degree }],
    ['gps_wp_cross_track', { name: 'GPS WP CROSS TRK', type: SimVarValueType.NM }],
    ['gps_cdi_scaling', { name: 'GPS CDI SCALING', type: SimVarValueType.NM }],
    ['gps_approach_active', { name: 'GPS IS APPROACH ACTIVE', type: SimVarValueType.Bool }],
    ['gps_has_glidepath', { name: 'GPS HAS GLIDEPATH', type: SimVarValueType.Bool }],
    ['gps_vertical_error', { name: 'GPS VERTICAL ERROR', type: SimVarValueType.Meters }],
    ['gps_gsi_scaling', { name: 'GPS GSI SCALING', type: SimVarValueType.Meters }],
    ['gps_wp_next_id', { name: 'GPS WP NEXT ID', type: SimVarValueType.String }],
    ['gps_wp_distance', { name: 'GPS WP DISTANCE', type: SimVarValueType.NM }],
    ['gps_wp_bearing', { name: 'GPS WP BEARING', type: SimVarValueType.Degree }],
    ['gps_obs_active', { name: 'GPS OBS ACTIVE', type: SimVarValueType.Bool }],

    // HSI
    ['hsi_cdi_needle', { name: 'HSI CDI NEEDLE', type: SimVarValueType.Number }],
    ['hsi_cdi_needle_valid', { name: 'HSI CDI NEEDLE VALID', type: SimVarValueType.Bool }],
    ['hsi_gsi_needle', { name: 'HSI GSI NEEDLE', type: SimVarValueType.Number }],
    ['nav1_gsi', { name: 'NAV GSI:1', type: SimVarValueType.Number }],
    ['nav2_gsi', { name: 'NAV GSI:2', type: SimVarValueType.Number }],

    // NAV 1
    ['nav1_has_nav', { name: 'NAV HAS NAV:1', type: SimVarValueType.Bool }],
    ['nav1_cdi', { name: 'NAV CDI:1', type: SimVarValueType.Number }],
    ['nav1_signal', { name: 'NAV SIGNAL:1', type: SimVarValueType.Number }],
    ['nav1_ident', { name: 'NAV IDENT:1', type: SimVarValueType.String }],
    ['nav1_has_dme', { name: 'NAV HAS DME:1', type: SimVarValueType.Bool }],
    ['nav1_dme', { name: 'NAV DME:1', type: SimVarValueType.NM }],
    ['nav1_radial', { name: 'NAV RADIAL:1', type: SimVarValueType.Degree }],
    ['nav1_has_loc', { name: 'NAV HAS LOCALIZER:1', type: SimVarValueType.Bool }],
    ['nav1_localizer', { name: 'NAV LOCALIZER:1', type: SimVarValueType.Degree }],
    ['nav1_obs', { name: 'NAV OBS:1', type: SimVarValueType.Degree }],
    ['nav1_to_from', { name: 'NAV TOFROM:1', type: SimVarValueType.Number }],
    ['nav1_act_freq', { name: 'NAV ACTIVE FREQUENCY:1', type: SimVarValueType.MHz }],
    ['nav1_has_glideslope', { name: 'NAV HAS GLIDE SLOPE:1', type: SimVarValueType.Bool }],

    // NAV 2
    ['nav2_has_nav', { name: 'NAV HAS NAV:2', type: SimVarValueType.Bool }],
    ['nav2_cdi', { name: 'NAV CDI:2', type: SimVarValueType.Number }],
    ['nav2_signal', { name: 'NAV SIGNAL:2', type: SimVarValueType.Number }],
    ['nav2_ident', { name: 'NAV IDENT:2', type: SimVarValueType.String }],
    ['nav2_has_dme', { name: 'NAV HAS DME:2', type: SimVarValueType.Bool }],
    ['nav2_dme', { name: 'NAV DME:2', type: SimVarValueType.NM }],
    ['nav2_radial', { name: 'NAV RADIAL:2', type: SimVarValueType.Degree }],
    ['nav2_has_loc', { name: 'NAV HAS LOCALIZER:2', type: SimVarValueType.Bool }],
    ['nav2_localizer', { name: 'NAV LOCALIZER:2', type: SimVarValueType.Degree }],
    ['nav2_obs', { name: 'NAV OBS:2', type: SimVarValueType.Degree }],
    ['nav2_to_from', { name: 'NAV TOFROM:2', type: SimVarValueType.Number }],
    ['nav2_act_freq', { name: 'NAV ACTIVE FREQUENCY:2', type: SimVarValueType.MHz }],
    ['nav2_available', { name: 'NAV AVAILABLE:2', type: SimVarValueType.Bool }],
    ['nav2_has_glideslope', { name: 'NAV HAS GLIDE SLOPE:2', type: SimVarValueType.Bool }],

    // ADF 1
    ['adf1_signal', { name: 'ADF SIGNAL:1', type: SimVarValueType.Number }],
    ['adf1_act_freq', { name: 'ADF ACTIVE FREQUENCY:1', type: SimVarValueType.KHz }],
    ['adf1_radial', { name: 'ADF RADIAL:1', type: SimVarValueType.Degree }],

    // TACAN
    ['tacan_drives_nav1', { name: 'TACAN DRIVES NAV1:1', type: SimVarValueType.Bool }],
    ['nav1_has_tacan', { name: 'NAV HAS TACAN:1', type: SimVarValueType.Bool }],
    ['nav1_tacan_obs', { name: 'TACAN OBS:1', type: SimVarValueType.Degree }],
    ['nav1_tacan_cdi', { name: 'TACAN STATION CDI:1', type: SimVarValueType.Number }],
    ['nav1_tacan_to_from', { name: 'TACAN STATION TOFROM:1', type: SimVarValueType.Number }],
    ['nav2_has_tacan', { name: 'NAV HAS TACAN:2', type: SimVarValueType.Bool }],
    ['nav2_tacan_obs', { name: 'TACAN OBS:2', type: SimVarValueType.Degree }],
    ['nav2_tacan_cdi', { name: 'TACAN STATION CDI:2', type: SimVarValueType.Number }],
    ['nav2_tacan_to_from', { name: 'TACAN STATION TOFROM:2', type: SimVarValueType.Number }],

    // Autopilot
    ['ap_appr_hold', { name: 'AUTOPILOT APPROACH HOLD', type: SimVarValueType.Bool }],
    ['ap_approach_type', { name: 'AUTOPILOT APPROACH TYPE', type: SimVarValueType.Number }],

    // Bearing sources
    ['brg1_source', { name: 'L:PFD_BRG1_Source', type: SimVarValueType.Number }],
    ['brg2_source', { name: 'L:PFD_BRG2_Source', type: SimVarValueType.Number }],

    // DME
    ['dme_source', { name: 'L:Glasscockpit_DmeSource', type: SimVarValueType.Number }],
    ['dme_displayed', { name: 'L:PFD_DME_Displayed', type: SimVarValueType.Bool }],
])

/**
 * Publishes GPS, HSI, NAV1/NAV2, ADF1, bearing-source, and DME SimVars
 * to the EventBus so that display components can subscribe reactively
 * instead of calling SimVar/Simplane each frame.
 */
export class G5NavPublisher extends SimVarPublisher<G5NavEvents> {
    constructor(bus: EventBus) {
        super(NAV_SIMVARS, bus)
    }
}
