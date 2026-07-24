import {
    ComponentProps,
    DisplayComponent,
    FSComponent,
    Subscribable,
    VNode,
} from '@microsoft/msfs-sdk'

interface ValueSelectOverlayProps extends ComponentProps {
    title: string
    value: Subscribable<string>
    active: Subscribable<boolean>
}

export class ValueSelectOverlay extends DisplayComponent<ValueSelectOverlayProps> {
    private readonly state = this.props.active.map(active => (active ? 'Active' : 'Inactive'))

    destroy(): void {
        this.state.destroy()
        super.destroy()
    }

    render(): VNode {
        return (
            <div id="SelectionValueWindow" state={this.state}>
                <div id="SelectionValueWindowTitle">{this.props.title}</div>
                <div id="SelectionValueWindowValue">{this.props.value}</div>
            </div>
        )
    }
}
