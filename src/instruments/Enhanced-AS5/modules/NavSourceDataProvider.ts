import {
    ConsumerSubject,
    EventBus,
    MappedSubject,
    SimVarValueType,
    Subject,
} from '@microsoft/msfs-sdk'

import { G5CustomEvents } from './G5CustomPublisher'
import { VerticalDeviationMode } from './VerticalDeviationIndicator'

export type NavSource = 'GPS' | 'NAV1' | 'NAV2'

type GpsVerticalMode = Extract<VerticalDeviationMode, 'GP' | 'VNAV' | 'None'>

const GSI_FULL_SCALE_DEFLECTION = 127
const GPS_PHASE_LNAV_PLUS_V = 8

export class NavSourceDataProvider {
    private readonly gpsDrivesNav1: ConsumerSubject<boolean>
    private readonly navSelected: ConsumerSubject<number>

    readonly activeSource: MappedSubject<[boolean, number], NavSource>
    readonly hasGs = Subject.create(false)
    readonly gpsVerticalMode = Subject.create<GpsVerticalMode>('None')
    readonly verticalDeviationMode: MappedSubject<[GpsVerticalMode, boolean], VerticalDeviationMode>
    readonly verticalDeviationValue = Subject.create(0)

    constructor(bus: EventBus) {
        const g5Sub = bus.getSubscriber<G5CustomEvents>()
        this.gpsDrivesNav1 = ConsumerSubject.create(g5Sub.on('gps_drives_nav1'), false)
        this.navSelected = ConsumerSubject.create(g5Sub.on('nav_selected'), 0)

        this.activeSource = MappedSubject.create(
            ([gpsDrives, navSel]) => {
                if (gpsDrives) return 'GPS'
                if (navSel === 1) return 'NAV1'
                if (navSel === 2) return 'NAV2'
                return 'GPS'
            },
            this.gpsDrivesNav1,
            this.navSelected
        ).pause()

        this.verticalDeviationMode = MappedSubject.create(
            ([gpsVertical, hasGs]) => {
                if (gpsVertical !== 'None') return gpsVertical
                if (hasGs) return 'GS'
                return 'None'
            },
            this.gpsVerticalMode,
            this.hasGs
        ).pause()
    }

    onUpdate(): void {
        const source = this.activeSource.get()

        this.gpsVerticalMode.set(this.computeGpsVerticalMode(source))
        this.hasGs.set(this.isGlideslopePresent(source))

        this.verticalDeviationValue.set(this.computeDeviationValue(source))
    }

    resume(): void {
        this.activeSource.resume()
        this.verticalDeviationMode.resume()
    }

    destroy(): void {
        this.gpsDrivesNav1.destroy()
        this.navSelected.destroy()
        this.activeSource.destroy()
        this.verticalDeviationMode.destroy()
    }

    private computeGpsVerticalMode(source: NavSource): GpsVerticalMode {
        const hasGlidepath =
            source === 'GPS' && !!SimVar.GetSimVarValue('GPS HAS GLIDEPATH', SimVarValueType.Bool)
        if (!hasGlidepath) return 'None'

        const phase = SimVar.GetSimVarValue('L:GPS_Current_Phase', SimVarValueType.Number)
        return phase === GPS_PHASE_LNAV_PLUS_V ? 'VNAV' : 'GP'
    }

    private isGlideslopePresent(source: NavSource): boolean {
        if (source !== 'NAV1' && source !== 'NAV2') return false
        const idx = this.navRadioIndex(source)
        return !!SimVar.GetSimVarValue(`NAV HAS GLIDE SLOPE:${idx}`, SimVarValueType.Bool)
    }

    private computeDeviationValue(source: NavSource): number {
        switch (this.verticalDeviationMode.get()) {
            case 'GS': {
                const idx = this.navRadioIndex(source)
                const raw = SimVar.GetSimVarValue(`NAV GSI:${idx}`, SimVarValueType.Number)
                return raw / GSI_FULL_SCALE_DEFLECTION
            }
            case 'GP':
            case 'VNAV': {
                const scaling = SimVar.GetSimVarValue('GPS GSI SCALING', SimVarValueType.Meters)
                if (scaling <= 0) return 0
                const error = SimVar.GetSimVarValue('GPS VERTICAL ERROR', SimVarValueType.Meters)
                return error / scaling
            }
            default:
                return 0
        }
    }

    private navRadioIndex(source: NavSource): 1 | 2 {
        return source === 'NAV2' ? 2 : 1
    }
}
