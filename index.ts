import { readdir } from "node:fs/promises";

const Build = async () =>
  await Bun.build({
    entrypoints: ["./src/background.ts", "./src/options.ts", "./src/popup.ts"],
    outdir: "./ext/scripts",
    target: "browser",
    minify: {
      whitespace: true,
      syntax: true,
      identifiers: false,
    },
    sourcemap: "none",
  });

const Transpile = async () => {
  const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser", trimUnusedImports: true, minifyWhitespace: true });
  const files = await readdir("./src");
  for (const file of files) {
    if (file.endsWith(".ts")) {
      const srcFile = Bun.file(`./src/${file}`);
      const newFile = transpiler.transformSync(await srcFile.text());
      await Bun.write(`./ext/scripts/${file.replace(/.ts$/, ".js")}`, newFile);
    }
  }
};

const args = process.argv.slice(2);

if (args.includes("transpile")) {
  Transpile();
} else if (args.includes("build")) {
  Build();
} else {
  console.log("Please specify either 'transpile' or 'build' as a command line argument.");
}