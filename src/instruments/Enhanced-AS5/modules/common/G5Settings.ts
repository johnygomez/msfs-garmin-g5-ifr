import { DefaultUserSettingManager, EventBus, UserSettingSaveManager } from '@microsoft/msfs-sdk'

import { BearingPointerValue } from './Nav'
import { BaroUnit, OATUnit, ToggleMode } from './Utils'

export type G5SettingTypes = {
    g5BaroUnit: BaroUnit
    g5OatUnit: OATUnit
    g5TasMode: ToggleMode
    g5BearingPointer1: BearingPointerValue
    g5BearingPointer2: BearingPointerValue
    g5WindMode: ToggleMode
}

export type G5Settings = DefaultUserSettingManager<G5SettingTypes>

const SAVE_KEY_PREFIX = 'gomez-g5'
const FALLBACK_AIRCRAFT_MODEL = 'default'

export function createG5Settings(bus: EventBus): G5Settings {
    return new DefaultUserSettingManager<G5SettingTypes>(bus, [
        { name: 'g5BaroUnit', defaultValue: 'hPa' },
        { name: 'g5OatUnit', defaultValue: 'None' },
        { name: 'g5TasMode', defaultValue: 'OFF' },
        { name: 'g5BearingPointer1', defaultValue: 'VLOC1' },
        { name: 'g5BearingPointer2', defaultValue: 'NONE' },
        { name: 'g5WindMode', defaultValue: 'OFF' },
    ])
}

export function loadAndAutoSaveG5Settings(settings: G5Settings): UserSettingSaveManager {
    const saveManager = new UserSettingSaveManager(settings.getAllSettings())
    const aircraftModel: string =
        SimVar.GetSimVarValue('A:ATC MODEL', 'string') || FALLBACK_AIRCRAFT_MODEL
    const saveKey = `${SAVE_KEY_PREFIX}.${aircraftModel}`
    saveManager.load(saveKey)
    saveManager.startAutoSave(saveKey)
    return saveManager
}
