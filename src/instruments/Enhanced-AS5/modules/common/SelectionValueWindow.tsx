import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    Subject,
    Subscribable,
    Subscription,
    VNode,
} from '@microsoft/msfs-sdk'

import { NavSystemElement, OverlayDescriptor } from './NavSystem'

export enum KnobValueUnit {
    Degrees = 0,
    Feet = 1,
    InHg = 2,
}

export interface SelectionValueContext {
    title: string
    displayValue: Subscribable<string>
    knobValue: Subscribable<number>
    knobUnit: KnobValueUnit
    onIncrement: () => void
    onDecrement: () => void
    onSync?: () => void
}

export interface SelectionValueSubjects {
    state: Subscribable<string>
    title: Subscribable<string>
    value: Subscribable<string>
}

export class SelectionValueElement extends NavSystemElement {
    readonly activeContext = Subject.create<SelectionValueContext | null>(null)

    private readonly state = Subject.create('Inactive')
    private readonly title = Subject.create('')
    private readonly value = Subject.create('')

    private valuePipe?: Subscription

    get subjects(): SelectionValueSubjects {
        return {
            state: this.state,
            title: this.title,
            value: this.value,
        }
    }

    init(_root: HTMLElement): void {}

    onUpdate(_deltaTime: number): void {}

    createOverlay(context: SelectionValueContext): OverlayDescriptor {
        this.title.set(context.title)
        this.valuePipe?.destroy()
        this.valuePipe = context.displayValue.pipe(this.value)
        this.state.set('Active')
        this.activeContext.set(context)

        const deactivate = () => {
            this.valuePipe?.destroy()
            this.valuePipe = undefined
            this.state.set('Inactive')
            this.activeContext.set(null)
        }

        return {
            kind: 'selectionValue',
            onEvent: event => {
                switch (event) {
                    case 'Knob_Inc':
                        context.onIncrement()
                        break
                    case 'Knob_Dec':
                        context.onDecrement()
                        break
                    case 'Knob_Push':
                        this.gps.closeOverlay()
                        break
                    case 'Knob_Long_Push':
                        context.onSync?.()
                        break
                }
            },
            onClose: deactivate,
        }
    }
}

export interface SelectionValueWindowProps extends ComponentProps, SelectionValueSubjects {}

export class SelectionValueWindowComponent extends DisplayComponent<SelectionValueWindowProps> {
    render(): VNode {
        return (
            <div id="SelectionValueWindow" state={this.props.state}>
                <div id="SelectionValueWindowTitle">{this.props.title}</div>
                <div id="SelectionValueWindowValue">{this.props.value}</div>
            </div>
        )
    }
}
