import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
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

  test('treeshakes unreachable dependency entry points by default', async () => {
    await fs.rm(outputDir, { recursive: true, force: true })
    try {
      const result = await esimport.run(fixtureDir, outputDir, {
        watch: false,
        verbose: false,
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
      assert(files.includes('importmap.json'))
      assert(
        files.some((f) => /^src\/index-.*\.js$/.test(f)),
        'expected kept src/index-*.js',
      )
      assert(
        files.some((f) => /^src\/index-.*\.js\.map$/.test(f)),
        'expected kept src/index-*.js.map',
      )
      assert(
        files.some((f) => /^node_modules\/date-utils\/locale\/index-.*\.js$/.test(f)),
        'expected kept date-utils/locale output',
      )
      assert(
        files.some((f) =>
          /^node_modules\/date-utils\/locale\/index-.*\.js\.map$/.test(f),
        ),
        'expected kept date-utils/locale .map',
      )
      assert(
        !files.some((f) => /^node_modules\/date-utils\/index-.*/.test(f)),
        'unused date-utils output must be removed',
      )
      assert(
        !files.some((f) => /^node_modules\/date-utils\/fp\/index-.*/.test(f)),
        'unused date-utils/fp output must be removed',
      )
    } finally {
      await fs.rm(outputDir, { recursive: true, force: true })
    }
  })

  test('keeps all entry points when treeshake is disabled', async () => {
    await fs.rm(outputDir, { recursive: true, force: true })
    try {
      const result = await esimport.run(fixtureDir, outputDir, {
        watch: false,
        verbose: false,
        treeshake: false,
      })
      assert.deepEqual(Object.keys(result.imports).sort(), [
        'date-utils',
        'date-utils/fp',
        'date-utils/locale',
        'treeshake-app',
      ])
      const files = await listFiles(outputDir)
      assert(
        files.some((f) => /^node_modules\/date-utils\/index-.*\.js$/.test(f)),
        'date-utils output should exist without treeshake',
      )
      assert(
        files.some((f) => /^node_modules\/date-utils\/fp\/index-.*\.js$/.test(f)),
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
