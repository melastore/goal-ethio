// Teaches `node --test` the "@/" alias from tsconfig.json. The bundler resolves
// it, Node does not, and rewriting the source to relative paths with extensions
// would leave the app written one way and the tests another.
import { registerHooks } from "node:module";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

    const target = new URL(specifier.slice(2), SRC);
    // The alias is written without an extension, so try the ones the app uses.
    for (const candidate of [`${target.href}.ts`, `${target.href}.tsx`, target.href]) {
      try {
        return nextResolve(candidate, context);
      } catch {
        // Next extension.
      }
    }

    return nextResolve(specifier, context);
  },
});
