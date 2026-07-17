import {
    CDIScaleLabel,
    Fms,
    GarminFlightPlanRouteSyncManager,
    GarminPrimaryFlightPlanRouteLoader,
    GarminPrimaryFlightPlanRouteProvider,
    LNavDataEvents,
    NavdataComputer,
} from '@microsoft/msfs-garminsdk'
import {
    ConsumerSubject,
    ConsumerValue,
    EventBus,
    FacilityLoader,
    FacilityRepository,
    FlightPathAirplaneSpeedMode,
    FlightPathAirplaneWindMode,
    FlightPathCalculator,
    FlightPlanner,
    FlightPlanRouteManager,
    LNavComputer,
    Publisher,
    ReadonlyFlightPlanRoute,
    Subscription,
} from '@microsoft/msfs-sdk'

import { G5NavEvents } from '../publishers/G5NavPublisher'
import {
    deriveCdiScaleLabelFromSimVars,
    G5NavdataEvents,
    readVendorCdiScaleLabel,
} from './GpsPhaseSource'

const FLIGHT_PATH_CALCULATOR_OPTIONS = {
    id: '',
    initSyncRole: 'primary',
    defaultClimbRate: 300,
    defaultSpeed: 50,
    bankAngle: 25,
    holdBankAngle: null,
    courseReversalBankAngle: null,
    turnAnticipationBankAngle: null,
    maxBankAngle: 25,
    airplaneSpeedMode: FlightPathAirplaneSpeedMode.TrueAirspeedPlusWind,
    airplaneWindMode: FlightPathAirplaneWindMode.Automatic,
} as const

/**
 * Resolves the GPS CDI-scaling phase label and publishes it as {@link G5NavdataEvents}. Since there
 * is no vendor-neutral way to read a GTN's internal plan, the label is taken from the best source
 * available, in order: a recognised GTN mod's LVars, then our own Garmin FMS + NavdataComputer
 * (when a plan has synced in), then the sim's generic GPS SimVars as a universal floor.
 */
export class NavdataStack {
    private readonly facLoader: FacilityLoader
    private readonly calculator: FlightPathCalculator
    private readonly planner: FlightPlanner
    private readonly fms: Fms
    private readonly lnav: LNavComputer
    private readonly navdata: NavdataComputer
    private readonly routeSync = new GarminFlightPlanRouteSyncManager()
    private readonly publisher: Publisher<G5NavdataEvents>
    private readonly navdataLabel: ConsumerValue<CDIScaleLabel>
    private readonly gpsActiveWaypoint: ConsumerSubject<boolean>
    private readonly gpsApproachActive: ConsumerSubject<boolean>
    private readonly gpsHasGlidepath: ConsumerSubject<boolean>
    private readonly gpsCdiScaling: ConsumerSubject<number>

    private isInitialized = false
    private efbRouteSub?: Subscription
    private publishedLabel: CDIScaleLabel | null = null

    constructor(bus: EventBus) {
        this.publisher = bus.getPublisher<G5NavdataEvents>()
        this.facLoader = new FacilityLoader(FacilityRepository.getRepository(bus))
        this.calculator = new FlightPathCalculator(
            this.facLoader,
            FLIGHT_PATH_CALCULATOR_OPTIONS,
            bus
        )
        this.planner = FlightPlanner.getPlanner(bus, this.calculator)
        this.fms = new Fms(true, bus, this.planner, undefined, { facLoader: this.facLoader })
        this.lnav = new LNavComputer(0, bus, this.planner, undefined, {})
        this.navdata = new NavdataComputer(bus, this.planner, this.facLoader)
        this.navdataLabel = ConsumerValue.create(
            bus.getSubscriber<LNavDataEvents>().on('lnavdata_cdi_scale_label'),
            CDIScaleLabel.Oceanic
        )

        const navSub = bus.getSubscriber<G5NavEvents>()
        this.gpsActiveWaypoint = ConsumerSubject.create(navSub.on('gps_active_waypoint'), false)
        this.gpsApproachActive = ConsumerSubject.create(navSub.on('gps_approach_active'), false)
        this.gpsHasGlidepath = ConsumerSubject.create(navSub.on('gps_has_glidepath'), false)
        this.gpsCdiScaling = ConsumerSubject.create(navSub.on('gps_cdi_scaling'), 0)
    }

    async init(): Promise<void> {
        if (this.isInitialized) return
        this.isInitialized = true

        await this.facLoader.awaitInitialization()
        await this.fms.initPrimaryFlightPlan()

        const routeManager = await FlightPlanRouteManager.getManager()
        this.routeSync.init(
            routeManager,
            new GarminPrimaryFlightPlanRouteLoader(this.fms),
            new GarminPrimaryFlightPlanRouteProvider(this.fms)
        )
        this.routeSync.startAutoReply()
        this.routeSync.startAutoSync()

        // startAutoSync() only loads routes synced after it starts, so seed the FMS from the
        // current world-map route and reload on change; an empty plan can only report OCN.
        this.efbRouteSub = routeManager.efbRoute.sub(route => this.loadRoute(route), true)
    }

    onUpdate(): void {
        this.lnav.update()

        const label = this.resolveLabel()
        if (label !== this.publishedLabel) {
            this.publishedLabel = label
            this.publisher.pub('g5_cdi_scale_label', label, false, true)
        }
    }

    destroy(): void {
        this.efbRouteSub?.destroy()
        this.navdataLabel.destroy()
        this.routeSync.destroy()
        this.gpsActiveWaypoint.destroy()
        this.gpsApproachActive.destroy()
        this.gpsHasGlidepath.destroy()
        this.gpsCdiScaling.destroy()
    }

    private async loadRoute(route: ReadonlyFlightPlanRoute): Promise<void> {
        try {
            await this.routeSync.loadRoute(route)
        } catch (e) {
            console.error('NavdataStack route load failed', e)
        }
    }

    private resolveLabel(): CDIScaleLabel {
        return (
            readVendorCdiScaleLabel() ??
            this.fmsLabel() ??
            deriveCdiScaleLabelFromSimVars(
                this.gpsActiveWaypoint.get(),
                this.gpsApproachActive.get(),
                this.gpsHasGlidepath.get(),
                this.gpsCdiScaling.get()
            )
        )
    }

    private fmsLabel(): CDIScaleLabel | null {
        const hasPlan =
            this.fms.hasPrimaryFlightPlan() && this.fms.getPrimaryFlightPlan().length > 0
        return hasPlan ? this.navdataLabel.get() : null
    }
}
