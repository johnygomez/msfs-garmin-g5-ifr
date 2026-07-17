import { Subject } from '@microsoft/msfs-sdk'

import { ContextualMenuElementData } from './ContextualMenu'

export enum InteractionMode {
    Normal = 0,
    Selecting = 1,
    Menu = 2,
    Search = 3,
}

export interface Selectable {
    isActive: boolean
    onSelection(event: string): boolean
    SendEvent(event: string): boolean
    updateSelection(highlighted: boolean): void
}

export interface SearchFieldElement {
    onInteractionEvent(args: string[]): void
}

export interface OverlayDescriptor {
    readonly kind: string
    onEvent(event: string): void
    onUpdate?(deltaTime: number): void
    onClose?(): void
}

export class NavSystem extends BaseInstrument {
    DecomposeEventFromPrefix!: (args: string[]) => string | undefined
    pagesContainer!: HTMLElement

    readonly independentElements: NavSystemElement[] = []
    readonly pageGroups: NavSystemPageGroup[] = []
    overridePage: NavSystemElementContainer | null = null
    activeOverlay: OverlayDescriptor | null = null

    private selectablesBeforeOverlay: Selectable[] = []
    private interactionModeBeforeOverlay = InteractionMode.Normal
    private interactionModeBeforeMenu: InteractionMode | null = null

    currentPageGroupIndex = 0
    currentInteractionState = InteractionMode.Normal
    cursorIndex = 0
    currentSelectableArray: Selectable[] = []
    currentSearchFieldWaypoint: SearchFieldElement | null = null

    private contextualMenuDisplayBeginIndex = 0
    menuMaxElems = 6

    readonly pageState = Subject.create('')
    readonly contextualMenuState = Subject.create('Inactive')
    readonly menuElementsSub = Subject.create<ContextualMenuElementData[]>([])
    readonly menuCursorIndexSub = Subject.create(0)
    readonly menuDisplayBeginIndexSub = Subject.create(0)

    constructor() {
        super()
    }

    Init() {
        super.Init()
    }

    disconnectedCallback() {
        super.disconnectedCallback()
    }

    onUpdate(_deltaTime: number): void {}

    onEvent(_event: string): void {}

    parseXMLConfig() {
        super.parseXMLConfig()
    }

    computeEvent(event: string) {
        if (!this.isBootProcedureComplete()) {
            this.onEvent(event)
            return
        }

        for (const element of this.independentElements) {
            element.onEvent(event)
        }

        if (this.activeOverlay) {
            this.activeOverlay.onEvent(event)
        }

        const currentPage = this.getCurrentPage()
        if (currentPage) currentPage.onEvent(event)

        switch (this.currentInteractionState) {
            case InteractionMode.Selecting:
                this.handleSelectingEvent(event)
                break
            case InteractionMode.Menu:
                this.handleMenuEvent(event)
                break
            case InteractionMode.Search:
                this.handleSearchEvent(event)
                break
            default:
                this.handleNormalEvent(event)
                break
        }

        this.onEvent(event)
    }

    private handleNormalEvent(event: string) {
        switch (event) {
            case 'MENU_Push':
                this.openDefaultMenu()
                break
            case 'NavigationSmallInc':
                this.getCurrentPageGroup().nextPage()
                break
            case 'NavigationSmallDec':
                this.getCurrentPageGroup().prevPage()
                break
            case 'NavigationLargeInc':
                this.cyclePageGroup(1)
                break
            case 'NavigationLargeDec':
                this.cyclePageGroup(-1)
                break
            case 'NavigationPush':
                this.activateSelection()
                break
        }
    }

    private handleSelectingEvent(event: string) {
        if (this.currentSelectableArray[this.cursorIndex].SendEvent(event)) return

        switch (event) {
            case 'NavigationPush':
                this.SwitchToInteractionState(InteractionMode.Normal)
                break
            case 'NavigationLargeInc':
                this.cursorIndex = (this.cursorIndex + 1) % this.currentSelectableArray.length
                this.skipInactiveSelectables(event, 1)
                break
            case 'NavigationLargeDec':
                this.cursorIndex =
                    this.cursorIndex - 1 < 0
                        ? this.currentSelectableArray.length - 1
                        : this.cursorIndex - 1
                this.skipInactiveSelectables(event, -1)
                break
            case 'MENU_Push':
                this.openDefaultMenu()
                break
        }
    }

