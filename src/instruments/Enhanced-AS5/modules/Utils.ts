/**
 * Centralised colour palette for the G5 Enhanced instrument.
 *
 * Base colours are aligned with the G3X Touch reference design
 * (`G3XTouch.css`).  Keep in sync with the CSS custom properties in
 * `style.css :root`.
 *
 * Usage:
 * ```
 * import { Colors } from './Utils'
 * // ...
 * fill={Colors.MAGENTA}
 * ```
 */
export enum Colors {
    // -- G3X-aligned base colours (keep in sync with style.css :root) --
    /** @css `--black` */
    BLACK = 'black',
    /** @css `--white` */
    WHITE = 'white',
    /** @css `--red` */
    RED = 'red',
    /** @css `--magenta` */
    MAGENTA = 'magenta',
    /** @css `--cyan` */
    CYAN = 'cyan',
    /** @css `--green` */
    GREEN = 'lime',
    /** @css `--yellow` */
    YELLOW = 'yellow',
    /** @css `--amber` */
    AMBER = '#ffdc24',
    /** @css `--focus-blue` */
    FOCUS_BLUE = '#37c0ef',

    // -- Glass-cockpit panel background --
    /** Dark glass-cockpit panel fill. */
    PFD_BOX_BG = '#1a1d21',

    // -- Standard SVG values --
    TRANSPARENT = 'transparent',
    NONE = 'none',

    // -- Instrument-specific (no direct G3X equivalent) --
    /** Attitude-indicator sky-gradient stops. */
    SKY_BLUE = '#3062C8',
    SKY_BLUE_LIGHT = '#5F8AE0',
    /** Attitude-indicator ground-gradient stops. */
    GROUND_BROWN = '#864B01',
    GROUND_BROWN_LIGHT = '#A66C1D',
    /** Attitude-indicator cursor shadow-yellow (3-D bevel). */
    CURSOR_YELLOW_DARK = '#cccc00',
    /** Silver hollow-diamond bug (GP preview / armed). */
    HOLLOW_DIAMOND = '#DFDFDF',
    /** Ground-line brown fill on the altimeter tape. */
    GROUND_LINE_BROWN = '#654222',
    /** Horizontal-compass shadow-gradient colour. */
    SHADOW_COMPASS_BLUE = 'rgb(9, 39, 61)',
}
