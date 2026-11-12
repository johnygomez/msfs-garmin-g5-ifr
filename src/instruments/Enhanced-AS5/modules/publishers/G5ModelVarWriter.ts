import { SimVarValueType, Subscribable, Subscription } from '@microsoft/msfs-sdk'

import { AvionicsPage } from '../common/AvionicsPage'
import { ReactiveProvider } from '../common/Reactive'
import { G5Backlight } from '../providers/G5Backlight'

/**
 * Writes the G5 state read by the cockpit model behaviors into the instrument's `L:AS5_<index>_*`
 * variables: display power, backlight and the knob tooltip of the active page.
 */
export class G5ModelVarWriter extends ReactiveProvider {
    private knobTooltipSubs: Subscription[] = []

    constructor(
        private readonly instrumentIndex: number,
        displayOn: Subscribable<boolean>,
        backlight: G5Backlight
    ) {
        super()
        this.live(this.write('Display_On', displayOn))
        this.live(this.write('Backlight_Manual', backlight.isManual))
        this.live(this.write('Backlight_Level', backlight.manualIntensity))
        this.resume()
    }

    showKnobTooltipOf(page: AvionicsPage | null): void {
        this.destroyKnobTooltipSubs()
        this.knobTooltipSubs = page
            ? [this.write('Knob_Value', page.knobValue), this.write('Knob_Unit', page.knobUnit)]
            : []
    }

    destroy(): void {
        this.destroyKnobTooltipSubs()
        super.destroy()
    }

    private destroyKnobTooltipSubs(): void {
        this.knobTooltipSubs.forEach(sub => sub.destroy())
        this.knobTooltipSubs = []
    }

    private write(name: string, source: Subscribable<number | boolean>): Subscription {
        return source.sub(
            value =>
                SimVar.SetSimVarValue(
                    `L:AS5_${this.instrumentIndex}_${name}`,
                    SimVarValueType.Number,
                    Number(value)
                ),
            true
        )
    }
}