    private skipInactiveSelectables(event: string, direction: 1 | -1) {
        const len = this.currentSelectableArray.length
        while (!this.currentSelectableArray[this.cursorIndex].onSelection(event)) {
            this.cursorIndex =
                direction === 1
                    ? (this.cursorIndex + 1) % len
                    : this.cursorIndex - 1 < 0
                      ? len - 1
                      : this.cursorIndex - 1
        }
    }

    private handleMenuEvent(event: string) {
        switch (event) {
            case 'NavigationSmallInc':
                this.moveMenuCursor(1)
                break
            case 'NavigationSmallDec':
                this.moveMenuCursor(-1)
                break
            case 'MENU_Push':
                this.SwitchToInteractionState(InteractionMode.Normal)
                break
            case 'ENT_Push':
                this.activateMenuSelection()
                break
        }
    }

    private moveMenuCursor(direction: 1 | -1) {
        const menuElems = this.menuElementsSub.get()
        if (menuElems.length === 0) return

        let count = 0
        do {
            this.cursorIndex =
                direction === 1
                    ? (this.cursorIndex + 1) % menuElems.length
                    : this.cursorIndex - 1 < 0
                      ? menuElems.length - 1
                      : this.cursorIndex - 1
            count++
        } while (menuElems[this.cursorIndex].isInactive() && count < menuElems.length)

        this.scrollMenuToCursor()
    }

    private activateMenuSelection() {
        const menuElems = this.menuElementsSub.get()
        if (menuElems.length > 0) {
            menuElems[this.cursorIndex].callback()
        }
    }

    private handleSearchEvent(event: string) {
        this.currentSearchFieldWaypoint?.onInteractionEvent([event])
    }

    private openDefaultMenu() {
        const defaultMenu = this.getCurrentPage()?.defaultMenu
        if (defaultMenu != null && defaultMenu.length > 0) {
            this.ShowContextualMenu(defaultMenu)
        }
    }

    private activateSelection() {
        const selectables = this.getCurrentPage()?.element.getDefaultSelectables()
        if (selectables != null && selectables.length > 0) {
            this.ActiveSelection(selectables)
        }
    }

    private cyclePageGroup(direction: 1 | -1) {
        if (this.pageGroups.length <= 1) return

        this.pageGroups[this.currentPageGroupIndex].onExit()
        this.currentPageGroupIndex =
            direction === 1
                ? (this.currentPageGroupIndex + 1) % this.pageGroups.length
                : (this.currentPageGroupIndex + this.pageGroups.length - 1) % this.pageGroups.length
        this.pageGroups[this.currentPageGroupIndex].onEnter()
        const currentPage = this.getCurrentPage()
        if (currentPage) {
            this.pageState.set(currentPage.htmlElemId)
        }
    }

    private scrollMenuToCursor() {
        if (this.cursorIndex < this.contextualMenuDisplayBeginIndex) {
            this.contextualMenuDisplayBeginIndex = this.cursorIndex
        } else if (
            this.cursorIndex >
            this.contextualMenuDisplayBeginIndex + (this.menuMaxElems - 1)
        ) {
            this.contextualMenuDisplayBeginIndex +=
                this.cursorIndex - (this.contextualMenuDisplayBeginIndex + (this.menuMaxElems - 1))
        }
        this.menuCursorIndexSub.set(this.cursorIndex)
        this.menuDisplayBeginIndexSub.set(this.contextualMenuDisplayBeginIndex)
    }

    onInteractionEvent(args: string[]) {
        if (!this.isElectricityAvailable()) {
            console.warn('Electricity Is NOT Available')
            return
        }

        let event = this.DecomposeEventFromPrefix(args)
        if (event) {
            if (event === 'ElementSetAttribute' && args.length >= 4) {
                const element = this.getChildById(args[1])
                if (element) {
                    element.setAttribute(args[2], args[3])
                }
            } else {
                this.computeEvent(event)
            }
        } else if (args[0].startsWith('NavSystem_')) {
            event = args[0].slice('NavSystem_'.length)
            this.computeEvent(event)
        }
    }

    reboot() {
        super.reboot()
    }

