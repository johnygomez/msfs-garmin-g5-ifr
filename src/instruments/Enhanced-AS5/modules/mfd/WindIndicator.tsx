import {
    AdcEvents,
    AhrsEvents,
    ComponentProps,
    EventBus,
    FSComponent,
    MappedSubject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { ReactiveComponent } from '../common/Reactive'
import { Colors, displayStyle, formatCourse, visibilityAttribute, WindMode } from '../common/Utils'

const MIN_TRUE_AIRSPEED_KNOTS = 30
const MIN_WIND_SPEED_KNOTS = 1

export interface WindIndicatorProps extends ComponentProps {
    bus: EventBus
    mode: Subscribable<WindMode>
}

export class WindIndicator extends ReactiveComponent<WindIndicatorProps> {
    private readonly adc = this.props.bus.getSubscriber<AdcEvents>()

    private readonly windDirection = this.consume(
        this.adc.on('ambient_wind_direction').withPrecision(0),
        0
    )
    private readonly windSpeed = this.consume(
        this.adc.on('ambient_wind_velocity').withPrecision(0),
        0
    )
    private readonly onGround = this.consume(this.adc.on('on_ground'), true)
    private readonly trueAirspeed = this.consume(this.adc.on('tas').withPrecision(0), 0)
    private readonly trueHeading = this.consume(
        this.props.bus.getSubscriber<AhrsEvents>().on('actual_hdg_deg_true').withPrecision(0),
        0
    )

    private readonly state = this.track(
        this.props.mode.map(mode => (mode === 'ON' ? 'Active' : 'Inactive'))
    )
    private readonly isWindValid = this.track(
        MappedSubject.create(
            ([onGround, trueAirspeed]) => !onGround && trueAirspeed >= MIN_TRUE_AIRSPEED_KNOTS,
            this.onGround,
            this.trueAirspeed
        )
    )
    private readonly windDataStyle = this.track(displayStyle(this.isWindValid))
    private readonly noWindDataStyle = this.track(
        displayStyle(this.track(this.isWindValid.map(valid => !valid)))
    )
    private readonly isWindCalm = this.track(
        this.windSpeed.map(speed => speed < MIN_WIND_SPEED_KNOTS)
    )
    private readonly windDirectionText = this.track(
        MappedSubject.create(
            ([direction, calm]) => formatCourse(calm ? NaN : direction),
            this.windDirection,
            this.isWindCalm
        )
    )
    private readonly arrowVisibility = this.track(
        visibilityAttribute(this.track(this.isWindCalm.map(calm => !calm)))
    )
    private readonly arrowTransform = this.track(
        MappedSubject.create(
            ([direction, heading]) => `rotate(${direction - heading + 180})`,
            this.windDirection,
            this.trueHeading
        )
    )

    render(): VNode {
        return (
            <div id="WindIndicator" state={this.state}>
                <svg id="WindIndicatorArrow" viewBox="-10 -10 20 20" style={this.windDataStyle}>
                    <polygon
                        points="0,-9 6,-2 2,-2 2,9 -2,9 -2,-2 -6,-2"
                        fill={Colors.WHITE}
                        transform={this.arrowTransform}
                        visibility={this.arrowVisibility}
                    />
                </svg>
                <div id="WindIndicatorValues" style={this.windDataStyle}>
                    <span>{this.windSpeed.map(speed => `${speed}KT`)}</span>
                    <span>{this.windDirectionText}</span>
                </div>
                <span id="WindIndicatorNoData" style={this.noWindDataStyle}>
                    NO WIND DATA
                </span>
            </div>
        )
    }
}
