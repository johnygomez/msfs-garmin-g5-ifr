import { Subject } from '@microsoft/msfs-sdk'

import { ContextualMenuElementData } from './ContextualMenu'

export class NavSystem extends BaseInstrument {
    DecomposeEventFromPrefix: any
    pagesContainer: HTMLElement

    IndependentsElements: any[]
    pageGroups: any[]
    overridePage: any
    popUpElement: any
    popUpCloseCallback: any
    selectablesBeforePopup: any[]
    interactionStateBeforePopup: number
    interactionStateBeforeMenu: number
    currentPageGroupIndex: number
    currentInteractionState: number
    cursorIndex: number
    currentSelectableArray: any[]
    currentSearchFieldWaypoint: any
    contextualMenuDisplayBeginIndex: number
    menuMaxElems: number
    contextualMenu: any
    menuSlider: any
    menuSliderCursor: any

    readonly pageState = Subject.create('')
    readonly contextualMenuState = Subject.create('Inactive')
    readonly sliderState = Subject.create('Inactive')
    readonly sliderCursorStyle = Subject.create('')
    readonly menuElementsSub = Subject.create<ContextualMenuElementData[]>([])
    readonly menuCursorIndexSub = Subject.create(0)
    readonly menuDisplayBeginIndexSub = Subject.create(0)

    constructor() {
        super()
        this.IndependentsElements = []
        this.pageGroups = []
        this.overridePage = null
        this.popUpElement = null
        this.popUpCloseCallback = null
        this.selectablesBeforePopup = []
        this.interactionStateBeforePopup = -1
        this.interactionStateBeforeMenu = -1
        this.currentPageGroupIndex = 0
        this.currentInteractionState = 0
        this.cursorIndex = 0
        this.currentSelectableArray = []
        this.currentSearchFieldWaypoint = null
        this.contextualMenuDisplayBeginIndex = 0
        this.menuMaxElems = 6
    }

    Init() {
        super.Init()
    }

    disconnectedCallback() {
        super.disconnectedCallback()
    }

    connectedCallback() {
        super.connectedCallback()
        this.contextualMenu = this.getChildById('ContextualMenu')
        this.menuSlider = this.getChildById('SliderMenu')
        this.menuSliderCursor = this.getChildById('SliderMenuCursor')

        this.pageState.sub(state => {
            if (!this.pagesContainer) {
                this.pagesContainer = this.getChildById('PageContainer')
            }
            if (this.pagesContainer) {
                this.pagesContainer.setAttribute('state', state)
            }
        }, true)
        this.contextualMenuState.sub(state => {
            if (this.contextualMenu) this.contextualMenu.setAttribute('state', state)
        }, true)
        this.sliderState.sub(state => {
            if (this.menuSlider) this.menuSlider.setAttribute('state', state)
        }, true)
        this.sliderCursorStyle.sub(style => {
            if (this.menuSliderCursor) this.menuSliderCursor.setAttribute('style', style)
        }, true)
    }

    onUpdate(_deltaTime: number): void {}

    onEvent(_event: string): void {}

    parseXMLConfig() {
        super.parseXMLConfig()
    }