    onShutDown() {
        super.onShutDown()
        for (const group of this.pageGroups) {
            for (const page of group.pages) {
                page.onShutDown()
            }
        }
        for (const element of this.independentElements) {
            element.onShutDown()
        }
    }

    onPowerOn() {
        super.onPowerOn()
        for (const group of this.pageGroups) {
            for (const page of group.pages) {
                page.onPowerOn()
            }
        }
        for (const element of this.independentElements) {
            element.onPowerOn()
        }
    }

    Update() {
        super.Update()

        if (this.activeOverlay) {
            this.activeOverlay.onUpdate?.(this.deltaTime)
        }

        this.updateGroups()

        switch (this.currentInteractionState) {
            case InteractionMode.Normal:
                for (const selectable of this.currentSelectableArray) {
                    selectable.updateSelection(false)
                }
                break
            case InteractionMode.Selecting:
                for (let i = 0; i < this.currentSelectableArray.length; i++) {
                    this.currentSelectableArray[i].updateSelection(
                        i === this.cursorIndex ? this.blinkGetState(800, 400) : false
                    )
                }
                break
        }

        this.onUpdate(this.deltaTime)
    }

    private updateGroups() {
        for (const element of this.independentElements) {
            element.onUpdate(this.deltaTime)
        }
        if (!this.overridePage) {
            this.getCurrentPageGroup()?.onUpdate(this.deltaTime)
        } else {
            this.overridePage.onUpdate(this.deltaTime)
        }
    }

    private InteractionStateOut() {
        switch (this.currentInteractionState) {
            case InteractionMode.Selecting:
                for (const selectable of this.currentSelectableArray) {
                    selectable.updateSelection(false)
                }
                break
            case InteractionMode.Menu:
                this.contextualMenuState.set('Inactive')
                this.menuElementsSub.set([])
                break
        }
    }

    private InteractionStateIn() {
        switch (this.currentInteractionState) {
            case InteractionMode.Normal:
                if (this.menuElementsSub.get().length > 0) {
                    this.menuElementsSub.set([])
                    if (this.activeOverlay && this.interactionModeBeforeMenu != null) {
                        this.SwitchToInteractionState(this.interactionModeBeforeMenu)
                        this.interactionModeBeforeMenu = null
                    }
                }
                break
            case InteractionMode.Selecting:
                this.cursorIndex = 0
                break
            case InteractionMode.Menu:
                this.contextualMenuState.set('Active')
                this.contextualMenuDisplayBeginIndex = 0
                this.cursorIndex = 0
                this.menuCursorIndexSub.set(0)
                this.menuDisplayBeginIndexSub.set(0)
                const menuElems = this.menuElementsSub.get()
                if (menuElems.length > 0 && menuElems[0].isInactive()) {
                    this.computeEvent('NavigationSmallInc')
                }
                break
        }
    }

    SwitchToInteractionState(newState: InteractionMode) {
        this.InteractionStateOut()
        this.currentInteractionState = newState
        this.InteractionStateIn()
    }

    ShowContextualMenu(menuData: ContextualMenuElementData[]) {
        if (this.activeOverlay) {
            this.interactionModeBeforeMenu = this.currentInteractionState
        }
        this.menuElementsSub.set(menuData)
        this.menuCursorIndexSub.set(0)
        this.menuDisplayBeginIndexSub.set(0)
        this.SwitchToInteractionState(InteractionMode.Menu)
    }

    ActiveSelection(selectables: Selectable[]) {
        this.currentSelectableArray = selectables
        if (selectables.length > 0) {
            this.SwitchToInteractionState(InteractionMode.Selecting)
            const begin = this.cursorIndex
            while (!this.currentSelectableArray[this.cursorIndex].isActive) {
                this.cursorIndex = (this.cursorIndex + 1) % this.currentSelectableArray.length
                if (this.cursorIndex === begin) {
                    this.SwitchToInteractionState(InteractionMode.Normal)
                    return
                }
            }
        }
    }

