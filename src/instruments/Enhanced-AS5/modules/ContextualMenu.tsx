import {
    DisplayComponent,
    FSComponent,
    VNode,
    ComponentProps,
    Subject,
    Subscribable,
    Subscription,
} from '@microsoft/msfs-sdk'

/**
 * Descriptor for a single menu element.
 *
 * Replaces the old {@link ContextualMenuElement} / {@link ContextualMenuElementImage} /
 * {@link ContextualMenuElementValue} class hierarchy. All dynamic values flow
 * through reactive Subjects rather than per-frame diffAndSet* calls.
 */
export interface ContextualMenuElementData {
    /** Display name of the element. */
    name: string
    /** Called when ENT is pressed on this element. */
    callback: () => boolean | void
    /** Return true when the element should be rendered as inactive (greyed out, non-selectable). */
    isInactive: () => boolean
    /** If set the element renders an image below the name. */
    imageSrc?: string
    /** If set the element renders a reactive value below the name. */
    value?: Subscribable<string>
}

/** Props for {@link ContextualMenuComponent}. */
export interface ContextualMenuComponentProps extends ComponentProps {
    /** Current menu elements array (can change when switching menus). */
    elements: Subject<ContextualMenuElementData[]>
    /** Index of the currently selected element. */
    cursorIndex: Subject<number>
    /** Scroll offset — first visible element index. */
    displayBeginIndex: Subject<number>
    /** Maximum number of element slots rendered. */
    maxVisibleElements: number
    /** Output: slider visibility state, set to 'Active' or 'Inactive' by the component. */
    sliderState: Subject<string>
    /** Output: slider-cursor CSS style string, set by the component. */
    sliderCursorStyle: Subject<string>
}

/**
 * Declarative contextual menu component.
 *
 * Renders a fixed number of element slots and reactively updates their content,
 * display, and selection state whenever the input Subjects change. The slider
 * state is computed and pushed to output Subjects that the NavSystem already
 * subscribes to (so the HTML-template slider elements are updated).
 *
 * Replaces the imperative {@linkcode ContextualMenu} / {@linkcode ContextualMenu.Update}
 * pattern which used `diffAndSetHTML` / `diffAndSetAttribute` / `diffAndSetStyle`
 * on every frame.
 */
export class ContextualMenuComponent extends DisplayComponent<ContextualMenuComponentProps> {
    /** Refs for each slot div. Index maps to `displayBeginIndex + slotIndex`. */
    private readonly slotRefs: ReturnType<typeof FSComponent.createRef<HTMLDivElement>>[] = []

    /** Top-level subscriptions (element array, cursor index, display begin index). */
    private readonly subs: Subscription[] = []

    /** Per-element subscriptions to their `value` Subjects. Rebuilt when elements change. */
    private valueSubs: Subscription[] = []

    // -- constructor ----------------------------------------------------------

    constructor(props: ContextualMenuComponentProps) {
        super(props)
        // Create one ref per visible slot
        for (let i = 0; i < props.maxVisibleElements; i++) {
            this.slotRefs.push(FSComponent.createRef<HTMLDivElement>())
        }
    }

    // -- lifecycle ------------------------------------------------------------

    /** @inheritdoc */
    onAfterRender(): void {
        // When the elements array changes: rebuild slot content and state
        this.subs.push(this.props.elements.sub(() => this.onElementsChanged(), true))
        // When the cursor moves: update per-slot state attribute only
        this.subs.push(this.props.cursorIndex.sub(() => this.updateSlotStates()))
        // When the scroll position changes: update visibility and slider
        this.subs.push(
            this.props.displayBeginIndex.sub(() => {
                this.updateSlotVisibility()
                this.updateSlider()
            })
        )
    }

    /** @inheritdoc */
    destroy(): void {
        this.valueSubs.forEach(s => s.destroy())
        this.subs.forEach(s => s.destroy())
        super.destroy()
    }

    // -- reactive update helpers ----------------------------------------------

    /** Full rebuild: elements array changed. */
    private onElementsChanged(): void {
        // Tear down old per-value subscriptions
        this.valueSubs.forEach(s => s.destroy())
        this.valueSubs = []

        const elements = this.props.elements.get()
        const beginIdx = this.props.displayBeginIndex.get()
        const cursor = this.props.cursorIndex.get()

        for (let slotIdx = 0; slotIdx < this.props.maxVisibleElements; slotIdx++) {
            const elemIdx = beginIdx + slotIdx
            const slotEl = this.slotRefs[slotIdx].getOrDefault()
            if (!slotEl) continue

            if (elemIdx >= elements.length) {
                slotEl.style.display = 'none'
                continue
            }

            slotEl.style.display = 'block'
            const elem = elements[elemIdx]

            // Apply state
            this.applySlotState(slotEl, elem, elemIdx === cursor)

            // Apply content
            this.applySlotContent(slotEl, elem)
        }

        this.updateSlider()
    }

