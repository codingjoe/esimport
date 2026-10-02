import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { describe, mock, test } from 'node:test'

import * as esimport from 'esimport'

describe('integrityHashes', () => {
  test('default algorithms', () => {
    assert.deepEqual(
      [...esimport.integrityHashes('foo')],
      [
        'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=',
        'sha384-mMEf/f3VQGdrGhN8saIrKnA1DJpEFx1rEYDGvly7LuP3nVMsih3Z7y6OCOdSo7q7',
        'sha512-9/u6bgY2+JDlb7vzKD5STG+jIErimDgtYkdB0NxmODJuKCxBvl5CVNiCB3LFUYosWowMf37aGVlKfrU5RT4e1w==',
      ],
    )
  })

  test('custom algorithms', () => {
    assert.deepEqual(
      [...esimport.integrityHashes('foo', ['sha512'])],
      [
        'sha512-9/u6bgY2+JDlb7vzKD5STG+jIErimDgtYkdB0NxmODJuKCxBvl5CVNiCB3LFUYosWowMf37aGVlKfrU5RT4e1w==',
      ],
    )
  })

  test('invalid algorithm', () => {
    assert.throws(
      () => [...esimport.integrityHashes('foo', ['invalid'])],
      /Digest method not supported/,
    )
  })
})

describe('path2Import', () => {
  test('filename wildcard', () => {
    assert.strictEqual(esimport.path2EntryPoint('foo.js', './*.js', './*'), 'foo')
  })

  test('path wildcard', () => {
    assert.strictEqual(
      esimport.path2EntryPoint('bar/baz/foo.js', './bar/*.js', './util/*'),
      'util/baz/foo',
    )
  })

  test('no wildcard', () => {
    assert.strictEqual(esimport.path2EntryPoint('foo.js', './foo.js', './foo'), 'foo')
  })

  test('no match', () => {
    assert.throws(
      () => esimport.path2EntryPoint('foo.js', './bar.js', './foo'),
      /Invalid path foo.js for entry point/,
    )
  })
})

describe('isParentDir', () => {
  test('is parent dir', () => {
    assert.strictEqual(
      esimport.isParentDir(
        path.join(process.cwd(), 'tests/fixtures/fellowship'),
        path.join(process.cwd(), 'tests/fixtures/fellowship/src'),
      ),
      true,
    )
  })

  test('is not parent dir', () => {
    assert.strictEqual(
      esimport.isParentDir(
        path.join(process.cwd(), 'tests/fixtures/fellowship/src'),
        path.join(process.cwd(), 'tests/fixtures/fellowship'),
      ),
      false,
    )
  })
})

describe('resolveImport', () => {
  test('string', () => {
    assert.strictEqual(esimport.resolveImport('foo'), 'foo')
  })

  test('import', () => {
    assert.strictEqual(esimport.resolveImport({ import: 'foo', default: 'bar' }), 'foo')
  })

  test('default', () => {
    assert.strictEqual(
      esimport.resolveImport({
        default: 'foo',
        require: 'bar',
      }),
      'foo',
    )
  })

  test('nested', () => {
    assert.strictEqual(
      esimport.resolveImport({
        import: {
          types: 'foo.d',
          default: 'foo',
        },
      }),
      'foo',
    )
  })

  test('list', () => {
    assert.strictEqual(
      esimport.resolveImport([
        {
          import: {
            types: 'foo.d',
            default: 'foo.mjs',
          },
        },
        'foo.cjs',
      ]),
      'foo.mjs',
    )
  })

  test('no entry point', () => {
    assert.throws(() => esimport.resolveImport({}), /No valid entry point found/)
  })
})

