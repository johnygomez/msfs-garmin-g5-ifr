import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    MappedSubscribable,
    Subject,
    Subscribable,
    Subscription,
    VNode,
} from '@microsoft/msfs-sdk'

interface DropdonwOptionProps<T> extends ComponentProps {
    value: T
}

class DropdownOption<T> extends DisplayComponent<DropdonwOptionProps<T>> {
    private readonly selected = Subject.create(false)
    private readonly state: MappedSubscribable<string>

    constructor(props: DropdonwOptionProps<T>) {
        super(props)

        this.state = this.selected.map(sel => (sel ? 'Selected' : 'Unselected')).pause()
    }

    onAfterRender(): void {
        this.state.resume()
    }

    setSelected(selected: boolean): void {
        this.selected.set(selected)
    }

    destroy(): void {
        this.state.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div class="DropdownOption" state={this.state}>
                {this.props.value}
            </div>
        )
    }
}

interface DropdownOverlayProps<T> extends ComponentProps {
    id?: string
    title: string
    selected: Subscribable<T>
    options: readonly T[]
    active: Subscribable<boolean>
    onSelected: (value?: T) => void
    onLongPush?: () => void
}

export class DropdownOverlay<T> extends DisplayComponent<DropdownOverlayProps<T>> {
    static readonly MAX_VISIBLE = 2
    static readonly OPTION_HEIGHT_EM = 2

    private readonly cursorMin = Subject.create(0)
    private readonly cursorMax = Subject.create(DropdownOverlay.MAX_VISIBLE - 1)
    private readonly cursorIndex = Subject.create(0)
    private readonly state: MappedSubscribable<string>
    private readonly scrollTransform = Subject.create('')

    private readonly optionNodes: VNode[]
    private readonly items: DropdownOption<T>[]

    private readonly visibilityWatcher: Subscription

    constructor(props: DropdownOverlayProps<T>) {
        super(props)

        this.state = this.props.active.map(open => (open ? 'Active' : 'Inactive')).pause()
        this.optionNodes = this.generateOptions()
        this.items = this.optionNodes.map(n => n.instance as DropdownOption<T>)
        this.visibilityWatcher = this.props.active.sub(_ => this.reset(), true, true)
    }

    onAfterRender(): void {
        this.state.resume()
        this.visibilityWatcher.resume()
        this.reset()
    }

    destroy(): void {
        this.state.destroy()
        this.visibilityWatcher.destroy()
        super.destroy()
    }

    reset(): void {
        const initialIndex = this.getPreselectedIndex(this.props.selected.get())
        const minIndex = Math.max(
            0,
            Math.min(initialIndex, this.items.length - DropdownOverlay.MAX_VISIBLE)
        )
        const maxIndex = minIndex + DropdownOverlay.MAX_VISIBLE - 1
        this.cursorIndex.set(initialIndex)
        this.cursorMin.set(minIndex)
        this.cursorMax.set(maxIndex)
        this.scrollTransform.set('')
        this.syncItemStates()
        this.scrollToCursor(this.cursorIndex.get())
    }

    onEvent(event: string): void {
        switch (event) {
            case 'Knob_Inc':
            case 'NavigationSmallInc':
                this.moveCursor(-1)
                break
            case 'Knob_Dec':
            case 'NavigationSmallDec':
                this.moveCursor(1)
                break
            case 'Knob_Push':
            case 'ENT_Push':
                const selectedItem = this.items[this.cursorIndex.get()]
                this.props.onSelected(selectedItem?.props?.value)
                break
            case 'Knob_Long_Push':
                this.props.onLongPush?.()
                break
        }
    }

    private generateOptions(): VNode[] {
        return this.props.options.map(option => <DropdownOption value={option} />)
    }

    private moveCursor(direction: 1 | -1): void {
        if (this.items.length === 0) return

        const curr = this.cursorIndex.get()
        const index = Math.max(0, Math.min(curr + direction, this.items.length - 1))
        this.cursorIndex.set(index)
        this.scrollToCursor(index)
        this.syncItemStates()
    }

    private scrollToCursor(index: number): void {
        if (index < this.cursorMin.get()) {
            this.cursorMin.set(index)
            this.cursorMax.set(index + DropdownOverlay.MAX_VISIBLE - 1)
        } else if (index > this.cursorMax.get()) {
            this.cursorMax.set(index)
            this.cursorMin.set(index - DropdownOverlay.MAX_VISIBLE + 1)
        }
        const translateEM = this.cursorMin.get() * -DropdownOverlay.OPTION_HEIGHT_EM
        this.scrollTransform.set(`transform: translateY(${translateEM}em)`)
    }

    private syncItemStates(): void {
        const cursor = this.cursorIndex.get()
        this.items.forEach((item, index) => {
            item.setSelected(index === cursor)
        })
    }

    private getPreselectedIndex(value: T): number {
        return Math.max(
            this.items.findIndex(item => item.props.value === value),
            0
        )
    }

    render(): VNode {
        return (
            <div id={this.props.id} class="DropdownOverlay" state={this.state}>
                <div class="DropdownTitle">{this.props.title}</div>
                <div class="DropdownOptionsContainer">
                    <div class="DropdownOptions" style={this.scrollTransform}>
                        {this.optionNodes}
                    </div>
                </div>
            </div>
        )
    }
}