    setOverridePage(page: NavSystemElementContainer) {
        if (this.overridePage) {
            this.overridePage.onExit()
        }
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(InteractionMode.Normal)
        }
        this.overridePage = page
        this.overridePage.onEnter()
        this.pageState.set(this.overridePage.htmlElemId)
    }

    closeOverridePage() {
        if (this.overridePage) {
            this.overridePage.onExit()
        }
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(InteractionMode.Normal)
        }
        this.overridePage = null
        const currentPage = this.getCurrentPage()
        if (currentPage) {
            this.pageState.set(currentPage.htmlElemId)
        }
    }

    SwitchToPageName(menu: string, page: string) {
        if (!this.pageGroups.length) return

        this.closeOverlay()
        if (this.overridePage) {
            this.closeOverridePage()
        }

        this.pageGroups[this.currentPageGroupIndex].onExit()
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(InteractionMode.Normal)
        }

        for (let i = 0; i < this.pageGroups.length; i++) {
            if (this.pageGroups[i].name === menu) {
                this.currentPageGroupIndex = i
            }
        }
        this.pageGroups[this.currentPageGroupIndex].goToPage(page, true)
    }

    SwitchToMenuName(name: string) {
        if (!this.pageGroups.length) return

        this.pageGroups[this.currentPageGroupIndex].onExit()
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(InteractionMode.Normal)
        }

        for (let i = 0; i < this.pageGroups.length; i++) {
            if (this.pageGroups[i].name === name) {
                this.currentPageGroupIndex = i
            }
        }
        this.pageGroups[this.currentPageGroupIndex].onEnter()
    }

    GetInteractionState() {
        return this.currentInteractionState
    }

    blinkGetState(blinkPeriod: number, duration: number) {
        return Math.round(new Date().getTime() / duration) % (blinkPeriod / duration) === 0
    }

    IsEditingSearchField() {
        return this.currentInteractionState === InteractionMode.Search
    }

    OnSearchFieldEndEditing() {
        this.SwitchToInteractionState(InteractionMode.Normal)
    }

    addIndependentElementContainer(element: NavSystemElement) {
        element.setGPS(this)
        this.independentElements.push(element)
    }

    registerOverlayElement(element: NavSystemElement) {
        element.setGPS(this)
    }

    getCurrentPageGroup() {
        return this.pageGroups[this.currentPageGroupIndex]
    }

    getCurrentPage() {
        if (!this.overridePage) {
            return this.getCurrentPageGroup()?.getCurrentPage()
        }
        return this.overridePage
    }

    leaveEventPage() {
        this.getCurrentPageGroup().onEnter()
        const currentPage = this.getCurrentPage()
        if (currentPage) {
            this.pageState.set(currentPage.htmlElemId)
        }
    }

    closeOverlay() {
        if (this.activeOverlay) {
            this.activeOverlay.onClose?.()
        }
        this.activeOverlay = null
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(InteractionMode.Normal)
        }
        if (this.interactionModeBeforeOverlay >= 0) {
            this.ActiveSelection(this.selectablesBeforeOverlay)
            this.SwitchToInteractionState(this.interactionModeBeforeOverlay)
            this.interactionModeBeforeOverlay = InteractionMode.Normal
        }
    }

    openOverlay(overlay: OverlayDescriptor) {
        if (this.activeOverlay) {
            this.closeOverlay()
        }
        this.interactionModeBeforeOverlay = InteractionMode.Normal
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(InteractionMode.Normal)
        } else {
            this.interactionModeBeforeOverlay = this.currentInteractionState
            this.selectablesBeforeOverlay = this.currentSelectableArray
        }
        this.activeOverlay = overlay
    }

    getElementOfType<T extends object>(c: new (...args: never[]) => T): T | null {
        for (const element of this.independentElements) {
            const elem = element.getElementOfType(c)
            if (elem) return elem
        }
        const currentPage = this.getCurrentPage()?.element
        const curr = currentPage?.getElementOfType(c)
        if (curr) return curr
        for (const group of this.pageGroups) {
            for (const page of group.pages) {
                const elem = page.getElementOfType(c)
                if (elem) return elem
            }
        }
        return null
    }

    onSoundEnd(eventId: Name_Z) {
        for (const group of this.pageGroups) {
            for (const page of group.pages) {
                page.onSoundEnd(eventId)
            }
        }
        for (const element of this.independentElements) {
            element.onSoundEnd(eventId)
        }
    }
}

export class NavSystemPageGroup {
    private updatingWithBudget = false
    name: string
    gps: NavSystem
    pages: NavSystemElementContainer[]
    pageIndex = 0

