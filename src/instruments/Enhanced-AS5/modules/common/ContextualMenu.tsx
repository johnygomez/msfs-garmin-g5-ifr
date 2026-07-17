import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    MappedSubject,
    MappedSubscribable,
    Subject,
    Subscribable,
    Subscription,
    VNode,
} from '@microsoft/msfs-sdk'

export interface ContextualMenuElementData {
    name: string
    callback: () => boolean | void
    isInactive: () => boolean
    imageSrc?: string
    value?: Subscribable<string>
}

export interface ContextualMenuSettings {
    state: Subscribable<string>
    elements: Subscribable<ContextualMenuElementData[]>
    cursorIndex: Subscribable<number>
    displayBeginIndex: Subscribable<number>
    maxVisibleElements: number
}

export interface ContextualMenuComponentProps extends ComponentProps, ContextualMenuSettings {}

interface ContextualMenuSlotProps extends ComponentProps {
    element: Subscribable<ContextualMenuElementData | undefined>
    isSelected: Subscribable<boolean>
}

class ContextualMenuSlot extends DisplayComponent<ContextualMenuSlotProps> {
    private readonly value = Subject.create('')

    private readonly rootStyle = this.props.element.map(element =>
        element ? 'display: block;' : 'display: none;'
    )
    private readonly name = this.props.element.map(element => element?.name ?? '')
    private readonly imageSrc = this.props.element.map(element => element?.imageSrc ?? '')
    private readonly imageStyle = this.props.element.map(element =>
        element?.imageSrc ? '' : 'display: none;'
    )
    private readonly valueStyle = this.props.element.map(element =>
        element?.value ? '' : 'display: none;'
    )

    private readonly state = MappedSubject.create(
        ([element, isSelected]) => this.computeState(element, isSelected),
        this.props.element,
        this.props.isSelected
    )

    private readonly valueBinding: Subscription
    private valuePipe?: Subscription

    constructor(props: ContextualMenuSlotProps) {
        super(props)
        this.valueBinding = props.element.sub(element => this.rebindValue(element), false, true)
    }

    onAfterRender(): void {
        this.valueBinding.resume(true)
    }

    destroy(): void {
        this.valuePipe?.destroy()
        this.valueBinding.destroy()
        this.rootStyle.destroy()
        this.name.destroy()
        this.imageSrc.destroy()
        this.imageStyle.destroy()
        this.valueStyle.destroy()
        this.state.destroy()
        super.destroy()
    }

    private computeState(
        element: ContextualMenuElementData | undefined,
        isSelected: boolean
    ): string {
        if (!element || element.isInactive()) return 'Inactive'
        return isSelected ? 'Selected' : 'Unselected'
    }

    private rebindValue(element: ContextualMenuElementData | undefined): void {
        this.valuePipe?.destroy()
        this.valuePipe = element?.value?.pipe(this.value)
        if (!element?.value) this.value.set('')
    }

    render(): VNode {
        return (
            <div class="ContextualMenuElement" style={this.rootStyle} state={this.state}>
                <div class="ContextualMenuElementName">{this.name}</div>
                <div class="ContextualMenuElementImage" style={this.imageStyle}>
                    <img src={this.imageSrc} />
                </div>
                <div class="ContextualMenuElementValue" style={this.valueStyle}>
                    {this.value}
                </div>
            </div>
        )
    }
}

interface ContextualMenuSlotSubjects {
    element: MappedSubscribable<ContextualMenuElementData | undefined>
    isSelected: MappedSubscribable<boolean>
}

export class ContextualMenuComponent extends DisplayComponent<ContextualMenuComponentProps> {
    private readonly slots: ContextualMenuSlotSubjects[]

    private readonly sliderState = this.props.elements
        .map(elements => (elements.length > this.props.maxVisibleElements ? 'Active' : 'Inactive'))
        .pause()

    private readonly sliderCursorStyle = MappedSubject.create(
        ([elements, displayBeginIndex]) =>
            this.computeSliderCursorStyle(elements.length, displayBeginIndex),
        this.props.elements,
        this.props.displayBeginIndex
    ).pause()

    constructor(props: ContextualMenuComponentProps) {
        super(props)
        this.slots = Array.from({ length: props.maxVisibleElements }, (_, slotIndex) =>
            this.createSlotSubjects(slotIndex)
        )
    }

    onAfterRender(): void {
        this.slots.forEach(slot => {
            slot.element.resume()
            slot.isSelected.resume()
        })
        this.sliderState.resume()
        this.sliderCursorStyle.resume()
    }

    destroy(): void {
        this.slots.forEach(slot => {
            slot.element.destroy()
            slot.isSelected.destroy()
        })
        this.sliderState.destroy()
        this.sliderCursorStyle.destroy()
        super.destroy()
    }

    private createSlotSubjects(slotIndex: number): ContextualMenuSlotSubjects {
        return {
            element: MappedSubject.create(
                ([elements, displayBeginIndex]) => elements[displayBeginIndex + slotIndex],
                this.props.elements,
                this.props.displayBeginIndex
            ).pause(),
            isSelected: MappedSubject.create(
                ([displayBeginIndex, cursorIndex]) => displayBeginIndex + slotIndex === cursorIndex,
                this.props.displayBeginIndex,
                this.props.cursorIndex
            ).pause(),
        }
    }

    private computeSliderCursorStyle(elementCount: number, displayBeginIndex: number): string {
        const maxVisible = this.props.maxVisibleElements
        if (elementCount <= maxVisible) return ''

        const heightPercent = (maxVisible * 100) / elementCount
        const scrollRatio = Math.min(displayBeginIndex / (elementCount - maxVisible), 1)
        const topPercent = scrollRatio * (100 - heightPercent)
        return `height: ${heightPercent}%; top: ${topPercent}%;`
    }

    render(): VNode {
        return (
            <div id="ContextualMenu" state={this.props.state}>
                <div id="ContextualMenuElements">
                    {this.slots.map(slot => (
                        <ContextualMenuSlot element={slot.element} isSelected={slot.isSelected} />
                    ))}
                </div>
                <div id="SliderMenu" state={this.sliderState}>
                    <div id="SliderMenuBackground" />
                    <div id="SliderMenuCursor" style={this.sliderCursorStyle} />
                </div>
            </div>
        )
    }
}
