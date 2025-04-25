#!/usr/bin/env node
/**
 * Compile a project into static JavaScript modules and generate a browser importmap.
 *
 * Usage:
 *     esimport <package-root> <output-dir>
 */
import * as esbuild from 'esbuild'
import process from 'node:process'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'

export async function integrityHash(data, algorithm = 'SHA-512') {
  const ec = new TextEncoder()
  const buffer = await globalThis.crypto.subtle.digest(algorithm, ec.encode(data))
  const base64Hash = globalThis.btoa(String.fromCharCode(...new Uint8Array(buffer)))
  return `${algorithm.toLowerCase().replace(/-/, '')}-${base64Hash}`
}

/**
 * Recursively resolve the import paths from a package's entry point.
 *
 * See also: https://nodejs.org/api/packages.html#package-entry-points
 *
 * @param entryPoint {object|string|string[]}: The entry points (import|require|default).
 */
export function resolveImport(entryPoint) {
  if (typeof entryPoint === 'string') {
    return entryPoint
  } else if (Array.isArray(entryPoint)) {
    for (const value of entryPoint.filter((e) => typeof e === 'object')) {
      return resolveImport(value)
    }
  }

  for (const key of ['browser', 'import', 'default']) {
    if (entryPoint.hasOwnProperty(key) && entryPoint[key] !== undefined) {
      return resolveImport(entryPoint[key])
    }
  }

  throw new Error(`No valid entry point found: ${entryPoint}`)
}

/**
 * Resolve an import path from a filesystem path and a subpath pattern.
 *
 * See also: https://nodejs.org/api/packages.html#subpath-patterns
 *
 * @param {string} filePath - The relative filesystem path.
 * @param {string} pathPattern - The pattern to match the entry point.
 * @param {string} entryPointPattern - The pattern to resolve the import path.
 */
export function path2EntryPoint(filePath, pathPattern, entryPointPattern) {
  const pathPatternRexEx = new RegExp(
    path.normalize(pathPattern).replace(/[.+?^${}()|\[\]\\]/g, '\\$&').replace(
      /\*/,
      '\(\.\*\)',
    ),
  )
  if (!pathPatternRexEx.test(filePath)) {
    throw new Error(`Invalid path ${filePath} for entry point ${pathPatternRexEx}`)
  }
  return path.normalize(
    filePath.replace(pathPatternRexEx, entryPointPattern.replace(/\*/, '\$1')),
  )
}

/**
 * Expand a subpath pattern to a list of files.
 *
 * The *-character represents any string including a / or filesystem separator.
 *
 * @param pattern {string}: The subpath pattern to expand.
 * @param cwd {string}: The current working directory.
 */
export async function expandSubpathPattern(pattern, cwd) {
  return (await glob(pattern.replace(/\*/, '{*,**/*}'), {
    cwd,
    nodir: true,
    dotRelative: true,
    ignore: 'node_modules/**',
  })).filter((filePath) => /\.([mc]?jsx?|tsx?|css|txt|json)$/.test(filePath))
}

/**
 * Resolve a package's entry points.
 *
 * See also: https://nodejs.org/api/packages.html#package-entry-points
 *
 * @param pkgName {string}: The name of the package or # for imports.
 * @param entryPoints {object|string|string[]}: The entry points (exports/imports).
 *
 * @returns {object}: A map of entry points to import paths.
 */
