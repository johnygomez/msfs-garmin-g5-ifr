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
    private readonly visible = Subject.create(true)

    private readonly state: MappedSubscribable<string>
    private readonly style: MappedSubject<[boolean, boolean], string>

    constructor(props: MenuItemProps) {
        super(props)

        this.state = this.selected
            .map(sel => (this.inactive ? 'Inactive' : sel ? 'Selected' : 'Unselected'))
            .pause()

        this.style = MappedSubject.create(
            ([visible, hidden]) => {
                if (hidden) return 'display: none;'
                return visible ? '' : 'display: none;'
            },
            this.visible,
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

    setVisible(visible: boolean): void {
        this.visible.set(visible)
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

    private readonly cursorIndex = Subject.create(0)
    private readonly displayBeginIndex = Subject.create(0)
    private readonly state: MappedSubscribable<string>

    private readonly maxVisible = this.props.maxVisible ?? 4
    private readonly itemNodes = this.collectItemNodes()
    private readonly items = this.itemNodes.map(node => node.instance as MenuItem)

    private readonly sliderCursorStyle: MappedSubscribable<string>

    constructor(props: MenuProps) {
        super(props)

        this.state = this.isOpen.map(open => (open ? 'Active' : 'Inactive')).pause()

        this.sliderCursorStyle = this.displayBeginIndex
            .map(begin => {
                const denom = this.items.length - this.maxVisible
                if (denom <= 0) return ''
                const heightPercent = (this.maxVisible * 100) / this.items.length
                const scrollRatio = Math.min(begin / denom, 1)
                return `height: ${heightPercent}%; top: ${scrollRatio * (100 - heightPercent)}%;`
            })
            .pause()
    }

    onAfterRender(): void {
        this.state.resume()
        this.sliderCursorStyle.resume()
    }

    open(): void {
        this.cursorIndex.set(0)
        this.displayBeginIndex.set(0)
        this.isOpen.set(true)
        if (this.items[0]?.inactive) this.moveCursor(1)
        this.syncItemStates()
    }

    destroy(): void {
        this.state.destroy()
        this.sliderCursorStyle.destroy()
        super.destroy()
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
                this.items[this.cursorIndex.get()]?.select()
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
        const count = this.items.length
        if (count === 0) return

        let index = this.cursorIndex.get()
        let steps = 0
        do {
            index = (index + direction + count) % count
            steps++
        } while ((this.items[index].inactive || this.items[index].hidden) && steps < count)

        this.cursorIndex.set(index)
        this.scrollToCursor(index)
        this.syncItemStates()
    }

    private scrollToCursor(index: number): void {
        let begin = this.displayBeginIndex.get()
        if (index < begin) begin = index
        else if (index > begin + this.maxVisible - 1) begin = index - this.maxVisible + 1
        this.displayBeginIndex.set(begin)
    }

    private syncItemStates(): void {
        const cursor = this.cursorIndex.get()
        const begin = this.displayBeginIndex.get()
        this.items.forEach((item, index) => {
            item.setSelected(index === cursor)
            item.setVisible(index >= begin && index < begin + this.maxVisible)
        })
    }

    render(): VNode {
        const hasSlider = this.items.length > this.maxVisible
        return (
            <div id="ContextualMenu" state={this.state}>
                <div id="ContextualMenuElements">{this.itemNodes}</div>
                <div id="SliderMenu" state={hasSlider ? 'Active' : 'Inactive'}>
                    <div id="SliderMenuBackground" />
                    <div id="SliderMenuCursor" style={this.sliderCursorStyle} />
                </div>
            </div>
        )
    }
}