    /** Cursor-only update: just refresh state attributes. */
    private updateSlotStates(): void {
        const elements = this.props.elements.get()
        const beginIdx = this.props.displayBeginIndex.get()
        const cursor = this.props.cursorIndex.get()

        for (let slotIdx = 0; slotIdx < this.props.maxVisibleElements; slotIdx++) {
            const elemIdx = beginIdx + slotIdx
            if (elemIdx >= elements.length) continue

            const slotEl = this.slotRefs[slotIdx].getOrDefault()
            if (!slotEl) continue

            const elem = elements[elemIdx]
            this.applySlotState(slotEl, elem, elemIdx === cursor)
        }
    }

    /** Scroll-only update: just refresh display and slider. */
    private updateSlotVisibility(): void {
        const elements = this.props.elements.get()
        const beginIdx = this.props.displayBeginIndex.get()
        const cursor = this.props.cursorIndex.get()

        for (let slotIdx = 0; slotIdx < this.props.maxVisibleElements; slotIdx++) {
            const elemIdx = beginIdx + slotIdx
            const slotEl = this.slotRefs[slotIdx].getOrDefault()
            if (!slotEl) continue

            if (elemIdx >= elements.length) {
                slotEl.style.display = 'none'
            } else {
                slotEl.style.display = 'block'
                // State may have changed because the element mapped to this
                // slot is different now
                const elem = elements[elemIdx]
                this.applySlotState(slotEl, elem, elemIdx === cursor)
                this.applySlotContent(slotEl, elem)
            }
        }
    }

    /** Set the `state` attribute on a single slot element. */
    private applySlotState(
        el: HTMLDivElement,
        elem: ContextualMenuElementData,
        isSelected: boolean
    ): void {
        if (elem.isInactive()) {
            el.setAttribute('state', 'Inactive')
        } else if (isSelected) {
            el.setAttribute('state', 'Selected')
        } else {
            el.setAttribute('state', 'Unselected')
        }
    }

    /** Set the inner HTML of a single slot element based on element type. */
    private applySlotContent(el: HTMLDivElement, elem: ContextualMenuElementData): void {
        if (elem.imageSrc) {
            // Image element: name + image
            el.innerHTML =
                `<div class="ContextualMenuElementName">${elem.name}</div>` +
                `<div class="ContextualMenuElementImage"><img src="${elem.imageSrc}"></div>`
        } else if (elem.value) {
            // Value element: name + reactive value
            el.innerHTML =
                `<div class="ContextualMenuElementName">${elem.name}</div>` +
                `<div class="ContextualMenuElementValue">${elem.value.get()}</div>`

            // Subscribe to value changes for the life of this element set
            const valueDiv = el.querySelector('.ContextualMenuElementValue')
            if (valueDiv) {
                this.valueSubs.push(
                    elem.value.sub(v => {
                        valueDiv.textContent = v
                    })
                )
            }
        } else {
            // Plain text element
            el.textContent = elem.name
        }
    }

    /** Compute slider state and cursor style, push to output Subjects. */
    private updateSlider(): void {
        const total = this.props.elements.get().length
        const max = this.props.maxVisibleElements
        const beginIdx = this.props.displayBeginIndex.get()

        if (total <= max) {
            this.props.sliderState.set('Inactive')
            this.props.sliderCursorStyle.set('')
            return
        }

        const cursorHeight = (max * 100) / total
        const pct = beginIdx / (total - max)
        const cursorTop = Math.min(pct, 1.0) * (100 - cursorHeight)

        this.props.sliderState.set('Active')
        this.props.sliderCursorStyle.set('height:' + cursorHeight + '%; top:' + cursorTop + '%')
    }

    // -- render ---------------------------------------------------------------

    /** @inheritdoc */
    render(): VNode {
        // Render fixed slots inside #ContextualMenuElements.
        // The slider is NOT rendered here — it lives in the HTML template and
        // is updated via the sliderState / sliderCursorStyle output Subjects
        // that NavSystem already subscribes to.
        return (
            <>
                {this.slotRefs.map(ref => (
                    <div ref={ref} class="ContextualMenuElement" style="display:none" />
                ))}
            </>
        )
    }
}
