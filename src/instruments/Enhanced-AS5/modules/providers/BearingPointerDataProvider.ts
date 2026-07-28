import {
    AhrsEvents,
    ConsumerSubject,
    EventBus,
    MappedSubject,
    MappedSubscribable,
    Subscribable,
} from '@microsoft/msfs-sdk'

import { BearingPointerValue } from '../common/Nav'
import { G5NavEvents } from '../publishers/G5NavPublisher'
import { NavSource } from './NavSourceDataProvider'

export interface BearingReadout {
    ident: string
    dist: string
    angle: number
}

export interface BearingState extends BearingReadout {
    visible: boolean
    source: string
}

export const NO_BEARING: BearingState = {
    visible: false,
    source: '',
    ident: '',
    dist: '',
    angle: NaN,
}

const NO_BEARING_READOUT: BearingReadout = { ident: 'NO DATA', dist: '', angle: NaN }

export class BearingPointerDataProvider {
    readonly bearing1: MappedSubscribable<BearingState>
    readonly bearing2: MappedSubscribable<BearingState>

    private readonly magneticHeading: ConsumerSubject<number>
    private readonly gpsWpNextId: ConsumerSubject<string>
    private readonly gpsWpDistance: ConsumerSubject<number>
    private readonly gpsWpBearing: ConsumerSubject<number>
    private readonly adf1Signal: ConsumerSubject<number>
    private readonly adf1ActFreq: ConsumerSubject<number>
    private readonly adf1Radial: ConsumerSubject<number>
    private readonly nav1HasNav: ConsumerSubject<boolean>
    private readonly nav1Signal: ConsumerSubject<number>
    private readonly nav1Ident: ConsumerSubject<string>
    private readonly nav1HasDme: ConsumerSubject<boolean>
    private readonly nav1Dme: ConsumerSubject<number>
    private readonly nav1Radial: ConsumerSubject<number>
    private readonly nav2HasNav: ConsumerSubject<boolean>
    private readonly nav2Signal: ConsumerSubject<number>
    private readonly nav2Ident: ConsumerSubject<string>
    private readonly nav2HasDme: ConsumerSubject<boolean>
    private readonly nav2Dme: ConsumerSubject<number>
    private readonly nav2Radial: ConsumerSubject<number>

    private readonly gpsBearing: MappedSubscribable<BearingReadout>
    private readonly adfBearing: MappedSubscribable<BearingReadout>
    private readonly nav1Bearing: MappedSubscribable<BearingReadout>
    private readonly nav2Bearing: MappedSubscribable<BearingReadout>

    constructor(
        bus: EventBus,
        bearing1Source: Subscribable<BearingPointerValue>,
        bearing2Source: Subscribable<BearingPointerValue>
    ) {
        const nav = bus.getSubscriber<G5NavEvents & AhrsEvents>()

        this.magneticHeading = ConsumerSubject.create(
            nav.on('actual_hdg_deg').withPrecision(1),
            0
        ).pause()

        this.gpsWpNextId = ConsumerSubject.create(nav.on('gps_wp_next_id'), '').pause()
        this.gpsWpDistance = ConsumerSubject.create(nav.on('gps_wp_distance'), 0).pause()
        this.gpsWpBearing = ConsumerSubject.create(nav.on('gps_wp_bearing'), 0).pause()

        this.adf1Signal = ConsumerSubject.create(nav.on('adf1_signal'), 0).pause()
        this.adf1ActFreq = ConsumerSubject.create(nav.on('adf1_act_freq'), 0).pause()
        this.adf1Radial = ConsumerSubject.create(nav.on('adf1_radial'), 0).pause()

        this.nav1HasNav = ConsumerSubject.create(nav.on('nav1_has_nav'), false).pause()
        this.nav1Signal = ConsumerSubject.create(nav.on('nav1_signal'), 0).pause()
        this.nav1Ident = ConsumerSubject.create(nav.on('nav1_ident'), '').pause()
        this.nav1HasDme = ConsumerSubject.create(nav.on('nav1_has_dme'), false).pause()
        this.nav1Dme = ConsumerSubject.create(nav.on('nav1_dme'), 0).pause()
        this.nav1Radial = ConsumerSubject.create(nav.on('nav1_radial'), 0).pause()

        this.nav2HasNav = ConsumerSubject.create(nav.on('nav2_has_nav'), false).pause()
        this.nav2Signal = ConsumerSubject.create(nav.on('nav2_signal'), 0).pause()
        this.nav2Ident = ConsumerSubject.create(nav.on('nav2_ident'), '').pause()
        this.nav2HasDme = ConsumerSubject.create(nav.on('nav2_has_dme'), false).pause()
        this.nav2Dme = ConsumerSubject.create(nav.on('nav2_dme'), 0).pause()
        this.nav2Radial = ConsumerSubject.create(nav.on('nav2_radial'), 0).pause()

        this.gpsBearing = MappedSubject.create(
            ([id, dist, brg]): BearingReadout => ({
                ident: id,
                dist: String(dist),
                angle: brg,
            }),
            this.gpsWpNextId,
            this.gpsWpDistance,
            this.gpsWpBearing
        ).pause()

        this.adfBearing = MappedSubject.create(
            ([signal, freq, radial, hdg]): BearingReadout =>
                signal > 0
                    ? { ident: fastToFixed(freq, 1), dist: '', angle: (radial + hdg) % 360 }
                    : NO_BEARING_READOUT,
            this.adf1Signal,
            this.adf1ActFreq,
            this.adf1Radial,
            this.magneticHeading
        ).pause()

        this.nav1Bearing = MappedSubject.create(
            params => this.navBearing(...params),
            this.nav1HasNav,
            this.nav1Signal,
            this.nav1Ident,
            this.nav1HasDme,
            this.nav1Dme,
            this.nav1Radial
        ).pause()

        this.nav2Bearing = MappedSubject.create(
            params => this.navBearing(...params),
            this.nav2HasNav,
            this.nav2Signal,
            this.nav2Ident,
            this.nav2HasDme,
            this.nav2Dme,
            this.nav2Radial
        ).pause()

        this.bearing1 = MappedSubject.create(
            params => this.computeBearingState(...params),
            bearing1Source,
            this.nav1Bearing,
            this.nav2Bearing,
            this.gpsBearing,
            this.adfBearing
        ).pause()

        this.bearing2 = MappedSubject.create(
            params => this.computeBearingState(...params),
            bearing2Source,
            this.nav1Bearing,
            this.nav2Bearing,
            this.gpsBearing,
            this.adfBearing
        ).pause()
    }

