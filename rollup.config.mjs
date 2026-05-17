import typescript from "@rollup/plugin-typescript";

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: "src/index.ts",
    external: ["firebase/app", "firebase/auth", "firebase/functions", "firebase/firestore", "googleapis"],
    output: [
      { file: "dist/index.js", format: "cjs", sourcemap: true },
      { file: "dist/index.esm.js", format: "esm", sourcemap: true },
    ],
    plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  },
];
