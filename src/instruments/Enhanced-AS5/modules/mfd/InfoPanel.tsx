import {
    ComponentProps,
    ConsumerSubject,
    DisplayComponent,
    EventBus,
    FSComponent,
    MappedSubject,
    MappedSubscribable,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { NavSource } from '../providers/NavSourceDataProvider'
import { G5CustomEvents } from '../publishers/G5CustomPublisher'
import { G5NavEvents } from '../publishers/G5NavPublisher'

interface DTKInfoProps extends ComponentProps {
    bus: EventBus
    active: Subscribable<boolean>
}

class DTKInfo extends DisplayComponent<DTKInfoProps> {
    private readonly dtkValue: ConsumerSubject<number>
    private readonly dtkText: MappedSubscribable<string>
    private readonly style: MappedSubscribable<string>

    constructor(props: DTKInfoProps) {
        super(props)

        this.dtkValue = ConsumerSubject.create(
            this.props.bus.getSubscriber<G5NavEvents>().on('gps_wp_desired_track'),
            0
        ).pause()
        this.dtkText = this.dtkValue.map(value => fastToFixed(value, 0))
        this.style = this.props.active.map(active => (active ? '' : 'display: none;')).pause()
    }

    onAfterRender(): void {
        this.dtkValue.resume()
        this.dtkText.resume()
    }

    destroy(): void {
        this.dtkValue.destroy()
        this.dtkText.destroy()
        this.style.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="DTK" style={this.style}>
                <div id="DTKLabel">DTK</div>
                <div id="DTKValue">{this.dtkText}°</div>
            </div>
        )
    }
}

interface GroundSpeedInfoProps extends ComponentProps {
    bus: EventBus
    active: Subscribable<boolean>
}

class GroundSpeedInfo extends DisplayComponent<GroundSpeedInfoProps> {
    private readonly groundSpeed: ConsumerSubject<number>
    private readonly groundSpeedText: MappedSubscribable<string>
    private readonly style: MappedSubscribable<string>

    constructor(props: GroundSpeedInfoProps) {
        super(props)

        this.groundSpeed = ConsumerSubject.create(
            this.props.bus.getSubscriber<G5CustomEvents>().on('ground_speed'),
            0
        ).pause()
        this.groundSpeedText = this.groundSpeed.map(speed => fastToFixed(speed, 0)).pause()
        this.style = this.props.active.map(active => (active ? '' : 'display: none;')).pause()
    }

    onAfterRender(): void {
        this.groundSpeed.resume()
        this.groundSpeedText.resume()
        this.style.resume()
    }

    destroy(): void {
        this.groundSpeed.destroy()
        this.groundSpeedText.destroy()
        this.style.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="GroundSpeed" style={this.style}>
                <div>GS KT</div>
                <div id="GroundSpeedValue">{this.groundSpeedText}</div>
            </div>
        )
    }
}

type LeftInfoPanelMode = 'GS' | 'DTK' | 'CRS'

export interface LeftInfoPanelProps extends ComponentProps {
    navSource: Subscribable<NavSource>
    bus: EventBus
}

export class LeftInfoPanel extends DisplayComponent<LeftInfoPanelProps> {
    private readonly mode: MappedSubscribable<LeftInfoPanelMode>
    private readonly dtk: ConsumerSubject<number>

    private readonly dtkActive: MappedSubscribable<boolean>
    private readonly crsActive: MappedSubscribable<boolean>
    private readonly gsActive: MappedSubscribable<boolean>

    constructor(props: LeftInfoPanelProps) {
        super(props)

        const nav = this.props.bus.getSubscriber<G5NavEvents>()
        this.dtk = ConsumerSubject.create(nav.on('gps_wp_desired_track'), 0).pause()
        this.mode = MappedSubject.create(
            ([navSource, dtk]) => this.resolveMode(navSource, dtk),
            this.props.navSource,
            this.dtk
        ).pause()
        this.dtkActive = this.mode.map(mode => mode === 'DTK').pause()
        this.crsActive = this.mode.map(mode => mode === 'CRS').pause()
        this.gsActive = this.mode.map(mode => mode === 'GS').pause()
    }

    onAfterRender(): void {
        this.mode.resume()
        this.dtk.resume()
        this.dtkActive.resume()
        this.crsActive.resume()
        this.gsActive.resume()
    }

    destroy(): void {
        this.mode.destroy()
        this.dtkActive.destroy()
        this.crsActive.destroy()
        this.gsActive.destroy()
        this.dtk.destroy()
        super.destroy()
    }

    private resolveMode(navSrc: NavSource, dtk?: number): LeftInfoPanelMode {
        switch (navSrc) {
            case NavSource.Nav1:
            case NavSource.Nav2:
                return 'CRS'
            case NavSource.GPS:
                return !isNaN(dtk) ? 'DTK' : 'GS'
            default:
                return 'GS'
        }
    }

    render(): VNode {
        return (
            <>
                <DTKInfo bus={this.props.bus} active={this.dtkActive} />
                <GroundSpeedInfo bus={this.props.bus} active={this.gsActive} />
            </>
        )
    }
}