describe('resolveEntryPoints', () => {
  test('string', () => {
    assert.deepEqual(esimport.resolveEntryPoints('fellowship', './ring.js'), {
      fellowship: './ring.js',
    })
  })

  test('array', () => {
    assert.deepEqual(
      esimport.resolveEntryPoints('fellowship', ['./ring.js', './gandalf.js']),
      {
        'fellowship/ring.js': './ring.js',
        'fellowship/gandalf.js': './gandalf.js',
      },
    )
  })

  test('object', () => {
    assert.deepEqual(
      esimport.resolveEntryPoints('fellowship', {
        ring: './ring.js',
        gandalf: './gandalf.js',
      }),
      {
        'fellowship/ring': './ring.js',
        'fellowship/gandalf': './gandalf.js',
      },
    )
  })

  test('single entrypoint object', () => {
    assert.deepEqual(
      esimport.resolveEntryPoints('fellowship', {
        default: './ring.mjs',
        node: './ring.cjs',
      }),
      {
        fellowship: './ring.mjs',
      },
    )
  })

  test('invalid', () => {
    assert.throws(
      () => esimport.resolveEntryPoints('fellowship', 9),
      /Invalid entry points for package fellowship/,
    )
  })
})

describe('expandSubpathPattern', () => {
  test('no wildcard', async () => {
    assert.deepEqual(
      await esimport.expandSubpathPattern(
        './src/index.js',
        'tests/fixtures/fellowship',
      ),
      ['./src/index.js'],
    )
  })

  test('wildcard w/ subpath', async () => {
    assert.deepEqual(
      new Set(
        await esimport.expandSubpathPattern('./src/*.js', 'tests/fixtures/fellowship'),
      ),
      new Set([
        './src/index.js',
        './src/dwarfs/gimli.js',
        './src/hobbits/sam.js',
        './src/hobbits/frodo.js',
      ]),
    )
  })

  test('wildcard w/o subpath', async () => {
    assert.deepEqual(
      await esimport.expandSubpathPattern(
        './src/hobbits/*.js',
        'tests/fixtures/fellowship',
      ),
      ['./src/hobbits/sam.js', './src/hobbits/frodo.js'],
    )
  })

  test('no match', async () => {
    assert.deepEqual(
      await esimport.expandSubpathPattern('./src/*.js', 'tests/fixtures/rings'),
      [],
    )
  })
})

describe('expandEntryPoints', () => {
  test('string', async () => {
    assert.deepEqual(
      await esimport.expandEntryPoints(
        'fellowship',
        './src/index.js',
        'tests/fixtures/fellowship',
        'tests/fixtures/fellowship',
      ),
      {
        fellowship: 'src/index.js',
      },
    )
  })

  test('array', async () => {
    assert.deepEqual(
      await esimport.expandEntryPoints(
        'fellowship',
        ['./src/index.js', './src/hobbits/*.js'],
        'tests/fixtures/fellowship',
        'tests/fixtures/fellowship',
      ),
      {
        'fellowship/src/index.js': 'src/index.js',
        'fellowship/src/hobbits/sam.js': 'src/hobbits/sam.js',
        'fellowship/src/hobbits/frodo.js': 'src/hobbits/frodo.js',
      },
    )
  })

  test('object', async () => {
    assert.deepEqual(
      await esimport.expandEntryPoints(
        'fellowship',
        {
          '.': './src/index.js',
          './hobbits/*': './src/hobbits/*.js',
        },
        'tests/fixtures/fellowship',
        'tests/fixtures/fellowship',
      ),
      {
        fellowship: 'src/index.js',
        'fellowship/hobbits/frodo': 'src/hobbits/frodo.js',
        'fellowship/hobbits/sam': 'src/hobbits/sam.js',
      },
    )
  })

  test('exclude', async () => {
    assert.deepEqual(
      await esimport.expandEntryPoints(
        'fellowship',
        {
          '.': './src/index.js',
          './index': null,
          './*': './src/*.js',
          './dwarfs/*': null,
        },
        'tests/fixtures/fellowship',
        'tests/fixtures/fellowship',
      ),
      {
        fellowship: 'src/index.js',
        'fellowship/hobbits/frodo': 'src/hobbits/frodo.js',
        'fellowship/hobbits/sam': 'src/hobbits/sam.js',
      },
    )
  })
})

describe('bundleExports', () => {
  test('exports', async () => {
    assert.deepEqual(
      await esimport.bundleExports(
        path.join(process.cwd(), 'tests/fixtures/fellowship'),
        path.join(process.cwd(), 'tests/fixtures'),
      ),
      {
        fellowship: 'fellowship/src/index.js',
        'fellowship/hobbits/frodo.js': 'fellowship/src/hobbits/frodo.js',
        'fellowship/hobbits/sam.js': 'fellowship/src/hobbits/sam.js',
      },
    )
  })
})

