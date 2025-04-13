#!/usr/bin/env node
/**
 * Generate
 */
import * as esbuild from 'esbuild'
import { argv, cwd } from 'node:process'
import path from 'node:path';
import fs from 'node:fs/promises'
import { dependencies, peerDependencies, exports, imports, name, version} from 'package.json' assert { type: 'json' }

const projectRoot = cwd()

const options = {
  bundle: true,
  format: 'esm',
  outbase: path.join(projectRoot, 'node_modules'),
  outdir: argv[2],
  external: Object.keys({ ...dependencies, ...peerDependencies, ...imports }),
  minify: true,
  sourcemap: true,
  platform: 'browser',
  target: 'es2020',
  metafile: true,
}

const banner = `/* Django-ESM - ${name}@${version} */`

const entryPointMap = {}

/**
 * Resolve a import path from a filesystem path and a subpath pattern.
 *
 * @param {string} path - The relative filesystem path.
 * @param {string} entryPointPattern - The pattern to match the entry point.
 * @param {string} importPattern - The pattern to resolve the import path.
 */
function path2Import (path, entryPointPattern, importPattern) {
  return ('\./' + path).replace(new RegExp(entryPointPattern.replace(/\*/, '\(\.\*\)')), importPattern.replace(/\*/, '\$1'))
}

async function bundleExports (packageInfo) {
  const { name, exports } = packageInfo
  const entry = import.meta.resolve(name, `file://${projectRoot}/package.json`)
  const banner = `/* Django-ESM - ${packageInfo.name}@${packageInfo.version} */`

  if (exports === undefined || typeof exports === 'string') {
    const result = await esbuild.build({
      ...options,
      entryPoints: [entry.slice('file://'.length)],

      outbase: projectRoot,
      banner: {
        js: banner,
        css: banner,
      },
    })
    entryPointMap[name] = result.metafile.outputs[0]
  } else {
    for (const [exportName, entryPointPattern] of Object.entries(exports)) {
      const importName = path.join(name, exportName)
      const result = await esbuild.build({
        ...options,
        entryPoints: [import.meta.resolve(importName, `file://${projectRoot}/package.json`).slice('file://'.length)],
        banner: {
          js: banner,
          css: banner,
        },
      })
      for (const [outputFileName, output] of Object.entries(result.metafile.outputs)) {
        if (output.entryPoint !== undefined) {
          entryPointMap[importName] = outputFileName
        }
      }
    }
  }
}

for (const [importName, entryPointPattern] of Object.entries(imports)) {
  const result = await esbuild.build({
    ...options,
    entryPoints: [entryPointPattern],
    banner: {
      js: banner,
      css: banner,
    },
  })
  for (const [name, output] of Object.entries(result.metafile.outputs)) {
    if (output.entryPoint !== undefined) {
      entryPointMap[path2Import(path.relative(projectRoot, output.entryPoint), entryPointPattern, importName)] = name
    }
  }
}

for (const dep of Object.keys(dependencies)) {
  const packageInfo = (await import(`file://${projectRoot}/node_modules/${dep}/package.json`, { with: { type: 'json' } }))['default']
  await bundleExports(packageInfo)
}

await fs.writeFile(path.join(outputDir, 'imports.json'), JSON.stringify(entryPointMap))