    constructor(name: string, gps: NavSystem, pages: NavSystemElementContainer[]) {
        this.name = name
        this.gps = gps
        this.pages = pages
        for (const page of pages) {
            page.pageGroup = this
            page.setGPS(this.gps)
        }
    }

    onEnter() {
        this.pages[this.pageIndex].onEnter()
    }

    onUpdate(deltaTime: number) {
        if (!this.updatingWithBudget) this.pages[this.pageIndex].onUpdate(deltaTime)
    }

    onExit() {
        this.pages[this.pageIndex].onExit()
    }

    getCurrentPage() {
        return this.pages[this.pageIndex]
    }

    onUpdateSpecificItem(deltaTime: number, itemId: number) {
        if (itemId === 0) {
            this.updatingWithBudget = true
            this.onUpdate(deltaTime)
            this.updatingWithBudget = false
        }
        return this.pages[this.pageIndex].onUpdateSpecificItem(deltaTime, itemId)
    }

    nextPage() {
        if (this.pages.length > 1) {
            this.pages[this.pageIndex].onExit()
            this.pageIndex = (this.pageIndex + 1) % this.pages.length
            this.pages[this.pageIndex].onEnter()
            this.gps.pageState.set(this.pages[this.pageIndex].htmlElemId)
        }
    }

    prevPage() {
        if (this.pages.length > 1) {
            this.pages[this.pageIndex].onExit()
            this.pageIndex = (this.pageIndex + this.pages.length - 1) % this.pages.length
            this.pages[this.pageIndex].onEnter()
            this.gps.pageState.set(this.pages[this.pageIndex].htmlElemId)
        }
    }

    goToPage(name: string, skipExit = false) {
        if (!skipExit) {
            this.pages[this.pageIndex].onExit()
        }
        for (let i = 0; i < this.pages.length; i++) {
            if (this.pages[i].name === name) {
                this.pageIndex = i
            }
        }
        this.onEnter()
        this.gps.pageState.set(this.pages[this.pageIndex].htmlElemId)
    }
}

export class NavSystemElementContainer {
    defaultMenu: ContextualMenuElementData[] = []

    gps!: NavSystem
    pageGroup!: NavSystemPageGroup

    name: string
    htmlElemId: string
    isInitialized = false
    private updatingWithBudget = false
    element: NavSystemElement

    constructor(name: string, htmlElemId: string, element: NavSystemElement) {
        this.name = name
        this.htmlElemId = htmlElemId
        this.element = element
        if (element) {
            element.container = this
        }
    }

    init(_root?: HTMLElement) {}

    onEnter() {
        if (!this.checkInit()) return
        this.element?.onEnter()
    }

    onUpdate(deltaTime: number) {
        if (this.updatingWithBudget) return
        if (!this.checkInit()) return
        this.element?.onUpdate(deltaTime)
    }

    onExit() {
        this.element?.onExit()
    }

    onEvent(event: string) {
        this.element?.onEvent(event)
    }

    getDefaultMenu() {
        return this.defaultMenu
    }

    checkInit(): boolean {
        if (this.element) {
            if (this.element.isReady()) {
                if (!this.element.isInitialized) {
                    this.element.container = this
                    this.element.setGPS(this.gps)
                    this.element.init(this.gps.getChildById(this.htmlElemId))
                    this.element.isInitialized = true
                }
            } else {
                return false
            }
        }
        if (!this.isInitialized) {
            this.init()
            this.isInitialized = true
        }
        return this.isInitialized
    }

    onUpdateSpecificItem(deltaTime: number, itemId: number) {
        if (!this.checkInit()) return false
        if (itemId === 0) {
            this.updatingWithBudget = true
            this.onUpdate(deltaTime)
            this.updatingWithBudget = false
        }
        return this.element?.onUpdateSpecificItem(deltaTime, itemId) ?? false
    }

    onSoundEnd(eventId: Name_Z) {
        this.element?.onSoundEnd(eventId)
    }

    onShutDown() {
        this.element?.onShutDown()
    }

    onPowerOn() {
        this.element?.onPowerOn()
    }

    setGPS(gps: NavSystem) {
        this.gps = gps
        this.element?.setGPS(gps)
    }

    getElementOfType<T extends object>(c: new (...args: never[]) => T): T | null {
        return this.element?.getElementOfType(c) ?? null
    }
}