describe('invertObject', () => {
  test('invert object', () => {
    assert.deepEqual(
      esimport.invertObject({
        foo: 'bar',
        baz: 'qux',
      }),
      {
        bar: ['foo'],
        qux: ['baz'],
      },
    )
  })
})

describe('treeShake', () => {
  const projectRoot = '/project'
  const entryPointSourceMap = {
    app: 'src/index.js',
    dep: 'node_modules/dep/index.js',
    'dep/sub': 'node_modules/dep/locale/index.js',
  }

  function makeMetafile() {
    return {
      outputs: {
        '/project/out/app.js': {
          entryPoint: path.join(projectRoot, 'src/index.js'),
          imports: [
            { path: 'dep/sub', kind: 'import-statement', external: false },
            {
              path: '/project/out/chunk.js',
              kind: 'import-statement',
              external: false,
            },
          ],
          cssBundle: '/project/out/styles.css',
          inputs: {},
        },
        '/project/out/app.js.map': {
          entryPoint: undefined,
          imports: [],
          inputs: {},
        },
        '/project/out/dep.js': {
          entryPoint: path.join(projectRoot, 'node_modules/dep/index.js'),
          imports: [],
          inputs: {},
        },
        '/project/out/dep.js.map': {
          entryPoint: undefined,
          imports: [],
          inputs: {},
        },
        '/project/out/dep-locale.js': {
          entryPoint: path.join(projectRoot, 'node_modules/dep/locale/index.js'),
          imports: [],
          inputs: {},
        },
        '/project/out/dep-locale.js.map': {
          entryPoint: undefined,
          imports: [],
          inputs: {},
        },
        '/project/out/styles.css': {
          entryPoint: undefined,
          imports: [],
          inputs: {},
        },
        '/project/out/styles.css.map': {
          entryPoint: undefined,
          imports: [],
          inputs: {},
        },
        '/project/out/chunk.js': {
          entryPoint: undefined,
          imports: [],
          inputs: {},
        },
        '/project/out/chunk.js.map': {
          entryPoint: undefined,
          imports: [],
          inputs: {},
        },
      },
    }
  }

  test('keeps the 1st-party root entry point output', () => {
    const reachable = esimport.treeShake(
      makeMetafile(),
      entryPointSourceMap,
      projectRoot,
    )
    assert(reachable.has('/project/out/app.js'))
  })

  test('keeps a transitively imported dep subpath and drops an unreferenced dep', () => {
    const reachable = esimport.treeShake(
      makeMetafile(),
      entryPointSourceMap,
      projectRoot,
    )
    assert(reachable.has('/project/out/dep-locale.js'))
    assert(!reachable.has('/project/out/dep.js'))
  })

  test('keeps the cssBundle output for a reachable output', () => {
    const reachable = esimport.treeShake(
      makeMetafile(),
      entryPointSourceMap,
      projectRoot,
    )
    assert(reachable.has('/project/out/styles.css'))
  })

  test('keeps split-chunk outputs referenced via imports', () => {
    const reachable = esimport.treeShake(
      makeMetafile(),
      entryPointSourceMap,
      projectRoot,
    )
    assert(reachable.has('/project/out/chunk.js'))
  })

  test('keeps .map companion outputs for reachable outputs', () => {
    const reachable = esimport.treeShake(
      makeMetafile(),
      entryPointSourceMap,
      projectRoot,
    )
    for (const name of [
      '/project/out/app.js.map',
      '/project/out/dep-locale.js.map',
      '/project/out/styles.css.map',
      '/project/out/chunk.js.map',
    ]) {
      assert(reachable.has(name))
    }
    assert(!reachable.has('/project/out/dep.js.map'))
  })
})

