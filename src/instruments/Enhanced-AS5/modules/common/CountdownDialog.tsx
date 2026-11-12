import { ComponentProps, FSComponent, Subscribable, VNode } from '@microsoft/msfs-sdk'

import { ReactiveComponent } from './Reactive'

export interface CountdownDialogProps extends ComponentProps {
    id: string
    title: string
    prompt?: string
    hint: string
    countdown: Subscribable<number | null>
}

/** A dialog shown while a countdown runs, hidden when the countdown is `null`. */
export class CountdownDialog extends ReactiveComponent<CountdownDialogProps> {
    private readonly state = this.track(
        this.props.countdown.map(remaining => (remaining === null ? 'Inactive' : 'Active'))
    )
    private readonly remainingLabel = this.track(
        this.props.countdown.map(remaining => remaining?.toString() ?? '')
    )

    render(): VNode {
        return (
            <div id={this.props.id} class="G5Dialog" state={this.state}>
                <span>{this.props.title}</span>
                {this.props.prompt ? (
                    <span class="CountdownDialogPrompt">{this.props.prompt}</span>
                ) : null}
                <span class="CountdownDialogValue">{this.remainingLabel}</span>
                <span class="CountdownDialogHint">{this.props.hint}</span>
            </div>
        )
    }
}
