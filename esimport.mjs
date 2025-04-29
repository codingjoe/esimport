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
import { minimatch } from 'minimatch'
import * as commander from 'commander'
import esimportPkgInfo from './package.json' with { type: 'json' }
import crypto from 'node:crypto'
import handler from 'serve-handler'
import * as http from 'node:http'

/**
 * Generate a hash of the given data using the specified algorithm.
 *
 * @param data {string|Buffer} - The data to hash.
 * @param algorithm {string} - The hashing algorithm to use (default: 'sha512').
 * @return {string} - A base64-encoded hash string with algorithm prefix.
 */
export function integrityHash(data, algorithm = 'sha512') {
  const hash = crypto.createHash(algorithm).update(data).digest('base64')
  return `${algorithm.toLowerCase().replace(/-/, '')}-${hash}`
}

/**
 * The given path is inside another given parent path.
 *
 * @param parent {string} - Absolute parent path.
 * @param child {string} - Absolute child path.
 * @return {boolean} - True, if child inside the parent path.
 */
export function isParentDir(parent, child) {
  const relative = path.relative(parent, child)
  return (relative && !relative.startsWith('..') && !path.isAbsolute(relative))
}

/**
 * Invert an object's keys and values.
 * @param obj {Object.<string,string>} - The object to invert.
 * @return {Object.<string,string>} - The inverse of the given object.
 */
export function invertObject(obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [value, key]))
}

/**
 * Recursively resolve the import paths from a package's entry point.
 *
 * See also: https://nodejs.org/api/packages.html#package-entry-points
 *
 * @param entryPoint {object|string|string[]} - The entry points (import|require|default).
 */
