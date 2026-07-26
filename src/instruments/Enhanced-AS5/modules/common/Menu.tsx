import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    MappedSubject,
    MappedSubscribable,
    Subject,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

export interface MenuItemProps extends ComponentProps {
    title: string
    onSelect?: () => void
    icon?: string
    value?: Subscribable<string>
    inactive?: boolean
    hidden?: Subscribable<boolean>
}

/** A single menu entry. Renders its own row; its selected/visible state is driven by the parent {@link Menu}. */
export class MenuItem extends DisplayComponent<MenuItemProps> {
    readonly inactive = this.props.inactive === true
    readonly hidden = this.props.hidden ?? Subject.create(false)

    private readonly selected = Subject.create(false)

    private readonly state: MappedSubscribable<string>
    private readonly style: MappedSubject<[boolean], string>

    constructor(props: MenuItemProps) {
        super(props)

        this.state = this.selected
            .map(sel => (this.inactive ? 'Inactive' : sel ? 'Selected' : 'Unselected'))
            .pause()

        this.style = MappedSubject.create(
            ([hidden]) => (hidden ? 'display: none;' : ''),
            this.hidden
        ).pause()
    }

    onAfterRender(): void {
        this.state.resume()
        this.style.resume()
    }

    setSelected(selected: boolean): void {
        this.selected.set(selected)
    }

    destroy(): void {
        this.state.destroy()
        this.style.destroy()
        super.destroy()
    }

    select(): void {
        if (!this.inactive) this.props.onSelect?.()
    }

    render(): VNode {
        return (
            <div class="ContextualMenuElement" style={this.style} state={this.state}>
                <div class="ContextualMenuElementName">{this.props.title}</div>
                {this.props.icon ? (
                    <div class="ContextualMenuElementImage">
                        <img src={this.props.icon} />
                    </div>
                ) : null}
                {this.props.value ? (
                    <div class="ContextualMenuElementValue">{this.props.value}</div>
                ) : null}
            </div>
        )
    }
}

interface MenuProps extends ComponentProps {
    maxVisible?: number
}

export class Menu extends DisplayComponent<MenuProps> {
    static readonly Item = MenuItem

    readonly isOpen = Subject.create(false)

    private readonly maxVisible = this.props.maxVisible ?? 4
    private readonly cursorMin = Subject.create(0)
    private readonly cursorMax = Subject.create(this.maxVisible - 1)
    private readonly cursorIndex = Subject.create(0)
    private readonly state: MappedSubscribable<string>
    private readonly scrollTransform = Subject.create('')
    private readonly activeSlider: MappedSubscribable<'Active' | 'Inactive'>

    private readonly itemNodes = this.collectItemNodes()
    private readonly items = this.itemNodes.map(node => node.instance as MenuItem)
    private readonly visibleItems: MappedSubject<[boolean[]], MenuItem[]>

    private readonly sliderCursorStyle: MappedSubscribable<string>

    constructor(props: MenuProps) {
        super(props)

        this.state = this.isOpen.map(open => (open ? 'Active' : 'Inactive')).pause()
        this.visibleItems = MappedSubject.create(
            ([...hidden]) => this.items.filter((_, id) => !hidden[id]),
            ...this.items.map(item => item.hidden)
        ).pause()

        this.sliderCursorStyle = MappedSubject.create(
            ([begin, visibleItems]) => {
                const denom = visibleItems.length - this.maxVisible
                if (denom <= 0) return ''
                const thumbWidthPercent = (this.maxVisible * 100) / visibleItems.length
                const scrollFraction = Math.min(begin / denom, 1)
                const leftPercent = scrollFraction * (100 - thumbWidthPercent)
                return `width: ${thumbWidthPercent}%; left: ${leftPercent}%;`
            },
            this.cursorMin,
            this.visibleItems
        ).pause()

        this.activeSlider = MappedSubject.create(
            ([visibleItems]) => (visibleItems.length > this.maxVisible ? 'Active' : 'Inactive'),
            this.visibleItems
        ).pause()

        this.visibleItems.sub(_ => {
            this.reset()
        })
    }

    onAfterRender(): void {
        this.state.resume()
        this.sliderCursorStyle.resume()
        this.visibleItems.resume()
        this.activeSlider.resume()
    }

    open(): void {
        this.reset()
        this.isOpen.set(true)
    }

    destroy(): void {
        this.state.destroy()
        this.sliderCursorStyle.destroy()
        this.visibleItems.destroy()
        this.activeSlider.destroy()
        super.destroy()
    }

    reset(): void {
        this.cursorIndex.set(0)
        this.cursorMin.set(0)
        this.cursorMax.set(this.maxVisible - 1)
        this.scrollTransform.set('')
        if (this.items[0]?.inactive) this.moveCursor(1)
        this.syncItemStates()
        this.scrollToCursor(this.cursorIndex.get())
    }

    close(): void {
        this.isOpen.set(false)
    }

    onEvent(event: string): void {
        switch (event) {
            case 'Knob_Inc':
            case 'NavigationSmallInc':
                this.moveCursor(1)
                break
            case 'Knob_Dec':
            case 'NavigationSmallDec':
                this.moveCursor(-1)
                break
            case 'Knob_Push':
            case 'ENT_Push':
                this.visibleItems.get()[this.cursorIndex.get()]?.select()
                break
            case 'MENU_Push':
                this.close()
                break
        }
    }

    private collectItemNodes(): VNode[] {
        const nodes: VNode[] = []
        const visit = (node: unknown): void => {
            if (Array.isArray(node)) node.forEach(visit)
            else if (
                node &&
                typeof node === 'object' &&
                (node as VNode).instance instanceof MenuItem
            )
                nodes.push(node as VNode)
        }
        visit(this.props.children)
        return nodes
    }

    private moveCursor(direction: 1 | -1): void {
        const visibleItems = this.visibleItems.get()
        const count = visibleItems.length
        if (count === 0) return
        if (visibleItems.every(item => item.inactive)) return

        let index = this.cursorIndex.get()
        do {
            index = Math.max(0, Math.min(index + direction, count - 1))
        } while (visibleItems[index].inactive && index > 0 && index < count - 1)

        this.cursorIndex.set(index)
        this.scrollToCursor(index)
        this.syncItemStates()
    }

    private scrollToCursor(index: number): void {
        if (index < this.cursorMin.get()) {
            this.cursorMin.set(index)
            this.cursorMax.set(index + this.maxVisible - 1)
        } else if (index > this.cursorMax.get()) {
            this.cursorMax.set(index)
            this.cursorMin.set(index - this.maxVisible + 1)
        }
        const translatePercent = this.cursorMin.get() * (-100 / this.maxVisible)
        this.scrollTransform.set(`transform: translateX(${translatePercent}%)`)
    }

    private syncItemStates(): void {
        const cursor = this.cursorIndex.get()
        this.visibleItems.get().forEach((item, index) => {
            item.setSelected(index === cursor)
        })
    }

    render(): VNode {
        return (
            <div id="ContextualMenu" state={this.state}>
                <div id="ContextualMenuElements" style={this.scrollTransform}>
                    {this.itemNodes}
                </div>
                <div id="SliderMenu" state={this.activeSlider}>
                    <div id="SliderMenuBackground" />
                    <div id="SliderMenuCursor" style={this.sliderCursorStyle} />
                </div>
            </div>
        )
    }
}