    computeEvent(_event: string) {
        if (!this.isBootProcedureComplete()) {
            this.onEvent(_event)
            return
        }

        for (let i = 0; i < this.IndependentsElements.length; i++) {
            this.IndependentsElements[i].onEvent(_event)
        }

        if (this.popUpElement) {
            this.popUpElement.onEvent(_event)
        }

        const currentPage = this.getCurrentPage()
        if (currentPage) currentPage.onEvent(_event)

        switch (this.currentInteractionState) {
            case 1:
                if (this.currentSelectableArray[this.cursorIndex].SendEvent(_event)) {
                    break
                }
                if (_event === 'NavigationPush') {
                    this.SwitchToInteractionState(0)
                }
                if (_event === 'NavigationLargeInc') {
                    this.cursorIndex = (this.cursorIndex + 1) % this.currentSelectableArray.length
                    while (!this.currentSelectableArray[this.cursorIndex].onSelection(_event)) {
                        this.cursorIndex =
                            (this.cursorIndex + 1) % this.currentSelectableArray.length
                    }
                }
                if (_event === 'NavigationLargeDec') {
                    this.cursorIndex =
                        this.cursorIndex - 1 < 0
                            ? this.currentSelectableArray.length - 1
                            : this.cursorIndex - 1
                    while (!this.currentSelectableArray[this.cursorIndex].onSelection(_event)) {
                        this.cursorIndex =
                            this.cursorIndex - 1 < 0
                                ? this.currentSelectableArray.length - 1
                                : this.cursorIndex - 1
                    }
                }
                if (_event === 'MENU_Push') {
                    const defaultMenu = this.popUpElement
                        ? this.popUpElement.getDefaultMenu()
                        : this.getCurrentPage().defaultMenu
                    if (defaultMenu != null) {
                        this.ShowContextualMenu(defaultMenu)
                    }
                }
                break
            case 2:
                if (_event === 'NavigationSmallInc') {
                    const menuElems = this.menuElementsSub.get()
                    if (menuElems.length === 0) break
                    let count = 0
                    do {
                        this.cursorIndex = (this.cursorIndex + 1) % menuElems.length
                        count++
                    } while (menuElems[this.cursorIndex].isInactive() && count < menuElems.length)
                    this.scrollMenuToCursor()
                }
                if (_event === 'NavigationSmallDec') {
                    const menuElems = this.menuElementsSub.get()
                    if (menuElems.length === 0) break
                    let count = 0
                    do {
                        this.cursorIndex =
                            this.cursorIndex - 1 < 0 ? menuElems.length - 1 : this.cursorIndex - 1
                        count++
                    } while (menuElems[this.cursorIndex].isInactive() && count < menuElems.length)
                    this.scrollMenuToCursor()
                }
                if (_event === 'MENU_Push') {
                    this.SwitchToInteractionState(0)
                }
                if (_event === 'ENT_Push') {
                    const menuElems = this.menuElementsSub.get()
                    if (menuElems.length > 0) {
                        menuElems[this.cursorIndex].callback()
                    }
                }
                break
            case 3:
                this.currentSearchFieldWaypoint.onInteractionEvent([_event])
                break
            case 0:
                if (_event === 'MENU_Push') {
                    const defaultMenu = this.popUpElement
                        ? this.popUpElement.getDefaultMenu()
                        : this.getCurrentPage().defaultMenu
                    if (defaultMenu != null) {
                        this.ShowContextualMenu(defaultMenu)
                    }
                }
                if (_event === 'NavigationSmallInc') {
                    this.getCurrentPageGroup().nextPage()
                }
                if (_event === 'NavigationSmallDec') {
                    this.getCurrentPageGroup().prevPage()
                }
                if (_event === 'NavigationLargeInc') {
                    if (this.pageGroups.length > 1) {
                        this.pageGroups[this.currentPageGroupIndex].onExit()
                        this.currentPageGroupIndex =
                            (this.currentPageGroupIndex + 1) % this.pageGroups.length
                        this.pageGroups[this.currentPageGroupIndex].onEnter()
                    }
                }
                if (_event === 'NavigationLargeDec') {
                    if (this.pageGroups.length > 1) {
                        this.pageGroups[this.currentPageGroupIndex].onExit()
                        this.currentPageGroupIndex =
                            (this.currentPageGroupIndex + this.pageGroups.length - 1) %
                            this.pageGroups.length
                        this.pageGroups[this.currentPageGroupIndex].onEnter()
                    }
                }
                if (_event === 'NavigationPush') {
                    const selectables = this.popUpElement
                        ? this.popUpElement.element.getDefaultSelectables()
                        : this.getCurrentPage().element.getDefaultSelectables()
                    if (selectables != null && selectables.length > 0) {
                        this.ActiveSelection(selectables)
                    }
                }
                break
        }

        this.onEvent(_event)
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

    onInteractionEvent(_args: string[]) {
        if (!this.isElectricityAvailable()) {
            console.warn('Electricity Is NOT Available')
            return
        }

        let event = this.DecomposeEventFromPrefix(_args)
        if (event) {
            if (event === 'ElementSetAttribute' && _args.length >= 4) {
                const element = this.getChildById(_args[1])
                if (element) {
                    element.setAttribute(_args[2], _args[3])
                }
            } else {
                this.computeEvent(event)
            }
        } else if (_args[0].startsWith('NavSystem_')) {
            event = _args[0].slice('NavSystem_'.length)
            this.computeEvent(event)
        }
    }

    reboot() {
        super.reboot()
    }

    onShutDown() {
        super.onShutDown()
        for (let i = 0; i < this.pageGroups.length; i++) {
            for (let j = 0; j < this.pageGroups[i].pages.length; j++) {
                this.pageGroups[i].pages[j].onShutDown()
            }
        }
        for (let i = 0; i < this.IndependentsElements.length; i++) {
            this.IndependentsElements[i].onShutDown()
        }
    }

    onPowerOn() {
        super.onPowerOn()
        for (let i = 0; i < this.pageGroups.length; i++) {
            for (let j = 0; j < this.pageGroups[i].pages.length; j++) {
                this.pageGroups[i].pages[j].onPowerOn()
            }
        }
        for (let i = 0; i < this.IndependentsElements.length; i++) {
            this.IndependentsElements[i].onPowerOn()
        }
    }

    Update() {
        super.Update()

        if (this.popUpElement) {
            this.popUpElement.onUpdate(this.deltaTime)
        }

        if (!this.pagesContainer) {
            this.pagesContainer = this.getChildById('PageContainer')
        }
        if (this.pagesContainer) {
            this.pageState.set(this.getCurrentPage().htmlElemId)
        }

        this.updateGroups()

        switch (this.currentInteractionState) {
            case 0:
                for (let i = 0; i < this.currentSelectableArray.length; i++) {
                    this.currentSelectableArray[i].updateSelection(false)
                }
                break
            case 1:
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
        for (let i = 0; i < this.IndependentsElements.length; i++) {
            this.IndependentsElements[i].onUpdate(this.deltaTime)
        }
        if (!this.overridePage) {
            const currentGroup = this.getCurrentPageGroup()
            if (currentGroup) currentGroup.onUpdate(this.deltaTime)
        } else {
            this.overridePage.onUpdate(this.deltaTime)
        }
    }

    InteractionStateOut() {
        switch (this.currentInteractionState) {
            case 0:
                break
            case 1:
                for (let i = 0; i < this.currentSelectableArray.length; i++) {
                    this.currentSelectableArray[i].updateSelection(false)
                }
                break
            case 2:
                this.contextualMenuState.set('Inactive')
                this.menuElementsSub.set([])
                break
        }
    }

    InteractionStateIn() {
        switch (this.currentInteractionState) {
            case 0:
                if (this.menuElementsSub.get().length > 0) {
                    this.menuElementsSub.set([])
                    if (this.popUpElement && this.interactionStateBeforeMenu > 0) {
                        this.SwitchToInteractionState(this.interactionStateBeforeMenu)
                        this.interactionStateBeforeMenu = -1
                    }
                }
                break
            case 1:
                this.cursorIndex = 0
                break
            case 2:
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

    SwitchToInteractionState(_newState: number) {
        this.InteractionStateOut()
        this.currentInteractionState = _newState
        this.InteractionStateIn()
    }

    ShowContextualMenu(_menuData: ContextualMenuElementData[]) {
        if (this.popUpElement) {
            this.interactionStateBeforeMenu = this.GetInteractionState()
        }
        this.menuElementsSub.set(_menuData)
        this.menuCursorIndexSub.set(0)
        this.menuDisplayBeginIndexSub.set(0)
        this.SwitchToInteractionState(2)
    }

    ActiveSelection(_selectables: any[]) {
        this.currentSelectableArray = _selectables
        if (_selectables.length > 0) {
            this.SwitchToInteractionState(1)
            const begin = this.cursorIndex
            while (!this.currentSelectableArray[this.cursorIndex].isActive) {
                this.cursorIndex = (this.cursorIndex + 1) % this.currentSelectableArray.length
                if (this.cursorIndex === begin) {
                    this.SwitchToInteractionState(0)
                    return
                }
            }
        }
    }

    setOverridePage(_page: any) {
        if (this.overridePage) {
            this.overridePage.onExit()
        }
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(0)
        }
        this.overridePage = _page
        this.overridePage.onEnter()
    }

    closeOverridePage() {
        if (this.overridePage) {
            this.overridePage.onExit()
        }
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(0)
        }
        this.overridePage = null
    }

    SwitchToPageName(_menu: string, _page: string) {
        if (!this.pageGroups.length) return

        this.closePopUpElement()
        if (this.overridePage) {
            this.closeOverridePage()
        }

        this.pageGroups[this.currentPageGroupIndex].onExit()
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(0)
        }

        for (let i = 0; i < this.pageGroups.length; i++) {
            if (this.pageGroups[i].name === _menu) {
                this.currentPageGroupIndex = i
            }
        }
        this.pageGroups[this.currentPageGroupIndex].goToPage(_page, true)
    }

    SwitchToMenuName(_name: string) {
        if (!this.pageGroups.length) return

        this.pageGroups[this.currentPageGroupIndex].onExit()
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(0)
        }

        for (let i = 0; i < this.pageGroups.length; i++) {
            if (this.pageGroups[i].name === _name) {
                this.currentPageGroupIndex = i
            }
        }
        this.pageGroups[this.currentPageGroupIndex].onEnter()
    }