export function resolveImport(entryPoint) {
  if (typeof entryPoint === 'string' || entryPoint === null) {
    return entryPoint
  } else if (Array.isArray(entryPoint)) {
    return resolveImport(entryPoint.filter((e) => typeof e === 'object')[0])
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
 * @param pattern {string} - The subpath pattern to expand.
 * @param cwd {string} - The current working directory.
 */
export async function expandSubpathPattern(pattern, cwd) {
  return (await glob(pattern.replace(/\*/, '{*,**/*}'), {
    cwd,
    nodir: true,
    dotRelative: true,
    ignore: 'node_modules/**',
    posix: true,
  })).filter((filePath) => /\.([mc]?jsx?|tsx?|css|txt|json)$/.test(filePath))
}

/**
 * Resolve a package's entry points.
 *
 * See also: https://nodejs.org/api/packages.html#package-entry-points
 *
 * @param pkgName {string} - The name of the package or # for imports.
 * @param entryPoints {object|string|string[]} - The entry points (exports/imports).
 *
 * @returns {object} - A map of entry points to import paths.
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
 * @param pkgName {string} - The name of the package or # for imports.
 * @param entryPoints {object|string|string[]} - The entry points (exports/imports).
 * @param cwd {string} - The current working directory.
 * @param projectRoot {string} - The root directory of the project.
 * @return {Promise<{object}>} - A map of entry points to their file paths.
 */
export async function expandEntryPoints(pkgName, entryPoints, cwd, projectRoot) {
  const entryPointMap = {}
  const excludePatterns = []
  for (
    const [entryPointPattern, pathPattern] of Object.entries(
      resolveEntryPoints(pkgName, entryPoints),
    )
  ) {
    if (pathPattern === null) {
      excludePatterns.push(entryPointPattern)
    } else {
      for (const subpath of await expandSubpathPattern(pathPattern, cwd)) {
        const importPath = path2EntryPoint(subpath, pathPattern, entryPointPattern)
        entryPointMap[importPath] = path.relative(projectRoot, path.join(cwd, subpath))
      }
    }
  }
  for (const key of Object.keys(entryPointMap)) {
    if (
      excludePatterns.some((pattern) =>
        minimatch(key, pattern.replace(/\*/, '{*,**/*}'), { nocomment: true })
      )
    ) {
      delete entryPointMap[key]
    }
  }
  return entryPointMap
}

export async function bundleExports(cwd, projectRoot) {
  const { default: packageInfo } = await import(
    `file://${path.join(cwd, 'package.json')}`,
    {
      with: { type: 'json' },
    }
  )
  return await expandEntryPoints(
    packageInfo.name,
    packageInfo.exports ||
      { '.': packageInfo.browser || packageInfo.module || packageInfo.main },
    cwd,
    projectRoot,
  )
}

/**
 * Build the project using esbuild.
 *
 * @param projectRoot {string} - The root directory of the project.
 * @param outputDir {string} - The output directory for the importmap.json and its collected ES module files.
 * @param context {esbuild.BuildContext} - The esbuild context.
 * @param entryPointSourceMap {Object.<string,string>} - A map of entry points to their file paths.
 * @param options {Object} - The options for the build process.
 * @return {Promise<Object.<string,Object.<string,string>>>} - A promise that resolves to the import map.
 */
async function build(projectRoot, outputDir, context, entryPointSourceMap, options) {
  const result = await context.rebuild()
  if (options.verbose) {
    console.debug(await esbuild.analyzeMetafile(result.metafile))
  }
  console.info(`${Object.keys(result.metafile.inputs).length} ES modules processed.`)

  const reverseEntryPointMap = invertObject(entryPointSourceMap)

  let entryPointOutputMap = {}
  for (const [name, output] of Object.entries(result.metafile.outputs)) {
    if (output.entryPoint !== undefined) {
      entryPointOutputMap[
        reverseEntryPointMap[path.relative(projectRoot, output.entryPoint)]
      ] = `./${path.relative(outputDir, name)}`
    }
  }

  const port = options.serve === true ? 3000 : options.serve

  const integrity = {}
  for (const value of Object.values(entryPointOutputMap)) {
    const filePath = path.join(outputDir, value)
    const fileContent = await fs.readFile(filePath)
    integrity[options.serve ? path.join(`http://localhost:${port}`, value) : value] =
      integrityHash(fileContent)
  }

  if (options.serve) {
    entryPointOutputMap = Object.fromEntries(
      Object.entries(entryPointOutputMap).map((
        [key, value],
      ) => [key, path.join(`http://localhost:${port}`, value)]),
    )
  }

  const importMap = {
    imports: entryPointOutputMap,
    integrity,
  }

  await fs.writeFile(
    path.join(outputDir, 'importmap.json'),
    JSON.stringify(importMap),
  )

  return importMap
}

/**
 * Watch the output directory for changes and rebuild the project.
 * @param projectRoot {string} - The root directory of the project.
 * @param outputDir {string} - The output directory for the importmap.json and its collected ES module files.
 * @param context {esbuild.BuildContext} - The esbuild context.
 * @param entryPointSourceMap {Object.<string,string>} - A map of entry points to their file paths.
 * @param options {Object} - The options for the build process.
 * @param server {http.Server} - A server object to be gracefully closed on interrupt.
 * @return {Promise<*>}
 */
export async function watch(
  projectRoot,
  outputDir,
  context,
  entryPointSourceMap,
  options,
  server,
) {
  const ac = new AbortController()
  const { signal } = ac
  const watcher = fs.watch(projectRoot, { signal, recursive: true })
  process.on('SIGINT', async () => {
    ac.abort()
    if (server !== undefined) {
      console.info('Gracefully shutting down. Please wait...')
      await server.close(process.exit)
    }
  })
  try {
    for await (const event of watcher) {
      if (!isParentDir(outputDir, path.join(projectRoot, event.filename))) {
        await build(projectRoot, outputDir, context, entryPointSourceMap, options)
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return await context.dispose()
    }
    throw err
  }
}

/**
 * Compile the entry points of a package.
 *
 * @param packageDir {string} - The directory of the package to compile.
 * @return {Promise<[Object.<string, string>, Array.<string>]>} - A promise that resolves to an array containing the entry points and external dependencies.
 */
export async function compileEntryPoints(packageDir) {
  const { default: pkgInfo } = await import(
    `file://${path.join(packageDir, 'package.json')}`,
    {
      with: { type: 'json' },
    }
  )
  let entryPoints = {}
  entryPoints = {
    ...entryPoints,
    ...await expandEntryPoints('', pkgInfo.imports || {}, packageDir, packageDir),
  }
  entryPoints = { ...entryPoints, ...await bundleExports(packageDir, packageDir) }
  for (
    const dep of Object.keys({
      ...pkgInfo.dependencies,
      ...pkgInfo.peerDependencies,
    })
  ) {
    entryPoints = {
      ...entryPoints,
      ...await bundleExports(
        path.join(packageDir, 'node_modules', dep),
        packageDir,
      ),
    }
  }
  return [
    entryPoints,
    Object.keys({
      ...entryPoints,
      ...pkgInfo.dependencies,
      ...pkgInfo.peerDependencies,
    }),
  ]
}

export async function run(packageDir, outputDir, options) {
  packageDir = path.isAbsolute(packageDir)
    ? packageDir
    : path.join(process.cwd(), packageDir)
  outputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.join(process.cwd(), outputDir)

  const [entryPoints, external] = await compileEntryPoints(packageDir)

  const context = await esbuild.context({
    entryPoints: Object.values(entryPoints).map((entryPoint) =>
      path.join(packageDir, entryPoint)
    ),
    bundle: true,
    format: 'esm',
    external,
    outbase: packageDir,
    outdir: outputDir,
    banner: {
      js: `/* Build with esimport version ${esimportPkgInfo.version} */`,
      css: `/* Build with esimport version ${esimportPkgInfo.version} */`,
    },
    entryNames: '[dir]/[name]-[hash]',
    minify: true,
    sourcemap: true,
    platform: 'browser',
    target: 'es2020',
    allowOverwrite: true,
    metafile: true,
  })

  const importMap = await build(packageDir, outputDir, context, entryPoints, options)

  if (options.serve) {
    const server = http.createServer((request, response) => {
      handler(request, response, {
        public: outputDir,
        headers: [{
          source: '**/*.@(js|css|map)',
          headers: [{
            key: 'Cache-Control',
            value: 'max-age=315360000, public, immutable',
          }],
        }, {
          source: '{**/*,*}',
          headers: [{
            key: 'Connection',
            value: 'close',
          }],
        }],
        etag: true,
      })
    })

    const port = options.serve === true ? 3000 : options.serve
    server.listen(port, async () => {
      console.info(`Running at http://localhost:${port}/`)
      await watch(packageDir, outputDir, context, entryPoints, options, server)
    })
  } else if (options.watch) {
    await watch(packageDir, outputDir, context, entryPoints, options)
  } else {
    await context.dispose()
  }
  return importMap
}

/**
 * Parse string to integer and check if it's a valid port.
 *
 * @param value {string} -
 * @param dummyPrevious
 * @return {number}
 */
export function parsePort(value, dummyPrevious) {
  const parsedValue = parseInt(value, 10)
  if (isNaN(parsedValue)) {
    throw new commander.InvalidArgumentError('Not a number.')
  } else if (!(49151 >= parsedValue && parsedValue > 1024)) {
    throw new commander.InvalidArgumentError('Port must be between 1024 and 49151.')
  }
  return parsedValue
}

/**
 * Main function to run the esimport command line tool.
 * @param argv {string[]} - The command line arguments (process.argv).
 * @return {Promise<void>}
 */
export async function main(argv) {
  const program = new commander.Command('esimport')
  await program
    .description(
      'Compile a project into ES modules and generate a browser importmap.',
    )
    .version(esimportPkgInfo.version)
    .option('-w, --watch', 'Watch for changes and rebuild.')
    .option('-v, --verbose', 'Verbose output.')
    .option(
      '-s , --serve [port]',
      'Serve ES modules via HTTP for local development.',
      parsePort,
    )
    .argument(
      '<package-dir>',
      'Path to package that will transformed. The directory must contain a valid package.json file.',
    )
    .argument(
      '<output-dir>',
      'The output directory for the importmap.json and its collected ES module files.',
    )
    .action(run)
  program.parse(argv)
}

/* node:coverage ignore next 6 */
if (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  path.basename(process.argv[1]) === 'esimport' // npx
) {
  await main(process.argv)
}
