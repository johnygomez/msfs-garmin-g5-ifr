import {
    ComponentProps,
    Consumer,
    ConsumerSubject,
    DisplayComponent,
    Subscription,
} from '@microsoft/msfs-sdk'

/**
 * Lifecycle owner for a group of subscriptions.
 *
 * Members registered through {@link consume} and {@link track} start paused and are
 * activated by {@link resume}, while {@link live} keeps a subscription running from the
 * moment it is registered. {@link destroy} tears members down in reverse registration
 * order, so a derived subject is always released before the subjects it maps from.
 */
export class SubscriptionCollection {
    private readonly members: Subscription[] = []

    /** Creates a paused {@link ConsumerSubject} for an event-bus topic. */
    consume<T>(consumer: Consumer<T>, initial: T): ConsumerSubject<T> {
        return this.track(ConsumerSubject.create(consumer, initial))
    }

    /** Adopts a subscribable, pausing it until the collection is resumed. */
    track<T extends Subscription>(member: T): T {
        this.members.push(member.pause())
        return member
    }

    /** Adopts a subscription that must keep running for the lifetime of the collection. */
    live<T extends Subscription>(member: T): T {
        this.members.push(member)
        return member
    }

    resume(): void {
        for (const member of this.members) {
            if (member.isPaused) {
                member.resume()
            }
        }
    }

    destroy(): void {
        for (let i = this.members.length - 1; i >= 0; i--) {
            this.members[i].destroy()
        }
    }
}

/**
 * A component whose reactive state is built up front and activated once the DOM exists.
 *
 * State registered through {@link consume}, {@link track} and {@link live} is resumed in
 * `onAfterRender` and destroyed with the component, so subclasses only declare their
 * subjects and render them.
 */
export abstract class ReactiveComponent<P = ComponentProps> extends DisplayComponent<P> {
    private readonly subscriptions = new SubscriptionCollection()

    protected consume<T>(consumer: Consumer<T>, initial: T): ConsumerSubject<T> {
        return this.subscriptions.consume(consumer, initial)
    }

    protected track<T extends Subscription>(member: T): T {
        return this.subscriptions.track(member)
    }

    protected live<T extends Subscription>(member: T): T {
        return this.subscriptions.live(member)
    }

    onAfterRender(): void {
        this.subscriptions.resume()
    }

    destroy(): void {
        this.subscriptions.destroy()
        super.destroy()
    }
}