describe('compileEntryPoints', () => {
  test('compile entry points', async () => {
    assert.deepEqual(
      await esimport.compileEntryPoints(
        path.join(import.meta.dirname, 'fixtures/fellowship'),
      ),
      [
        {
          fellowship: 'src/index.js',
          'fellowship/hobbits/sam.js': 'src/hobbits/sam.js',
          'fellowship/hobbits/frodo.js': 'src/hobbits/frodo.js',
        },
        ['fellowship', 'fellowship/hobbits/sam.js', 'fellowship/hobbits/frodo.js'],
      ],
    )
  })
})

describe('UnenvResolvePlugin', () => {
  test('onResolve', async () => {
    const plugin = new esimport.UnenvResolvePlugin()
    const onResolve = mock.fn()
    const build = { onResolve }
    plugin.setup(build)
    assert.deepEqual(onResolve.mock.calls[0].arguments, [
      {
        filter:
          /^(node:)?(assert|assert\/strict|async_hooks|buffer|child_process|cluster|console|constants|crypto|dgram|diagnostics_channel|dns|dns\/promises|domain|events|fs|fs\/promises|http|http2|https|inspector|inspector\/promises|module|net|os|path|path\/posix|path\/win32|perf_hooks|process|punycode|querystring|readline|readline\/promises|repl|stream|stream\/consumers|stream\/promises|stream\/web|string_decoder|sys|timers|timers\/promises|tls|trace_events|tty|url|util|util\/types|v8|vm|wasi|worker_threads|zlib)$/,
      },
      esimport.UnenvResolvePlugin.unenvCallback,
    ])
  })

  test('unenvCallback', async () => {
    assert.deepEqual(await esimport.UnenvResolvePlugin.unenvCallback({ path: 'url' }), {
      external: false,
      path: path.join(
        import.meta.dirname,
        `../node_modules/unenv/dist/runtime/node/url.mjs`,
      ),
    })

    assert.deepEqual(
      await esimport.UnenvResolvePlugin.unenvCallback({ path: 'node:url' }),
      {
        external: false,
        path: path.join(
          import.meta.dirname,
          `../node_modules/unenv/dist/runtime/node/url.mjs`,
        ),
      },
    )
  })
})

describe('run', () => {
  test('run', async () => {
    const result = await esimport.run(
      path.join(import.meta.dirname, 'fixtures/fellowship'),
      path.join(import.meta.dirname, 'fixtures/out'),
      { watch: false, verbose: true },
    )
    assert.deepEqual(result, {
      imports: {
        fellowship: './src/index-5CNBNISI.js',
        'fellowship/hobbits/sam.js': './src/hobbits/sam-7ELSRYCS.js',
        'fellowship/hobbits/frodo.js': './src/hobbits/frodo-FZ7H44GR.js',
      },
      integrity: {
        './src/index-5CNBNISI.js':
          'sha256-aWHHZl6Ab+ebgKSfedgLn7DRB6zEBj/L6okCLUgHJYs= sha384-MNjMdiXxqZHO93KFYvmoUlFT86FTYhURRkIMHXTaX1lLcXmWEg++jpL4+K7xTGUU sha512-nv0Ec/zpZs4RaJ/mthHXx5svoqVWI9fPmcaWNORcJtgL5oA6f4T1TBRlH3O9Ub2mU97iWvjBlbp6YOUQWNDnMg==',
        './src/hobbits/sam-7ELSRYCS.js':
          'sha256-txTKu1EhJ4Mq0iors/uL8tMO7V+AqG90QcdFaqgG2vU= sha384-tMxfgNVE/YvmzLVLJ002KZ5DT1w2XX/C3NVPrujb8DTuKd5Ta9MZoy6+BKrCwy/Q sha512-Wb9ncsSVlqx2ZYUSxczNlGFmZAByAopG8Lp/AibCc2D2ZQPwmxletnoj8Yc0kkxhoMYBWnMI39ccVcLgT2UpGA==',
        './src/hobbits/frodo-FZ7H44GR.js':
          'sha256-75BZz/UpPligxcmAdJnH+TJd/CIyRSjLA54xBpnRakQ= sha384-7mjoGvP3jSYReNFlnO6afThCYcCfvesfEDNcFTyAy3SAv5nJRCkYQ3ptT7kn43AK sha512-7dyswrItDz1PnA44eyfyzvWT1BqBf3AVXfBay914dNi3dJUSTOa0LE2zyGT/b+lNNNPLAS/+P87BL24pMsZZAA==',
      },
    })
  })
})

