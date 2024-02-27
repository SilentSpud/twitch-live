await Bun.build({
  entrypoints: [
    "./src/background.ts",
    "./src/options.ts",
    "./src/popup.ts",
  ],
  outdir: "./ext/scripts",
  target: "browser",
  minify: true,
});