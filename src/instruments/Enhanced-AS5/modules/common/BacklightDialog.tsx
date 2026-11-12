import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { Menu } from './Menu'
import { ReactiveComponent } from './Reactive'

export interface BacklightDialogProps extends ComponentProps {
    isOpen: Subscribable<boolean>
    isManual: Subscribable<boolean>
    /** Backlight level in effect, in percent. */
    level: Subscribable<number>
}

/**
 * The backlight page, shown as a titled contextual menu. Its items only display state: the power
 * button and the knob are handled by the backlight itself, so the Auto toggle is not selectable.
 */
export class BacklightDialog extends ReactiveComponent<BacklightDialogProps> {
    private readonly menu = FSComponent.createRef<Menu>()

    private readonly mode = this.track(
        this.props.isManual.map(isManual => (isManual ? 'Manual' : 'Auto'))
    )
    private readonly isAuto = this.track(this.props.isManual.map(isManual => !isManual))
    private readonly levelLabel = this.track(this.props.level.map(level => `${level}%`))
    private readonly levelFillStyle = this.track(this.props.level.map(level => `width: ${level}%`))

    onAfterRender(): void {
        super.onAfterRender()
        this.live(
            this.props.isOpen.sub(
                isOpen => (isOpen ? this.menu.instance.open() : this.menu.instance.close()),
                true
            )
        )
    }

    render(): VNode {
        return (
            <div id="BacklightDialog" mode={this.mode}>
                <Menu ref={this.menu} title="Backlight">
                    <Menu.Item title="Auto" value={this.isAuto} isBoolean inactive />
                    <Menu.Item title={this.levelLabel} inactive>
                        <div id="BacklightLevelFill" style={this.levelFillStyle} />
                        <svg
                            id="BacklightLevelMask"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                        >
                            <polygon points="0,0 100,0 0,100" />
                        </svg>
                    </Menu.Item>
                </Menu>
            </div>
        )
    }
}
