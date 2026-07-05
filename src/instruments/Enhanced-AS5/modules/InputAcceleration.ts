// Ported from @microsoft/msfs-sdk's InputAcceleration utility
// (src/sdk/utils/controllers/InputAcceleration.ts in microsoft/msfs-avionics-mirror),
// vendored here unmodified in plain JS since this instrument loads via flat <script>
// tags with no bundler to pull the npm package in through.
//
// Copyright (c) Microsoft Corporation. Licensed under the MIT license, for use in
// Microsoft Flight Simulator only, per that repo's LICENSE.
export class InputAcceleration {
    acceleration: number
    isPaused: boolean
    maxAcceleration: number
    options: any

    constructor(options: any = {}, initiallyPaused = false) {
        this.acceleration = 0
        this.isPaused = false
        this.maxAcceleration = 15
        this.options = Object.assign(
            {
                increment: 1,
                bigIncrement: (options.increment !== undefined ? options.increment : 1) * 10,
                accelDampeningPeriod: 50,
            },
            options
        )
        this.isPaused = initiallyPaused
        if (!initiallyPaused) {
            this.resume()
        }
    }

    update() {
        if (this.acceleration > 0) {
            this.acceleration = Math.min(Math.max(this.acceleration - 1, 0), this.maxAcceleration)
            if (!this.isPaused) {
                setTimeout(() => {
                    this.update()
                }, this.options.accelDampeningPeriod)
            }
        }
    }
    doStep() {
        this.acceleration += 2
        const increment = this.acceleration > 8 ? this.options.bigIncrement : this.options.increment
        if (this.acceleration <= 2) {
            this.update()
        }
        return increment
    }
    pause() {
        this.isPaused = true
    }
    resume() {
        this.isPaused = false
        this.acceleration = 0
    }
}