describe('run (treeshake)', () => {
  const fixtureDir = path.join(import.meta.dirname, 'fixtures/treeshake')
  const outputDir = path.join(import.meta.dirname, 'fixtures/treeshake/out')

  async function listFiles(dir) {
    const files = []
    for (const entry of await fs.readdir(dir, { recursive: true })) {
      if ((await fs.stat(path.join(dir, entry))).isFile()) files.push(entry)
    }
    return files.sort()
  }

  test('treeshakes unreachable dependency entry points when enabled', async () => {
    await fs.rm(outputDir, { recursive: true, force: true })
    try {
      const result = await esimport.run(fixtureDir, outputDir, {
        watch: false,
        verbose: false,
        treeshake: true,
      })
      assert.deepEqual(Object.keys(result.imports).sort(), [
        'date-utils/locale',
        'treeshake-app',
      ])
      assert.deepEqual(
        Object.keys(result.integrity).sort(),
        Object.values(result.imports).sort(),
      )
      const files = await listFiles(outputDir)
      const outputFiles = files.join('\n')
      assert(files.includes('importmap.json'))
      assert.match(outputFiles, /^src\/index-.*\.js$/m, 'expected kept src/index-*.js')
      assert.match(
        outputFiles,
        /^src\/index-.*\.js\.map$/m,
        'expected kept src/index-*.js.map',
      )
      assert.match(
        outputFiles,
        /^node_modules\/date-utils\/locale\/index-.*\.js$/m,
        'expected kept date-utils/locale output',
      )
      assert.match(
        outputFiles,
        /^node_modules\/date-utils\/locale\/index-.*\.js\.map$/m,
        'expected kept date-utils/locale .map',
      )
      assert.doesNotMatch(
        outputFiles,
        /^node_modules\/date-utils\/index-.*/m,
        'unused date-utils output must be removed',
      )
      assert.doesNotMatch(
        outputFiles,
        /^node_modules\/date-utils\/fp\/index-.*/m,
        'unused date-utils/fp output must be removed',
      )
    } finally {
      await fs.rm(outputDir, { recursive: true, force: true })
    }
  })

  test('keeps all entry points by default', async () => {
    await fs.rm(outputDir, { recursive: true, force: true })
    try {
      const result = await esimport.run(fixtureDir, outputDir, {
        watch: false,
        verbose: false,
      })
      assert.deepEqual(Object.keys(result.imports).sort(), [
        'date-utils',
        'date-utils/fp',
        'date-utils/locale',
        'treeshake-app',
      ])
      const outputFiles = (await listFiles(outputDir)).join('\n')
      assert.match(
        outputFiles,
        /^node_modules\/date-utils\/index-.*\.js$/m,
        'date-utils output should exist without treeshake',
      )
      assert.match(
        outputFiles,
        /^node_modules\/date-utils\/fp\/index-.*\.js$/m,
        'date-utils/fp output should exist without treeshake',
      )
    } finally {
      await fs.rm(outputDir, { recursive: true, force: true })
    }
  })
})

describe('parsePort', () => {
  test('parsePort', () => {
    assert.deepEqual(esimport.parsePort('3000'), 3000)
    assert.throws(
      () => esimport.parsePort('80'),
      /Port must be between 1024 and 49151./,
    )
    assert.throws(() => esimport.parsePort('foo'), /Not a number./)
  })
})

describe('main', () => {
  test('main', async () => {
    await esimport.main([
      'node',
      import.meta.dirname,
      path.join(import.meta.dirname, 'fixtures/fellowship'),
      path.join(import.meta.dirname, 'fixtures/out'),
    ])
  })
})

const pnpmDependencies = {
  leftpad: '1.0.0',
  'lodash.escape': '4.0.1',
  widget: '1.0.0',
}

const symlinksSupported = await (async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'esimport-symlink-'))
  try {
    await fs.symlink(os.tmpdir(), path.join(dir, 'link'), 'junction')
    return true
  } catch {
    return false
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})()