export function resolveEntryPoints(pkgName, entryPoints) {
  if (typeof entryPoints === 'string') {
    return { [pkgName]: resolveImport(entryPoints) }
  } else if (Array.isArray(entryPoints)) {
    return Object.fromEntries(
      entryPoints.map((
        entryPoint,
      ) => [path.join(pkgName, entryPoint), resolveImport(entryPoint)]),
    )
  } else if (typeof entryPoints === 'object') {
    try {
      return { [pkgName]: resolveImport(entryPoints) }
    } catch (e) {
      return Object.entries(entryPoints).filter(([key, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[path.join(pkgName, key)] = resolveImport(value)
          return acc
        }, {})
    }
  } else {
    throw new Error(`Invalid entry points for package ${pkgName}: ${entryPoints}`)
  }
}

/**
 * Expand the subpaths for all patterns in the entry points.
 * @param pkgName {string}: The name of the package or # for imports.
 * @param entryPoints {object|string|string[]}: The entry points (exports/imports).
 * @param cwd {string}: The current working directory.
 * @param projectRoot {string}: The root directory of the project.
 * @return {Promise<{object}>}: A map of entry points to their file paths.
 */
export async function expandEntryPoints(pkgName, entryPoints, cwd, projectRoot) {
  const entryPointMap = {}
  for (
    const [entryPointPattern, pathPattern] of Object.entries(
      resolveEntryPoints(pkgName, entryPoints),
    )
  ) {
    for (const subpath of await expandSubpathPattern(pathPattern, cwd)) {
      const importPath = path2EntryPoint(subpath, pathPattern, entryPointPattern)
      entryPointMap[importPath] = path.relative(projectRoot, path.join(cwd, subpath))
    }
  }
  return entryPointMap
}

export async function bundleExports(cwd, projectRoot) {
  const packageInfo = (await import('file://' + path.join(cwd, 'package.json'), {
    with: { type: 'json' },
  }))[
    'default'
  ]
  return await expandEntryPoints(
    packageInfo.name,
    packageInfo.exports ||
      { '.': packageInfo.browser || packageInfo.module || packageInfo.main },
    cwd,
    projectRoot,
  )
}

async function build(projectRoot, outputDir, context, reverseEntryPointMap) {
  const result = await context.rebuild()
  console.info(`${Object.keys(result.metafile.inputs).length} ES modules processed.`)

  const entryPointMap = {}
  for (const [name, output] of Object.entries(result.metafile.outputs)) {
    if (output.entryPoint !== undefined) {
      entryPointMap[
        reverseEntryPointMap[path.relative(projectRoot, output.entryPoint)]
      ] = path.relative(outputDir, name)
    }
  }

  const integrity = {}
  for (const value of Object.values(entryPointMap)) {
    const filePath = path.join(outputDir, value)
    const fileContent = await fs.readFile(filePath)
    integrity[value] = await integrityHash(fileContent)
  }

  const importMap = {
    imports: entryPointMap,
    integrity,
  }

  await fs.writeFile(path.join(outputDir, 'importmap.json'), JSON.stringify(importMap))
}

async function main(argv) {
  const projectRoot = path.isAbsolute(argv[2])
    ? argv[2]
    : path.join(process.cwd(), argv[2])
  const outputDir = path.isAbsolute(argv[3])
    ? argv[3]
    : path.join(process.cwd(), argv[3])
  const rootPackage =
    (await import('file://' + path.join(projectRoot, 'package.json'), {
      with: { type: 'json' },
    }))[
      'default'
    ]

  let entryPoints = {}
  entryPoints = {
    ...entryPoints,
    ...await expandEntryPoints('', rootPackage.imports, projectRoot, projectRoot),
  }
  entryPoints = { ...entryPoints, ...await bundleExports(projectRoot, projectRoot) }
  for (
    const dep of Object.keys({
      ...rootPackage.dependencies,
      ...rootPackage.peerDependencies,
    })
  ) {
    entryPoints = {
      ...entryPoints,
      ...await bundleExports(path.join(projectRoot, 'node_modules', dep), projectRoot),
    }
  }

  const reverseEntryPointMap = Object.entries(entryPoints)
    .reduce((obj, [key, value]) => ({ ...obj, [path.normalize(value)]: key }), {})

  const context = await esbuild.context({
    entryPoints: Object.values(entryPoints).map((entryPoint) =>
      path.join(projectRoot, entryPoint)
    ),
    bundle: true,
    format: 'esm',
    external: [
      ...Object.keys({
        ...entryPoints,
        ...rootPackage.dependencies,
        ...rootPackage.peerDependencies,
      }),
    ],
    outbase: projectRoot,
    outdir: outputDir,
    entryNames: '[dir]/[name]-[hash]',
    minify: true,
    sourcemap: true,
    platform: 'browser',
    target: 'es2020',
    allowOverwrite: true,
    metafile: true,
  })

  await build(projectRoot, outputDir, context, reverseEntryPointMap)

  if (argv[4] !== undefined) {
    const ac = new AbortController()
    const { signal } = ac
    const watcher = fs.watch(projectRoot, { signal, recursive: true })
    process.on('SIGINT', async () => ac.abort())
    process.on('beforeExit', async () => ac.abort())
    try {
      for await (const event of watcher) {
        await build(projectRoot, outputDir, context, reverseEntryPointMap)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return await context.dispose()
      }
      throw err
    }
  } else {
    return await context.dispose()
  }
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  path.basename(process.argv[1]) === 'esimport' // npx
) {
  await main(process.argv)
}
