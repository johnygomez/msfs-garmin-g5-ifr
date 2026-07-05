import * as esbuild from "esbuild";
import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const SDK_PROJECT =
  "/mnt/c/Users/janga/Documents/msfs/projects/garmin-g5-enhanced/PackageSources";

const outDir = resolve(
  SDK_PROJECT,
  "html_ui/Pages/VCockpit/Instruments/NavSystems/Enhanced-AS5"
);

const isWatch = process.argv.includes("--watch");

const config = {
  entryPoints: ["src/instruments/Enhanced-AS5/index.ts"],
  bundle: true,
  format: "iife",
  outfile: resolve(outDir, "AS5.js"),
  target: "es2017",
  platform: "browser",
  minify: false,
  sourcemap: false,
  keepNames: true,
  logLevel: "info",
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(config);

  const cssSrc = "src/instruments/Enhanced-AS5/style.css";
  const cssDest = resolve(outDir, "AS5.css");
  if (existsSync(cssSrc)) {
    copyFileSync(cssSrc, cssDest);
    console.log("Copied CSS file.");
  }

  console.log("Build complete.");
}