    GetInteractionState() {
        return this.currentInteractionState
    }

    blinkGetState(_blinkPeriod: number, _duration: number) {
        return Math.round(new Date().getTime() / _duration) % (_blinkPeriod / _duration) === 0
    }

    IsEditingSearchField() {
        return this.GetInteractionState() === 3
    }

    OnSearchFieldEndEditing() {
        this.SwitchToInteractionState(0)
    }

    addIndependentElementContainer(_container: any) {
        _container.setGPS(this)
        this.IndependentsElements.push(_container)
    }

    getCurrentPageGroup() {
        return this.pageGroups[this.currentPageGroupIndex]
    }

    getCurrentPage() {
        if (!this.overridePage) {
            const currentGroup = this.getCurrentPageGroup()
            if (currentGroup) return currentGroup.getCurrentPage()
            return undefined
        }
        return this.overridePage
    }

    leaveEventPage() {
        this.getCurrentPageGroup().onEnter()
    }

    closePopUpElement() {
        let callback = null
        if (this.popUpElement) {
            callback = this.popUpCloseCallback
            this.popUpElement.onExit()
        }
        this.popUpElement = null
        this.popUpCloseCallback = null
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(0)
        }
        if (this.interactionStateBeforePopup >= 0) {
            this.ActiveSelection(this.selectablesBeforePopup)
            this.SwitchToInteractionState(this.interactionStateBeforePopup)
            this.interactionStateBeforePopup = -1
        }
        if (callback) {
            callback()
        }
    }

    switchToPopUpPage(_pageContainer: any, _PopUpCloseCallback: (() => void) | null = null) {
        if (this.popUpElement) {
            this.popUpElement.onExit()
            if (this.popUpCloseCallback) {
                this.popUpCloseCallback()
            }
        }
        this.interactionStateBeforePopup = -1
        if (this.menuElementsSub.get().length > 0) {
            this.SwitchToInteractionState(0)
        } else {
            this.interactionStateBeforePopup = this.GetInteractionState()
            this.selectablesBeforePopup = this.currentSelectableArray
        }
        this.popUpCloseCallback = _PopUpCloseCallback
        this.popUpElement = _pageContainer
        this.popUpElement.onEnter()
    }

    getElementOfType(c: any) {
        for (let i = 0; i < this.IndependentsElements.length; i++) {
            const elem = this.IndependentsElements[i].getElementOfType(c)
            if (elem) {
                return elem
            }
        }
        const curr = this.getCurrentPage().element.getElementOfType(c)
        if (curr) {
            return curr
        }
        for (let i = 0; i < this.pageGroups.length; i++) {
            for (let j = 0; j < this.pageGroups[i].pages.length; j++) {
                const elem = this.pageGroups[i].pages[j].getElementOfType(c)
                if (elem) {
                    return elem
                }
            }
        }
        return null
    }

    onSoundEnd(_eventId: any) {
        for (let i = 0; i < this.pageGroups.length; i++) {
            for (let j = 0; j < this.pageGroups[i].pages.length; j++) {
                this.pageGroups[i].pages[j].onSoundEnd(_eventId)
            }
        }
        for (let i = 0; i < this.IndependentsElements.length; i++) {
            this.IndependentsElements[i].onSoundEnd(_eventId)
        }
    }
}

