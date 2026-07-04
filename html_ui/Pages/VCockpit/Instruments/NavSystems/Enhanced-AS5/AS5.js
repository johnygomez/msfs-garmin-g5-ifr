class AS5 extends NavSystem {
    get templateID() { return "AS5"; }
    connectedCallback() {
        super.connectedCallback();
        this.pagesContainer = this.getChildById("PageContainer");
        this.pageGroups = [
            new NavSystemPageGroup("Main", this, [
                new AS5_PFD(),
                new AS5_MFD(),
            ])
        ];
        this.menuMaxElems = 4;
        this.selectionValueElement = new AS5_SelectionValueElement();
        this.selectionValueWindow = new NavSystemElementContainer("Selection Value", "SelectionValueWindow", this.selectionValueElement);
        this.selectionValueWindow.setGPS(this);
    }
    computeEvent(_event) {
        let popUpWasOpen = this.popUpElement != null;
        super.computeEvent(_event);
        switch (_event) {
            case "Knob_Inc":
                if (this.currentInteractionState == 2) {
                    this.computeEvent("NavigationSmallInc");
                } else if (this.pageGroups && this.pageGroups[0].pageIndex == 1 && !popUpWasOpen) {
                    this.incrementHeading();
                } else if (!popUpWasOpen) {
                    this.computeEvent("BARO_INC");
                }
                break;
            case "Knob_Dec":
                if (this.currentInteractionState == 2) {
                    this.computeEvent("NavigationSmallDec");
                } else if (this.pageGroups && this.pageGroups[0].pageIndex == 1 && !popUpWasOpen) {
                    this.decrementHeading();
                } else if (!popUpWasOpen) {
                    this.computeEvent("BARO_DEC");
                }
                break;
            case "Knob_Push":
                if (this.currentInteractionState == 2)
                    this.computeEvent("ENT_Push");
                else if (!popUpWasOpen)
                    this.computeEvent("MENU_Push");
                break;
        }
    }
    onPowerOn() {
        super.onPowerOn();
        if (this.instrumentIndex == 2)
            this.SwitchToPageName("Main", "MFD");
        else
            this.SwitchToPageName("Main", "PFD");
    }
    UpdateSlider(_slider, _cursor, _index, _nbElem, _maxElems) {
        if (_nbElem > _maxElems) {
            let cursorWidth = (_maxElems * 100) / _nbElem;
            let pct = _index / (_nbElem - _maxElems);
            let cursorLeft = Math.min(pct, 1.0) * (100 - cursorWidth);
            diffAndSetAttribute(_slider, "state", "Active");
            diffAndSetAttribute(_cursor, "style", "width:" + cursorWidth + "%; left:" + cursorLeft + "%");
        }
        else {
            diffAndSetAttribute(_slider, "state", "Inactive");
        }
    }
    getMenuHeadingText() {
        let hdg = fastToFixed(Simplane.getAutoPilotHeadingLockValueDegrees(), 0);
        let headingValue = parseFloat(hdg);
        if (headingValue == 0) {
            headingValue = 360;
        }
        hdg = headingValue + '';
        return ("000".slice(hdg.length) + hdg + Avionics.Utils.DEGREE_SYMBOL);
    }
    changeHeading(_sign) {
        // Knob acceleration delegates to InputAcceleration.js (ported from
        // @microsoft/msfs-sdk, see that file) instead of reimplementing the
        // dt/decay math here. It's what drives the snappy spin-to-accelerate feel
        // of the stock G1000/OBS knobs, and it isn't fooled by mouse-drag input
        // arriving in batches rather than one event per instant of movement, since
        // its ratchet only cares about tick count, not the gap between ticks.
        let now = Date.now();
        let dt = now - (this.lastHdgKnobTime || 0);
        this.hdgKnobAccel = this.hdgKnobAccel || new InputAcceleration({ increment: 1 });
        if (dt > 600 || _sign != this.lastHdgKnobSign) {
            // knob was idle or reversed: resync with the sim and drop acceleration
            this.hdgKnobTarget = Math.round(Simplane.getAutoPilotHeadingLockValueDegrees());
            this.hdgKnobAccel.resume();
        }
        this.lastHdgKnobTime = now;
        this.lastHdgKnobSign = _sign;
        let step = this.hdgKnobAccel.doStep();
        this.hdgKnobTarget = (((this.hdgKnobTarget + _sign * step) % 360) + 360) % 360;
        SimVar.SetSimVarValue("K:HEADING_BUG_SET", "number", this.hdgKnobTarget);
    }
    incrementHeading() {
        this.changeHeading(1);
    }
    decrementHeading() {
        this.changeHeading(-1);
    }
    syncHeading() {
        SimVar.SetSimVarValue("K:HEADING_BUG_SET", "number", (Math.round(Simplane.getHeadingMagnetic())));
    }
    menuHeadingEnter() {
        this.selectionValueElement.setContext("Select Heading", this.getMenuHeadingText.bind(this), this.incrementHeading.bind(this), this.decrementHeading.bind(this), this.syncHeading.bind(this));
        this.switchToPopUpPage(this.selectionValueWindow);
    }
    getMenuCrsText() {
        let crs = fastToFixed(Simplane.getNavObs(1), 0);
        let crsValue = parseFloat(crs);
        if (crsValue == 0) {
            crsValue = 360;
        }
        crs = crsValue + '';
        return ("000".slice(crs.length) + crs + Avionics.Utils.DEGREE_SYMBOL);
    }
    incrementCrs() {
        SimVar.SetSimVarValue("K:VOR1_OBI_INC", "number", 0);
    }
    decrementCrs() {
        SimVar.SetSimVarValue("K:VOR1_OBI_DEC", "number", 0);
    }
    syncCrs() {

    }
    menuCrsEnter() {
        this.selectionValueElement.setContext("Select Course", this.getMenuCrsText.bind(this), this.incrementCrs.bind(this), this.decrementCrs.bind(this), this.syncCrs.bind(this));
        this.switchToPopUpPage(this.selectionValueWindow);
    }
    getMenuAltitudeText() {
        return fastToFixed(SimVar.GetSimVarValue("AUTOPILOT ALTITUDE LOCK VAR", "feet"), 0) + "ft";
    }
    incrementAltitude() {
        SimVar.SetSimVarValue("K:AP_ALT_VAR_INC", "number", 100);
    }
    decrementAltitude() {
        SimVar.SetSimVarValue("K:AP_ALT_VAR_DEC", "number", 100);
    }
    syncAltitude() {
        SimVar.SetSimVarValue("K:AP_ALT_VAR_SET_ENGLISH", "number", (Math.round(Simplane.getAltitude() / 100) * 100));
    }
    menuAltitudeEnter() {
        this.selectionValueElement.setContext("Select Altitude", this.getMenuAltitudeText.bind(this), this.incrementAltitude.bind(this), this.decrementAltitude.bind(this), this.syncAltitude.bind(this));
        this.switchToPopUpPage(this.selectionValueWindow);
    }
}
class AS5_PFD extends NavSystemPage {
    constructor() {
        super("PFD", "PFD", null);
        this.element = new NavSystemElementGroup([
            new PFD_AutopilotDisplay(),
            new PFD_Attitude(),
            new PFD_Airspeed_Enhanced(),
            new PFD_Altimeter(),
            new AS5_PFD_Compass(),
            new AS5_PFD_CDI(),
        ]);
    }
    init() {
        super.init();
        this.defaultMenu = new ContextualMenu("", [
            new ContextualMenuElementImage("Back", this.gps.SwitchToInteractionState.bind(this.gps, 0), "/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png", false),
            new ContextualMenuElementValue("Heading", this.gps.menuHeadingEnter.bind(this.gps), this.gps.getMenuHeadingText.bind(this.gps), false),
            new ContextualMenuElementValue("Altitude", this.gps.menuAltitudeEnter.bind(this.gps), this.gps.getMenuAltitudeText.bind(this.gps), false),
            new ContextualMenuElementValue("Pitch", null, () => { return "-----°"; }, true),
            new ContextualMenuElementImage("MFD", this.gps.SwitchToPageName.bind(this.gps, "Main", "MFD"), "/Pages/VCockpit/Instruments/NavSystems/AS5/Images/MFD.png", false),
        ]);
    }
    onUpdate(deltaTime) {
        super.onUpdate(deltaTime);
    }
}
class AS5_MFD extends NavSystemPage {
    constructor() {
        super("MFD", "MFD", null);
        this.element = new NavSystemElementGroup([
            new AS5_MFD_HSI("HSICompass"),
        ]);
    }
    init() {
        super.init();
        this.defaultMenu = new ContextualMenu("", [
            new ContextualMenuElementImage("Back", this.gps.SwitchToInteractionState.bind(this.gps, 0), "/Pages/VCockpit/Instruments/NavSystems/AS5/Images/BACK_ARROW.png", false),
            new ContextualMenuElementValue("Heading", this.gps.menuHeadingEnter.bind(this.gps), this.gps.getMenuHeadingText.bind(this.gps), false),
            new ContextualMenuElementValue("Course", this.gps.menuCrsEnter.bind(this.gps), this.gps.getMenuCrsText.bind(this.gps), false),
            new ContextualMenuElementImage("PFD", this.gps.SwitchToPageName.bind(this.gps, "Main", "PFD"), "/Pages/VCockpit/Instruments/NavSystems/AS5/Images/PFD.png", false),
            new ContextualMenuElementImage("Setup", null, "/Pages/VCockpit/Instruments/NavSystems/AS5/Images/SETUP.png", true),
        ]);
    }
}
class AS5_PFD_Compass extends NavSystemElement {
    init(root) {
        this.compass = this.gps.getChildById("Compass");
    }
    onEnter() { }
    onUpdate(_deltaTime) {
        let bearing = Simplane.getHeadingMagnetic();
        let track = Simplane.getTrackAngle();
        diffAndSetAttribute(this.compass, "bearing", fastToFixed(bearing, 3));
        diffAndSetAttribute(this.compass, "ground-track", fastToFixed(track, 3));
        diffAndSetAttribute(this.compass, "course", Simplane.getAutoPilotDisplayedHeadingLockValueDegrees() + '');
    }
    onExit() { }
    onEvent(_event) { }
}
class AS5_PFD_CDI extends NavSystemElement {
    init(root) {
        this.cdi = this.gps.getChildById("CDI");
    }
    onEnter() { }
    onUpdate(_deltaTime) {
        let cdiSource = SimVar.GetSimVarValue("GPS DRIVES NAV1", "Bool") ? 3 : Simplane.getAutoPilotSelectedNav();
        switch (cdiSource) {
            case 1:
            case 2:
                diffAndSetStyle(this.cdi, StyleProperty.display, Simplane.getNavHasNav(cdiSource) ? "inherit" : "none");
                diffAndSetAttribute(this.cdi, "deviation", (SimVar.GetSimVarValue("NAV CDI:" + cdiSource, "number") / 127) + '');
                diffAndSetAttribute(this.cdi, "deviation-mode", "VLOC");
                break;
            case 3:
                diffAndSetStyle(this.cdi, StyleProperty.display, SimVar.GetSimVarValue("GPS WP NEXT ID", "string") != "" ? "inherit" : "none");
                diffAndSetAttribute(this.cdi, "deviation", SimVar.GetSimVarValue("GPS WP CROSS TRK", "nautical mile"));
                diffAndSetAttribute(this.cdi, "deviation-mode", "GPS");
                break;
        }
    }
    onExit() { }
    onEvent(_event) { }
}
class AS5_MFD_HSI extends PFD_Compass {
    init(root) {
        super.init(root);
        this.selectedHeadingValue = this.gps.getChildById("SelectedHeadingValue");
        this.groundSpeedValue = this.gps.getChildById("GroundSpeedValue");
        this.waypointDistanceValue = this.gps.getChildById("WaypointDistanceValue");
    }
    onUpdate(_deltaTime) {
        super.onUpdate(_deltaTime);
        if (this.selectedHeadingValue) {
            let headingValue = parseFloat(this.hsi.getAttribute("heading_bug_rotation"));
            if (headingValue == 0) {
                headingValue = 360;
            }
            let hdg = fastToFixed(headingValue, 0);
            diffAndSetText(this.selectedHeadingValue, "000".slice(hdg.length) + hdg + "°");
        }
        if (this.groundSpeedValue) {
            diffAndSetText(this.groundSpeedValue, fastToFixed(Simplane.getGroundSpeed(), 0) + '');
        }
        if ((this.cdiSource == 1 || this.cdiSource == 2) && this.dmeSource != this.cdiSource) {
            this.dmeSource = this.cdiSource;
        }
        else {
            if (this.waypointDistanceValue) {
                let distanceText = "---";
                switch (this.cdiSource) {
                    case 1:
                    case 2:
                        let distance = parseFloat(this.hsi.getAttribute("dme_distance"));
                        if (!isNaN(distance))
                            distanceText = fastToFixed(distance, 1);
                        diffAndSetText(this.waypointDistanceValue, distanceText);
                        diffAndSetAttribute(this.waypointDistanceValue, "mode", "VOR");
                        break;
                    case 3:
                        if (SimVar.GetSimVarValue("GPS IS ACTIVE WAY POINT", "bool") == true)
                            distanceText = fastToFixed(SimVar.GetSimVarValue("GPS WP DISTANCE", "nautical mile"), 1);
                        diffAndSetText(this.waypointDistanceValue, distanceText);
                        diffAndSetAttribute(this.waypointDistanceValue, "mode", "GPS");
                        break;
                }
            }
        }
    }
}
class AS5_SelectionValueElement extends NavSystemElement {
    init(root) {
        this.window = root;
        this.title = this.gps.getChildById("SelectionValueWindowTitle");
        this.value = this.gps.getChildById("SelectionValueWindowValue");
    }
    setContext(_titleText, _getCallback, _incCallback = EmptyCallback.Void, _decCallback = EmptyCallback.Void, _syncCallback = EmptyCallback.Void) {
        diffAndSetText(this.title, _titleText);
        this.getCallback = _getCallback;
        this.incCallback = _incCallback;
        this.decCallback = _decCallback;
        this.syncCallback = _syncCallback;
    }
    onEnter() {
        if (this.getCallback && this.value)
            diffAndSetText(this.value, this.getCallback());
        diffAndSetAttribute(this.window, "state", "Active");
    }
    onUpdate(_deltaTime) {
        if (this.getCallback && this.value)
            diffAndSetText(this.value, this.getCallback());
    }
    onExit() {
        diffAndSetAttribute(this.window, "state", "Inactive");
    }
    onEvent(_event) {
        switch (_event) {
            case "Knob_Inc":
                if (this.incCallback)
                    this.incCallback();
                break;
            case "Knob_Dec":
                if (this.decCallback)
                    this.decCallback();
                break;
            case "Knob_Push":
                this.gps.closePopUpElement();
                break;
            case "Knob_Long_Push":
                if (this.syncCallback)
                    this.syncCallback();
                break;
        }
    }
}
registerInstrument("as5-element", AS5);
//# sourceMappingURL=AS5.js.map
