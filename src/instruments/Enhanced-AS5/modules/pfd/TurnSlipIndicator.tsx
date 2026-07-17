import {
    FSComponent,
    ComponentProps,
    DisplayComponent,
    MappedSubject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

import { Colors } from '../common/Utils'

export interface TurnRateIndicatorProps extends ComponentProps {
    turnRate: Subscribable<number>
}

export class TurnRateIndicatorComponent extends DisplayComponent<TurnRateIndicatorProps> {
    private readonly barStyle: MappedSubject<[number], string>

    constructor(props: TurnRateIndicatorProps) {
        super(props)

        this.barStyle = MappedSubject.create(([r]) => {
            const clamped = Math.min(Math.max(r, -6), 6)
            const widthPct = (Math.abs(clamped) * 40) / 3
            const leftPct = clamped <= 0 ? 50 - widthPct : 50
            const borderRadius = clamped <= 0 ? '5px 0 0 5px' : '0 5px 5px 0'
            return `width: ${widthPct}%; left: ${leftPct}%; border-radius: ${borderRadius}`
        }, props.turnRate).pause()
    }

    destroy(): void {
        this.barStyle.destroy()
        super.destroy()
    }

    onAfterRender(): void {
        this.barStyle.resume()
    }

    render(): VNode {
        return (
            <div class="turn-rate-indicator-root">
                <div class="turn-rate-bar" style={this.barStyle}></div>
                <div class="turn-rate-left-marker"></div>
                <div class="turn-rate-right-marker"></div>
                <div class="turn-rate-center-marker"></div>
            </div>
        )
    }
}

export interface SlipSkidIndicatorProps extends ComponentProps {
    slipSkid: Subscribable<number>
}

export class SlipSkidIndicatorComponent extends DisplayComponent<SlipSkidIndicatorProps> {
    private readonly ballCx: MappedSubject<[number], number>

    constructor(props: SlipSkidIndicatorProps) {
        super(props)

        this.ballCx = MappedSubject.create(
            ([s]) => Math.min(Math.max(s, -1), 1) * 50,
            props.slipSkid
        ).pause()
    }

    destroy(): void {
        this.ballCx.destroy()
        super.destroy()
    }

    onAfterRender(): void {
        this.ballCx.resume()
    }

    render(): VNode {
        return (
            <svg
                class="slip-skid-indicator-root"
                width="100%"
                viewBox="-50 -12 100 24"
                overflow="visible"
            >
                <circle
                    class="slip-skid-ball"
                    cx={this.ballCx}
                    cy="0"
                    r="10"
                    fill={Colors.WHITE}
                    stroke={Colors.BLACK}
                />
                <rect
                    class="slip-skid-left-marker"
                    x="-12"
                    y="-12"
                    width="4"
                    height="24"
                    fill={Colors.WHITE}
                    stroke={Colors.BLACK}
                />
                <rect
                    class="slip-skid-right-marker"
                    x="12"
                    y="-12"
                    width="4"
                    height="24"
                    fill={Colors.WHITE}
                    stroke={Colors.BLACK}
                />
            </svg>
        )
    }
}