export class NavSystemPageGroup {
    _updatingWithBudget: boolean
    name: any
    gps: any
    pages: any[]
    pageIndex: number

    constructor(_name: any, _gps: any, _pages: any[]) {
        this._updatingWithBudget = false
        this.name = _name
        this.gps = _gps
        this.pages = _pages
        this.pageIndex = 0
        for (let i = 0; i < _pages.length; i++) {
            _pages[i].pageGroup = this
            _pages[i].gps = this.gps
        }
    }

    onEnter() {
        this.pages[this.pageIndex].onEnter()
    }

    onUpdate(_deltaTime: number) {
        if (!this._updatingWithBudget) this.pages[this.pageIndex].onUpdate(_deltaTime)
    }

    onExit() {
        this.pages[this.pageIndex].onExit()
    }

    getCurrentPage() {
        return this.pages[this.pageIndex]
    }

    onUpdateSpecificItem(_deltaTime: number, _itemId: number) {
        if (_itemId === 0) {
            this._updatingWithBudget = true
            this.onUpdate(_deltaTime)
            this._updatingWithBudget = false
        }
        return this.pages[this.pageIndex].onUpdateSpecificItem(_deltaTime, _itemId)
    }

    nextPage() {
        if (this.pages.length > 1) {
            this.pages[this.pageIndex].onExit()
            this.pageIndex = (this.pageIndex + 1) % this.pages.length
            this.pages[this.pageIndex].onEnter()
        }
    }

