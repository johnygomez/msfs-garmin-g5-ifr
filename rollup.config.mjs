import typescript from "@rollup/plugin-typescript"
import resolve from "@rollup/plugin-node-resolve"
import { copyFileSync } from "node:fs"
import { resolve as pathResolve } from "node:path"

const sdkProject =
    "/mnt/c/Users/janga/Documents/msfs/projects/garmin-g5-enhanced/PackageSources"
const htmlUiPath = "html_ui/Pages/VCockpit/Instruments/NavSystems/Enhanced-AS5"

export default {
    input: "src/instruments/Enhanced-AS5/index.ts",
    output: {
        file: pathResolve(sdkProject, htmlUiPath, "AS5.js"),
        format: "iife",
        name: "garminG5",
        globals: {
            "@microsoft/msfs-sdk": "msfssdk",
        },
    },
    external: ["@microsoft/msfs-sdk"],
    plugins: [
        resolve(),
        typescript({
            tsconfig: "./tsconfig.json",
        }),
        {
            name: "copy-css",
            writeBundle() {
                const src = "src/instruments/Enhanced-AS5/style.css"
                const dest = pathResolve(sdkProject, htmlUiPath, "AS5.css")
                copyFileSync(src, dest)
            },
        },
    ],
}
