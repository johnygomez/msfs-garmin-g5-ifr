import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    Subject,
    Subscribable,
    Subscription,
    VNode,
} from '@microsoft/msfs-sdk'

import { NavSystemElement } from './NavSystem'

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

    private context: SelectionValueContext | null = null
    private valuePipe?: Subscription

    get subjects(): SelectionValueSubjects {
        return {
            state: this.state,
            title: this.title,
            value: this.value,
        }
    }

    setContext(context: SelectionValueContext): void {
        this.context = context
    }

    init(_root: HTMLElement): void {}

    onEnter(): void {
        if (!this.context) return
        this.title.set(this.context.title)
        this.valuePipe?.destroy()
        this.valuePipe = this.context.displayValue.pipe(this.value)
        this.state.set('Active')
        this.activeContext.set(this.context)
    }

    onUpdate(_deltaTime: number): void {}

    onExit(): void {
        this.valuePipe?.destroy()
        this.valuePipe = undefined
        this.state.set('Inactive')
        this.activeContext.set(null)
    }

    onEvent(event: string): void {
        switch (event) {
            case 'Knob_Inc':
                this.context?.onIncrement()
                break
            case 'Knob_Dec':
                this.context?.onDecrement()
                break
            case 'Knob_Push':
                this.gps.closePopUpElement()
                break
            case 'Knob_Long_Push':
                this.context?.onSync?.()
                break
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