    prevPage() {
        if (this.pages.length > 1) {
            this.pages[this.pageIndex].onExit()
            this.pageIndex = (this.pageIndex + this.pages.length - 1) % this.pages.length
            this.pages[this.pageIndex].onEnter()
        }
    }

    goToPage(_name: string, _skipExit = false) {
        if (!_skipExit) {
            this.pages[this.pageIndex].onExit()
        }
        for (let i = 0; i < this.pages.length; i++) {
            if (this.pages[i].name === _name) {
                this.pageIndex = i
            }
        }
        this.onEnter()
    }
}

export class NavSystemElementContainer {
    defaultMenu: ContextualMenuElementData[]

    gps: any

    name: any
    htmlElemId: any
    isInitialized: boolean
    _updatingWithBudget: boolean
    element: any

    constructor(_name: any, _htmlElemId: any, _element: any) {
        this.name = _name
        this.htmlElemId = _htmlElemId
        this.isInitialized = false
        this._updatingWithBudget = false
        this.element = _element
        if (_element) {
            _element.container = this
        }
    }

    init(_root?: HTMLElement) {}

    onEnter() {
        if (!this.checkInit()) return
        if (this.element) {
            this.element.onEnter()
        }
    }

    onUpdate(_deltaTime: number) {
        if (!this._updatingWithBudget) {
            if (!this.checkInit()) return
            if (this.element) {
                this.element.onUpdate(_deltaTime)
            }
        }
    }

    onExit() {
        if (this.element) {
            this.element.onExit()
        }
    }

    onEvent(_event: string) {
        if (this.element) {
            this.element.onEvent(_event)
        }
    }

    getDefaultMenu() {
        return this.defaultMenu
    }

    checkInit() {
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

    onUpdateSpecificItem(_deltaTime: number, _itemId: number) {
        if (!this.checkInit()) return false
        if (_itemId === 0) {
            this._updatingWithBudget = true
            this.onUpdate(_deltaTime)
            this._updatingWithBudget = false
        }
        if (this.element) {
            return this.element.onUpdateSpecificItem(_deltaTime, _itemId)
        }
        return false
    }

    onSoundEnd(_eventId: any) {
        if (this.element) {
            this.element.onSoundEnd(_eventId)
        }
    }

    onShutDown() {
        if (this.element) {
            this.element.onShutDown()
        }
    }

    onPowerOn() {
        if (this.element) {
            this.element.onPowerOn()
        }
    }

    setGPS(_gps: any) {
        this.gps = _gps
        if (this.element) {
            this.element.setGPS(_gps)
        }
    }

    getElementOfType(c: any) {
        if (this.element) {
            return this.element.getElementOfType(c)
        }
        return null
    }
}

export class NavSystemPage extends NavSystemElementContainer {
    constructor(_name?: string, _htmlElemId?: string, _element?: any) {
        super(_name, _htmlElemId, _element)
    }
}

export class NavSystemElement extends Updatable {
    isInitialized: boolean
    defaultSelectables: any[]
    _alwaysUpdate: boolean
    gps: any
    container: any