const symlinkSkip = symlinksSupported
  ? false
  : 'symlinks are not supported on this platform'

async function tempDir(prefix) {
  return await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)))
}

async function makePnpmWorkspace() {
  const workspace = await tempDir('esimport-pnpm-')
  await fs.cp(path.join(import.meta.dirname, 'fixtures/pnpm'), workspace, {
    recursive: true,
  })
  await fs.mkdir(path.join(workspace, 'node_modules'), { recursive: true })
  for (const [name, version] of Object.entries(pnpmDependencies)) {
    await fs.symlink(
      path.join(
        workspace,
        'node_modules',
        '.pnpm',
        `${name}@${version}`,
        'node_modules',
        name,
      ),
      path.join(workspace, 'node_modules', name),
      'junction',
    )
  }
  return workspace
}

describe('expandSubpathPattern (pnpm fixture)', () => {
  test('drops declaration files', async () => {
    const widget = path.join(
      import.meta.dirname,
      'fixtures/pnpm/node_modules/.pnpm/widget@1.0.0/node_modules/widget',
    )
    assert.deepEqual((await esimport.expandSubpathPattern('./dist/*', widget)).sort(), [
      './dist/chart.js',
      './dist/index.js',
      './dist/unused.js',
    ])
  })
})

describe('bundleExports fallbacks', () => {
  const fallbacks = [
    ['browser', 'fallback-browser', 'browser.js'],
    ['module', 'fallback-module', 'module.js'],
    ['main', 'fallback-main', 'main.js'],
    ['implicit', 'fallback-implicit', 'index.js'],
  ]
  for (const [dir, name, entry] of fallbacks) {
    test(`uses the ${dir} field`, async () => {
      assert.deepEqual(
        await esimport.bundleExports(
          path.join(import.meta.dirname, 'fixtures/fallbacks', dir),
          path.join(import.meta.dirname, 'fixtures/fallbacks'),
        ),
        { [name]: `${dir}/${entry}` },
      )
    })
  }
})

