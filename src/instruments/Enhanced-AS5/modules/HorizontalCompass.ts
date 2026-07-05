export class HorizontalCompass extends HTMLElement {
    static get observedAttributes() {
        return ['bearing', 'course-active', 'course', 'ground-track-active', 'ground-track']
    }

    groundTrackActive: boolean
    truncateLeft: number
    truncateRight: number
    spacing: number
    GF_font: string
    root: Element
    movingRibbon: Element
    digits: any[]
    courseElement: Element
    groundTrackElement: Element
    bearingText: Element
    bearing: number
    course: number
    groundTrack: number

    constructor() {
        super()
        this.groundTrackActive = false
        this.truncateLeft = 0
        this.truncateRight = 0
        this.spacing = 20.6
        this.GF_font = 'Montserrat-Bold'
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue == newValue) {
            return
        }
        switch (name) {
            case 'bearing':
                this.bearing = parseFloat(newValue)
                const roundedBearing = Math.round(this.bearing / 10) * 10
                const bearingString = Math.round(this.bearing) + ''
                diffAndSetText(
                    this.bearingText,
                    '000'.slice(0, 3 - bearingString.length) + bearingString
                )
                for (let i = -8; i <= 8; i++) {
                    const string = ((roundedBearing + i * 10 + 360) % 360) + ''
                    diffAndSetText(this.digits[i + 8], '000'.slice(0, 3 - string.length) + string)
                }
                diffAndSetAttribute(
                    this.movingRibbon,
                    'transform',
                    'translate(' + (roundedBearing - this.bearing) * (this.spacing / 10) + ',0)'
                )
                diffAndSetAttribute(
                    this.courseElement,
                    'transform',
                    'translate(' +
                        Avionics.Utils.diffAngle(this.bearing, this.course) * (this.spacing / 10) +
                        ',0)'
                )
                diffAndSetAttribute(
                    this.groundTrackElement,
                    'transform',
                    'translate(' +
                        Avionics.Utils.diffAngle(this.bearing, this.groundTrack) *
                            (this.spacing / 10) +
                        ',0)'
                )
                break
            case 'course-active':
                if (newValue == 'True') {
                    diffAndSetAttribute(this.courseElement, 'visibility', '')
                } else {
                    diffAndSetAttribute(this.courseElement, 'visibility', 'hidden')
                }
                break
            case 'course':
                this.course = parseFloat(newValue)
                diffAndSetAttribute(
                    this.courseElement,
                    'transform',
                    'translate(' +
                        Avionics.Utils.diffAngle(this.bearing, this.course) * (this.spacing / 10) +
                        ',0)'
                )
                break
            case 'ground-track':
                this.groundTrack = parseFloat(newValue)
                diffAndSetAttribute(
                    this.groundTrackElement,
                    'transform',
                    'translate(' +
                        Avionics.Utils.diffAngle(this.bearing, this.groundTrack) *
                            (this.spacing / 10) +
                        ',0)'
                )
                break
            case 'ground-track-active':
                this.groundTrackActive = newValue == 'True'
                diffAndSetAttribute(
                    this.groundTrackElement,
                    'visibility',
                    this.groundTrackActive ? '' : 'hidden'
                )
                break
        }
    }
    parseDefinitionAttributes() {
        const truncateLeft = this.getAttribute('TruncateLeft')
        if (truncateLeft) this.truncateLeft = parseInt(truncateLeft)
        const truncateRight = this.getAttribute('TruncateRight')
        if (truncateRight) this.truncateRight = parseInt(truncateRight)
        const spacing = this.getAttribute('Spacing')
        if (spacing) this.spacing = parseFloat(spacing)
        const groundTrackActive = this.getAttribute('ground-track-active')
        if (groundTrackActive) this.groundTrackActive = groundTrackActive == 'True'
    }
    connectedCallback() {
        this.parseDefinitionAttributes()
        this.createSVG()
    }

    createSVG() {
        const width = 288 - this.truncateLeft - this.truncateRight
        const center = (width + (this.truncateRight - this.truncateLeft) / 2) / 2
        // let center = (width / 2) - ((this.truncateRight - this.truncateLeft) / 2);
        this.root = document.createElementNS(Avionics.SVG.NS, 'svg')
        diffAndSetAttribute(this.root, 'id', center)
        diffAndSetAttribute(this.root, 'width', '100%')
        diffAndSetAttribute(this.root, 'height', '100%')
        diffAndSetAttribute(this.root, 'viewBox', '0 0 ' + width + ' 20')
        this.appendChild(this.root)
        // add gradient defs
        const defs = document.createElementNS(Avionics.SVG.NS, 'defs')
        const horizshadowGradient = document.createElementNS(Avionics.SVG.NS, 'linearGradient')
        horizshadowGradient.setAttribute('id', 'horizshadowGradient')
        const shadowStop1 = document.createElementNS(Avionics.SVG.NS, 'stop')
        shadowStop1.setAttribute('offset', '0%')
        shadowStop1.setAttribute('stop-color', 'rgb(9, 39, 61)')
        shadowStop1.setAttribute('stop-opacity', '0.8')
        const shadowStop2 = document.createElementNS(Avionics.SVG.NS, 'stop')
        shadowStop2.setAttribute('offset', '5%')
        shadowStop2.setAttribute('stop-color', 'rgb(9, 39, 61)')
        shadowStop2.setAttribute('stop-opacity', '0')
        const shadowStop3 = document.createElementNS(Avionics.SVG.NS, 'stop')
        shadowStop3.setAttribute('offset', '95%')
        shadowStop3.setAttribute('stop-color', 'rgb(9, 39, 61)')
        shadowStop3.setAttribute('stop-opacity', '0')
        const shadowStop4 = document.createElementNS(Avionics.SVG.NS, 'stop')
        shadowStop4.setAttribute('offset', '100%')
        shadowStop4.setAttribute('stop-color', 'rgb(9, 39, 61)')
        shadowStop4.setAttribute('stop-opacity', '0.8')
        horizshadowGradient.appendChild(shadowStop1)
        horizshadowGradient.appendChild(shadowStop2)
        horizshadowGradient.appendChild(shadowStop3)
        horizshadowGradient.appendChild(shadowStop4)
        defs.appendChild(horizshadowGradient)
        this.root.appendChild(defs)
        // add shadows at ends of horiz compass
        const shadowRect = document.createElementNS(Avionics.SVG.NS, 'rect')
        shadowRect.setAttribute('class', 'compass-shadows')
        shadowRect.setAttribute('fill', 'url(#horizshadowGradient)')
        shadowRect.setAttribute('x', '0')
        shadowRect.setAttribute('y', '0')
        shadowRect.setAttribute('width', width + '')
        shadowRect.setAttribute('height', '20')
        this.root.appendChild(shadowRect)

        const background = document.createElementNS(Avionics.SVG.NS, 'rect')
        diffAndSetAttribute(background, 'class', 'compass-background')
        diffAndSetAttribute(background, 'x', '0')
        diffAndSetAttribute(background, 'y', '0')
        diffAndSetAttribute(background, 'width', width + '')
        diffAndSetAttribute(background, 'height', '20')
        diffAndSetAttribute(background, 'fill', '#1a1d21')
        diffAndSetAttribute(background, 'fill-opacity', '0.25')
        this.root.appendChild(background)

        this.movingRibbon = document.createElementNS(Avionics.SVG.NS, 'g')
        diffAndSetAttribute(this.movingRibbon, 'class', 'moving-ribbon')
        this.root.appendChild(this.movingRibbon)
        this.digits = []
        for (let i = -8; i <= 8; i++) {
            const digit = document.createElementNS(Avionics.SVG.NS, 'text')
            diffAndSetAttribute(digit, 'fill', 'white')
            diffAndSetAttribute(digit, 'text-anchor', 'middle')
            diffAndSetAttribute(digit, 'x', center + this.spacing * i + '')
            diffAndSetAttribute(digit, 'y', '13')
            diffAndSetAttribute(digit, 'font-size', '8')
            diffAndSetAttribute(digit, 'font-family', this.GF_font)
            diffAndSetAttribute(digit, 'letter-spacing', '0.1em')
            diffAndSetText(digit, 'XXX')
            this.movingRibbon.appendChild(digit)
            this.digits.push(digit)
        }
        for (let i = -80; i <= 80; i++) {
            const rect = document.createElementNS(Avionics.SVG.NS, 'rect')
            diffAndSetAttribute(rect, 'x', center - 0.5 + (this.spacing / 10) * i + '')
            diffAndSetAttribute(rect, 'y', i % 5 == 0 ? '15' : '18.5')
            diffAndSetAttribute(rect, 'width', '1')
            diffAndSetAttribute(rect, 'height', i % 5 == 0 ? '5' : '1.5')
            diffAndSetAttribute(rect, 'fill', 'white')
            this.movingRibbon.appendChild(rect)
        }
        this.courseElement = document.createElementNS(Avionics.SVG.NS, 'polygon')
        diffAndSetAttribute(this.courseElement, 'class', 'course-bug')
        diffAndSetAttribute(
            this.courseElement,
            'points',
            center +
                ',20 ' +
                (center + 6) +
                ',16 ' +
                (center + 10) +
                ',16 ' +
                (center + 10) +
                ',20 ' +
                (center - 10) +
                ',20 ' +
                (center - 10) +
                ',16 ' +
                (center - 6) +
                ',16'
        )
        diffAndSetAttribute(this.courseElement, 'fill', 'aqua')
        this.root.appendChild(this.courseElement)
        this.groundTrackElement = document.createElementNS(Avionics.SVG.NS, 'polygon')
        diffAndSetAttribute(this.groundTrackElement, 'class', 'ground-track-bug')
        diffAndSetAttribute(
            this.groundTrackElement,
            'points',
            center + ',15 ' + (center + 5) + ',20 ' + (center - 5) + ',20 '
        )
        diffAndSetAttribute(this.groundTrackElement, 'fill', 'magenta')
        diffAndSetAttribute(this.groundTrackElement, 'stroke', 'black')
        diffAndSetAttribute(
            this.groundTrackElement,
            'visibility',
            this.groundTrackActive ? '' : 'hidden'
        )
        this.root.appendChild(this.groundTrackElement)
        const bearingBackground = document.createElementNS(Avionics.SVG.NS, 'polygon')
        diffAndSetAttribute(bearingBackground, 'class', 'bearing-background')
        diffAndSetAttribute(
            bearingBackground,
            'points',
            center +
                ',20 ' +
                (center + 4) +
                ',16 ' +
                (center + 14) +
                ',16 ' +
                (center + 14) +
                ',0 ' +
                (center - 14) +
                ',0 ' +
                (center - 14) +
                ',16 ' +
                (center - 4) +
                ',16'
        )
        diffAndSetAttribute(bearingBackground, 'fill', 'black')
        diffAndSetAttribute(bearingBackground, 'stroke', 'white')
        diffAndSetAttribute(bearingBackground, 'stroke-width', '0.5')
        this.root.appendChild(bearingBackground)
        this.bearingText = document.createElementNS(Avionics.SVG.NS, 'text')
        diffAndSetAttribute(this.bearingText, 'class', 'bearing-text')
        diffAndSetAttribute(this.bearingText, 'fill', 'white')
        diffAndSetAttribute(this.bearingText, 'text-anchor', 'middle')
        diffAndSetAttribute(this.bearingText, 'x', center + '')
        diffAndSetAttribute(this.bearingText, 'y', '13')
        diffAndSetAttribute(this.bearingText, 'font-size', '14')
        diffAndSetAttribute(this.bearingText, 'font-family', this.GF_font)
        diffAndSetText(this.bearingText, 'XXX')
        // add wrapper to scale text
        const bearingTextWrapper = document.createElementNS(Avionics.SVG.NS, 'g')
        diffAndSetAttribute(bearingTextWrapper, 'class', 'bearing-text-wrapper')
        diffAndSetAttribute(bearingTextWrapper, 'transform', 'scale(0.85,1) translate(16,0)')
        bearingTextWrapper.appendChild(this.bearingText)
        this.root.appendChild(bearingTextWrapper)
    }
}
customElements.define('glasscockpit-horizontal-compass', HorizontalCompass)