export class NavSystemPage extends NavSystemElementContainer {
    constructor(name?: string, htmlElemId?: string, element?: NavSystemElement) {
        super(name ?? '', htmlElemId ?? '', element!)
    }
}

export class NavSystemElement extends Updatable {
    isInitialized = false
    defaultSelectables: Selectable[] = []
    private alwaysUpdateFlag = false
    gps!: NavSystem
    container!: NavSystemElementContainer

    set alwaysUpdate(val: boolean) {
        this.alwaysUpdateFlag = val
        if (this.gps) this.gps.alwaysUpdate(this, val)
    }

    constructor() {
        super()
    }

    init(_root?: HTMLElement): void {}
    onEnter(): void {}
    onExit(): void {}
    onEvent(_event: string): void {}
    onSoundEnd(_eventId: Name_Z): void {}
    onShutDown(): void {}
    onPowerOn(): void {}
    redraw(): void {}

    isReady(): boolean {
        return true
    }

    onUpdateSpecificItem(_deltaTime: number, _itemId: number): boolean {
        if (_itemId === 0) this.onUpdate(_deltaTime)
        return false
    }

    onUpdate(_deltaTime?: number): void {}

    getDefaultSelectables() {
        return this.defaultSelectables
    }

    setGPS(gps: NavSystem) {
        if (this.gps && !gps && this.alwaysUpdateFlag) {
            this.gps.alwaysUpdate(this, false)
        }
        this.gps = gps
        if (this.gps) {
            this.gps.alwaysUpdate(this, this.alwaysUpdateFlag)
        }
    }

    getElementOfType<T extends object>(c: new (...args: never[]) => T): T | null {
        if (this instanceof c) {
            return this as unknown as T
        }
        return null
    }
}

export class NavSystemElementGroup extends NavSystemElement {
    private updatingWithBudget = false
    elements: NavSystemElement[]

    constructor(elements: NavSystemElement[]) {
        super()
        this.elements = elements
    }

    init(root: HTMLElement) {
        this.defaultSelectables = []
        for (const element of this.elements) {
            if (!element.isInitialized) {
                element.container = this.container
                element.setGPS(this.gps)
                element.init(root)
                element.isInitialized = true
                this.defaultSelectables = this.defaultSelectables.concat(
                    element.getDefaultSelectables()
                )
            }
        }
    }

    onEnter() {
        for (const element of this.elements) {
            element.onEnter()
        }
    }

    onUpdate(deltaTime: number) {
        if (this.updatingWithBudget) return
        for (const element of this.elements) {
            element.onUpdate(deltaTime)
        }
    }

    onExit() {
        for (const element of this.elements) {
            element.onExit()
        }
    }

    onEvent(event: string) {
        for (const element of this.elements) {
            element.onEvent(event)
        }
    }

    isReady() {
        return this.elements.every(e => e.isReady())
    }

    onUpdateSpecificItem(deltaTime: number, itemId: number) {
        if (itemId === 0) {
            this.updatingWithBudget = true
            this.onUpdate(deltaTime)
            this.updatingWithBudget = false
        }
        if (itemId < this.elements.length) {
            this.elements[itemId].onUpdate(deltaTime)
            if (itemId + 1 < this.elements.length) return true
        }
        return false
    }

    onSoundEnd(eventId: Name_Z) {
        for (const element of this.elements) {
            element.onSoundEnd(eventId)
        }
    }

    onShutDown() {
        for (const element of this.elements) {
            element.onShutDown()
        }
    }

    onPowerOn() {
        for (const element of this.elements) {
            element.onPowerOn()
        }
    }

    getDefaultSelectables() {
        this.defaultSelectables = []
        for (const element of this.elements) {
            this.defaultSelectables = this.defaultSelectables.concat(
                element.getDefaultSelectables()
            )
        }
        return this.defaultSelectables
    }

    setGPS(gps: NavSystem) {
        this.gps = gps
        for (const element of this.elements) {
            element.setGPS(gps)
        }
    }

    getElementOfType<T extends object>(c: new (...args: never[]) => T): T | null {
        for (const element of this.elements) {
            const result = element.getElementOfType(c)
            if (result) return result
        }
        return null
    }

    addElement(element: NavSystemElement) {
        this.elements.push(element)
    }
}
