import typescript from "@rollup/plugin-typescript"
import resolve from "@rollup/plugin-node-resolve"
import { copyFileSync, mkdirSync, cpSync, existsSync } from "node:fs"
import { resolve as pathResolve } from "node:path"

const baseOutDir = "garmin-g5-enhanced/PackageSources/html_ui/Pages/VCockpit/Instruments/NavSystems"
const outDir = pathResolve(baseOutDir, "Enhanced-AS5")
const shimOutDir = pathResolve(baseOutDir, "AS5")

export default {
    input: "src/instruments/Enhanced-AS5/index.ts",
    watch: {
        include: "src/**",
        chokidar: {
            usePolling: true,
            interval: 500,
        },
    },
    output: {
        file: pathResolve(outDir, "AS5.js"),
        format: "iife",
        name: "garminG5",
        globals: {
            "@microsoft/msfs-sdk": "msfssdk",
            "@microsoft/msfs-garminsdk": "garminsdk",
        },
    },
    external: ["@microsoft/msfs-sdk", "@microsoft/msfs-garminsdk"],
    plugins: [
        resolve(),
        typescript({
            tsconfig: "./tsconfig.json",
            outputToFilesystem: false,
        }),
        {
            name: "copy-static",
            writeBundle() {
                copyFileSync("src/instruments/Enhanced-AS5/style.css", pathResolve(outDir, "AS5.css"))

                copyFileSync("src/instruments/Enhanced-AS5/garminsdk-shim.js", pathResolve(outDir, "garminsdk-shim.js"))

                copyFileSync(
                    "node_modules/@microsoft/msfs-garminsdk/garminsdk-iife.js",
                    pathResolve(outDir, "garminsdk.js")
                )

                copyFileSync("src/instruments/Enhanced-AS5/AS5.html", pathResolve(outDir, "AS5.html"))

                const imagesSrc = "src/instruments/Enhanced-AS5/Images"
                if (existsSync(imagesSrc)) {
                    cpSync(imagesSrc, pathResolve(outDir, "Images"), { recursive: true })
                }

                const fontsSrc = "src/instruments/Enhanced-AS5/Fonts"
                if (existsSync(fontsSrc)) {
                    cpSync(fontsSrc, pathResolve(outDir, "Fonts"), { recursive: true })
                }

                if (!existsSync(shimOutDir)) {
                    mkdirSync(shimOutDir, { recursive: true })
                }
                copyFileSync("src/instruments/AS5/AS5.html", pathResolve(shimOutDir, "AS5.html"))
            },
        },
    ],
}