describe('pnpm symlinked node_modules', () => {
  const widgetEntries = {
    'widget/chart.js':
      'node_modules/.pnpm/widget@1.0.0/node_modules/widget/dist/chart.js',
    'widget/index.js':
      'node_modules/.pnpm/widget@1.0.0/node_modules/widget/dist/index.js',
    'widget/unused.js':
      'node_modules/.pnpm/widget@1.0.0/node_modules/widget/dist/unused.js',
  }

  test('compileEntryPoints names symlinked dependencies', {
    skip: symlinkSkip,
  }, async () => {
    const workspace = await makePnpmWorkspace()
    try {
      const [entryPoints, external] = await esimport.compileEntryPoints(workspace)
      assert.deepEqual(entryPoints, {
        'pnpm-app': 'src/index.js',
        leftpad: 'node_modules/.pnpm/leftpad@1.0.0/node_modules/leftpad/index.js',
        'lodash.escape':
          'node_modules/.pnpm/lodash.escape@4.0.1/node_modules/lodash.escape/index.js',
        ...widgetEntries,
      })
      assert.deepEqual(
        external.sort(),
        [
          'pnpm-app',
          'leftpad',
          'lodash.escape',
          'widget/chart.js',
          'widget/index.js',
          'widget/unused.js',
          'widget',
        ].sort(),
      )
    } finally {
      await fs.rm(workspace, { recursive: true, force: true })
    }
  })

  test('bundleExports resolves a symlinked package', {
    skip: symlinkSkip,
  }, async () => {
    const workspace = await makePnpmWorkspace()
    try {
      assert.deepEqual(
        await esimport.bundleExports(
          path.join(workspace, 'node_modules', 'widget'),
          workspace,
        ),
        widgetEntries,
      )
    } finally {
      await fs.rm(workspace, { recursive: true, force: true })
    }
  })

  test('expandEntryPoints resolves symlinked subpaths', {
    skip: symlinkSkip,
  }, async () => {
    const workspace = await makePnpmWorkspace()
    try {
      assert.deepEqual(
        await esimport.expandEntryPoints(
          'widget',
          { './*': './dist/*' },
          path.join(workspace, 'node_modules', 'widget'),
          workspace,
        ),
        widgetEntries,
      )
    } finally {
      await fs.rm(workspace, { recursive: true, force: true })
    }
  })

  test('run names and treeshakes dependency entries through a symlinked project', {
    skip: symlinkSkip,
  }, async () => {
    const workspace = await makePnpmWorkspace()
    const outputRoot = await tempDir('esimport-pnpm-out-')
    const outputDir = path.join(outputRoot, 'out')
    const projectLink = path.join(outputRoot, 'pnpm-app')
    await fs.symlink(workspace, projectLink, 'junction')
    try {
      const result = await esimport.run(projectLink, outputDir, {
        watch: false,
        verbose: false,
        treeshake: true,
      })
      assert.deepEqual(Object.keys(result.imports).sort(), [
        'leftpad',
        'lodash.escape',
        'pnpm-app',
        'widget/chart.js',
      ])
      assert.deepEqual(
        Object.keys(result.integrity).sort(),
        Object.values(result.imports).sort(),
      )
      const files = []
      for (const entry of await fs.readdir(outputDir, { recursive: true })) {
        if ((await fs.stat(path.join(outputDir, entry))).isFile()) {
          files.push(entry)
        }
      }
      const outputFiles = files.join('\n')
      assert.match(outputFiles, /^importmap\.json$/m)
      assert.match(
        outputFiles,
        /^node_modules\/\.pnpm\/leftpad@1\.0\.0\/node_modules\/leftpad\/index-.*\.js$/m,
      )
      assert.match(
        outputFiles,
        /^node_modules\/\.pnpm\/lodash\.escape@4\.0\.1\/node_modules\/lodash\.escape\/index-.*\.js$/m,
      )
      assert.match(
        outputFiles,
        /^node_modules\/\.pnpm\/widget@1\.0\.0\/node_modules\/widget\/dist\/chart-.*\.js$/m,
      )
      assert.doesNotMatch(outputFiles, /widget\/dist\/index-/)
      assert.doesNotMatch(outputFiles, /widget\/dist\/unused-/)
    } finally {
      await fs.rm(outputRoot, { recursive: true, force: true })
      await fs.rm(workspace, { recursive: true, force: true })
    }
  })
})

describe('isMainModule', () => {
  const moduleFile = path.resolve(import.meta.dirname, '../esimport.mjs')

  test('true for a symlinked entry point', { skip: symlinkSkip }, async () => {
    const dir = await tempDir('esimport-link-')
    try {
      const link = path.join(dir, 'esimport.mjs')
      await fs.symlink(moduleFile, link)
      assert.strictEqual(await esimport.isMainModule(['node', link]), true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  test('false for another module', async () => {
    assert.strictEqual(
      await esimport.isMainModule(['node', import.meta.filename]),
      false,
    )
  })

  test('false for a missing argv[1]', async () => {
    assert.strictEqual(await esimport.isMainModule(['node']), false)
  })

  test('false for a path that does not exist', async () => {
    assert.strictEqual(
      await esimport.isMainModule([
        'node',
        path.join(import.meta.dirname, 'fixtures/not-a-module.mjs'),
      ]),
      false,
    )
  })
})

describe('CLI through a symlinked bin', () => {
  test('writes the import map', { skip: symlinkSkip }, async () => {
    const dir = await tempDir('esimport-cli-')
    const outputDir = path.join(dir, 'out')
    try {
      const link = path.join(dir, 'esimport.mjs')
      await fs.symlink(path.resolve(import.meta.dirname, '../esimport.mjs'), link)
      const { status, stderr } = spawnSync(
        process.execPath,
        [link, path.join(import.meta.dirname, 'fixtures/fellowship'), outputDir],
        { cwd: dir, encoding: 'utf8' },
      )
      assert.strictEqual(status, 0, stderr)
      const importMap = JSON.parse(
        await fs.readFile(path.join(outputDir, 'importmap.json'), 'utf8'),
      )
      assert.deepEqual(Object.keys(importMap.imports).sort(), [
        'fellowship',
        'fellowship/hobbits/frodo.js',
        'fellowship/hobbits/sam.js',
      ])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