    resume(): void {
        this.magneticHeading.resume()
        this.gpsWpNextId.resume()
        this.gpsWpDistance.resume()
        this.gpsWpBearing.resume()
        this.adf1Signal.resume()
        this.adf1ActFreq.resume()
        this.adf1Radial.resume()
        this.nav1HasNav.resume()
        this.nav1Signal.resume()
        this.nav1Ident.resume()
        this.nav1HasDme.resume()
        this.nav1Dme.resume()
        this.nav1Radial.resume()
        this.nav2HasNav.resume()
        this.nav2Signal.resume()
        this.nav2Ident.resume()
        this.nav2HasDme.resume()
        this.nav2Dme.resume()
        this.nav2Radial.resume()
        this.gpsBearing.resume()
        this.adfBearing.resume()
        this.nav1Bearing.resume()
        this.nav2Bearing.resume()
        this.bearing1.resume()
        this.bearing2.resume()
    }

    destroy(): void {
        this.magneticHeading.destroy()
        this.gpsWpNextId.destroy()
        this.gpsWpDistance.destroy()
        this.gpsWpBearing.destroy()
        this.adf1Signal.destroy()
        this.adf1ActFreq.destroy()
        this.adf1Radial.destroy()
        this.nav1HasNav.destroy()
        this.nav1Signal.destroy()
        this.nav1Ident.destroy()
        this.nav1HasDme.destroy()
        this.nav1Dme.destroy()
        this.nav1Radial.destroy()
        this.nav2HasNav.destroy()
        this.nav2Signal.destroy()
        this.nav2Ident.destroy()
        this.nav2HasDme.destroy()
        this.nav2Dme.destroy()
        this.nav2Radial.destroy()
        this.gpsBearing.destroy()
        this.adfBearing.destroy()
        this.nav1Bearing.destroy()
        this.nav2Bearing.destroy()
        this.bearing1.destroy()
        this.bearing2.destroy()
    }

    private computeBearingState(
        src: BearingPointerValue,
        n1: BearingReadout,
        n2: BearingReadout,
        gps: BearingReadout,
        adf: BearingReadout
    ): BearingState {
        switch (src) {
            case 'VLOC1':
                return { visible: true, source: NavSource.Nav1, ...n1 }
            case 'VLOC2':
                return { visible: true, source: NavSource.Nav2, ...n2 }
            case 'GPS':
                return { visible: true, source: NavSource.GPS, ...gps }
            case 'ADF':
                return { visible: true, source: 'ADF', ...adf }
            default:
                return NO_BEARING
        }
    }

    private navBearing(
        hasNav: boolean,
        signal: number,
        ident: string,
        hasDme: boolean,
        dme: number,
        radial: number
    ): BearingReadout {
        return hasNav
            ? {
                  ident: signal > 0 ? ident : '',
                  dist: hasDme ? String(dme) : '',
                  angle: (180 + radial) % 360,
              }
            : NO_BEARING_READOUT
    }
}