    set alwaysUpdate(_val: boolean) {
        this._alwaysUpdate = _val
        if (this.gps) this.gps.alwaysUpdate(this, _val)
    }

    constructor() {
        super()
        this.isInitialized = false
        this.defaultSelectables = []
        this._alwaysUpdate = false
    }

    onSoundEnd(_eventId: any) {}
    onShutDown() {}
    onPowerOn() {}
    redraw() {}

    isReady() {
        return true
    }

    onUpdateSpecificItem(_deltaTime: number, _itemId: number) {
        if (_itemId === 0) this.onUpdate(_deltaTime)
        return false
    }

    onUpdate(_deltaTime?: number): void {}

    getDefaultSelectables() {
        return this.defaultSelectables
    }

    setGPS(_gps: any) {
        if (this.gps && !_gps && this._alwaysUpdate) {
            this.gps.alwaysUpdate(this, false)
        }
        this.gps = _gps
        if (this.gps) {
            this.gps.alwaysUpdate(this, this._alwaysUpdate)
        }
    }

    getElementOfType(c: any) {
        if (this instanceof c) {
            return this
        }
        return null
    }
}

export class NavSystemElementGroup extends NavSystemElement {
    _updatingWithBudget: boolean
    elements: any[]

    constructor(_elements: any[]) {
        super()
        this._updatingWithBudget = false
        this.elements = _elements
    }

    init(_root: HTMLElement) {
        this.defaultSelectables = []
        for (let i = 0; i < this.elements.length; i++) {
            if (!this.elements[i].isInitialized) {
                this.elements[i].container = this.container
                this.elements[i].setGPS(this.gps)
                this.elements[i].init(_root)
                this.elements[i].isInitialized = true
                this.defaultSelectables.concat(this.elements[i].getDefaultSelectables())
            }
        }
    }

    onEnter() {
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].onEnter()
        }
    }

    onUpdate(_deltaTime: number) {
        if (!this._updatingWithBudget) {
            for (let i = 0; i < this.elements.length; i++) {
                this.elements[i].onUpdate(_deltaTime)
            }
        }
    }

    onExit() {
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].onExit()
        }
    }

    onEvent(_event: string) {
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].onEvent(_event)
        }
    }

    isReady() {
        for (let i = 0; i < this.elements.length; i++) {
            if (!this.elements[i].isReady()) {
                return false
            }
        }
        return true
    }

    onUpdateSpecificItem(_deltaTime: number, _itemId: number) {
        if (_itemId === 0) {
            this._updatingWithBudget = true
            this.onUpdate(_deltaTime)
            this._updatingWithBudget = false
        }
        if (_itemId < this.elements.length) {
            this.elements[_itemId].onUpdate(_deltaTime)
            if (_itemId + 1 < this.elements.length) return true
        }
        return false
    }

    onSoundEnd(_eventId: any) {
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].onSoundEnd(_eventId)
        }
    }

    onShutDown() {
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].onShutDown()
        }
    }

    onPowerOn() {
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].onPowerOn()
        }
    }

    getDefaultSelectables() {
        this.defaultSelectables = []
        for (let i = 0; i < this.elements.length; i++) {
            this.defaultSelectables.concat(this.elements[i].getDefaultSelectables())
        }
        return this.defaultSelectables
    }

    setGPS(_gps: any) {
        this.gps = _gps
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].setGPS(_gps)
        }
    }

    getElementOfType(c: any) {
        for (let i = 0; i < this.elements.length; i++) {
            const elem = this.elements[i].getElementOfType(c)
            if (elem) {
                return elem
            }
        }
        return null
    }

    addElement(elem: any) {
        this.elements.push(elem)
    }
}
