import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    Subscribable,
    Subject,
    VNode,
    MappedSubscribable,
} from '@microsoft/msfs-sdk'

export interface SubmenuItemProps extends ComponentProps {
    title: string
    onSelect: () => void
    value: Subscribable<string>
}

/** A single menu entry. Renders its own row; its selected/visible state is driven by the parent {@link Menu}. */
export class SubmenuItem extends DisplayComponent<SubmenuItemProps> {
    private readonly selected = Subject.create(false)
    private readonly state: MappedSubscribable<string>

    constructor(props: SubmenuItemProps) {
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

    select(): void {
        this.props.onSelect?.()
    }

    render(): VNode {
        return (
            <div class="SubmenuItem" state={this.state}>
                <div class="SubmenuItemTitle">{this.props.title}</div>
                <div class="SubmenuItemValue">{this.props.value}</div>
            </div>
        )
    }
}

interface SubmenuOverlayProps extends ComponentProps {
    title: string
    active: Subscribable<boolean>
    onLongPush?: () => void
}

export class SubmenuOverlay extends DisplayComponent<SubmenuOverlayProps> {
    static readonly item = SubmenuItem

    private readonly itemNodes = this.collectChildren()
    private readonly items = this.itemNodes.map(node => node.instance as SubmenuItem)

    private readonly cursorIndex = Subject.create(0)
    private readonly state: MappedSubscribable<string>
    private readonly resetWatcher: MappedSubscribable<void>

    constructor(props: SubmenuOverlayProps) {
        super(props)

        this.state = this.props.active.map(open => (open ? 'Active' : 'Inactive')).pause()
        this.resetWatcher = this.props.active.map(_ => this.reset()).pause()
    }

    onAfterRender(): void {
        this.state.resume()
        this.resetWatcher.resume()
    }

    destroy(): void {
        this.state.destroy()
        this.resetWatcher.destroy()
        super.destroy()
    }

    reset(): void {
        this.cursorIndex.set(0)
        this.syncItemStates()
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
                this.items[this.cursorIndex.get()]?.select()
                break
            case 'Knob_Long_Push':
                this.props.onLongPush?.()
                break
        }
    }

    render(): VNode {
        return (
            <div id="SubmenuOverlay" state={this.state}>
                <div id="SubmenuOverlayTitle">{this.props.title}</div>
                <div id="SubmenuOverlayItems">{this.itemNodes}</div>
            </div>
        )
    }

    private collectChildren(): VNode[] {
        const nodes: VNode[] = []
        const visit = (node: unknown): void => {
            if (Array.isArray(node)) node.forEach(visit)
            else if (
                node &&
                typeof node === 'object' &&
                (node as VNode).instance instanceof SubmenuItem
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
        index = Math.max(0, Math.min(index + direction, count - 1))
        this.cursorIndex.set(index)
        this.syncItemStates()
    }

    private syncItemStates(): void {
        const cursor = this.cursorIndex.get()
        this.items.forEach((item, index) => {
            item.setSelected(index === cursor)
        })
    }
}
