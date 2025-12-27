import assert from 'node:assert'
import process from 'node:process'
import path from 'node:path'
import { describe, mock, test } from 'node:test'

import * as esimport from 'esimport'
import { run, UnenvResolvePlugin } from 'esimport'

describe('integrityHash', () => {
  test('SHA-512', () => {
    const hash = esimport.integrityHash('foo')
    assert.strictEqual(
      hash,
      'sha512-9/u6bgY2+JDlb7vzKD5STG+jIErimDgtYkdB0NxmODJuKCxBvl5CVNiCB3LFUYosWowMf37aGVlKfrU5RT4e1w==',
    )
  })

  test('SHA-384', () => {
    const hash = esimport.integrityHash('foo', 'sha384')
    assert.strictEqual(
      hash,
      'sha384-mMEf/f3VQGdrGhN8saIrKnA1DJpEFx1rEYDGvly7LuP3nVMsih3Z7y6OCOdSo7q7',
    )
  })

  test('SHA-256', () => {
    const hash = esimport.integrityHash('foo', 'sha256')
    assert.strictEqual(hash, 'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=')
  })

  test('invalid algorithm', async () => {
    await assert.throws(
      () => esimport.integrityHash('foo', 'invalid'),
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
    assert.deepStrictEqual(esimport.resolveEntryPoints('fellowship', './ring.js'), {
      fellowship: './ring.js',
    })
  })

  test('array', () => {
    assert.deepStrictEqual(
      esimport.resolveEntryPoints('fellowship', ['./ring.js', './gandalf.js']),
      {
        'fellowship/ring.js': './ring.js',
        'fellowship/gandalf.js': './gandalf.js',
      },
    )
  })

  test('object', () => {
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
      await esimport.expandSubpathPattern(
        './src/index.js',
        'tests/fixtures/fellowship',
      ),
      ['./src/index.js'],
    )
  })

  test('wildcard w/ subpath', async () => {
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
      await esimport.expandSubpathPattern(
        './src/hobbits/*.js',
        'tests/fixtures/fellowship',
      ),
      ['./src/hobbits/sam.js', './src/hobbits/frodo.js'],
    )
  })

  test('no match', async () => {
    assert.deepStrictEqual(
      await esimport.expandSubpathPattern('./src/*.js', 'tests/fixtures/rings'),
      [],
    )
  })
})

describe('expandEntryPoints', () => {
  test('string', async () => {
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(
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

describe('compileEntryPoints', () => {
  test('compile entry points', async () => {
    assert.deepStrictEqual(
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
    assert.deepStrictEqual(onResolve.mock.calls[0].arguments, [
      {
        filter:
          /^(node:)?(assert|assert\/strict|async_hooks|buffer|child_process|cluster|console|constants|crypto|dgram|diagnostics_channel|dns|dns\/promises|domain|events|fs|fs\/promises|http|http2|https|inspector|inspector\/promises|module|net|os|path|path\/posix|path\/win32|perf_hooks|process|punycode|querystring|readline|readline\/promises|repl|stream|stream\/consumers|stream\/promises|stream\/web|string_decoder|sys|timers|timers\/promises|tls|trace_events|tty|url|util|util\/types|v8|vm|wasi|worker_threads|zlib)$/,
      },
      esimport.UnenvResolvePlugin.unenvCallback,
    ])
  })

  test('unenvCallback', async () => {
    assert.deepStrictEqual(
      await esimport.UnenvResolvePlugin.unenvCallback({ path: 'url' }),
      {
        external: false,
        path: path.join(
          import.meta.dirname,
          `../node_modules/unenv/dist/runtime/node/url.mjs`,
        ),
      },
    )

    assert.deepStrictEqual(
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
    assert.deepStrictEqual(result, {
      imports: {
        fellowship: './src/index-5CNBNISI.js',
        'fellowship/hobbits/sam.js': './src/hobbits/sam-7ELSRYCS.js',
        'fellowship/hobbits/frodo.js': './src/hobbits/frodo-FZ7H44GR.js',
      },
      integrity: {
        './src/index-5CNBNISI.js':
          'sha512-nv0Ec/zpZs4RaJ/mthHXx5svoqVWI9fPmcaWNORcJtgL5oA6f4T1TBRlH3O9Ub2mU97iWvjBlbp6YOUQWNDnMg==',
        './src/hobbits/sam-7ELSRYCS.js':
          'sha512-Wb9ncsSVlqx2ZYUSxczNlGFmZAByAopG8Lp/AibCc2D2ZQPwmxletnoj8Yc0kkxhoMYBWnMI39ccVcLgT2UpGA==',
        './src/hobbits/frodo-FZ7H44GR.js':
          'sha512-7dyswrItDz1PnA44eyfyzvWT1BqBf3AVXfBay914dNi3dJUSTOa0LE2zyGT/b+lNNNPLAS/+P87BL24pMsZZAA==',
      },
    })
  })
})

describe('parsePort', () => {
  test('parsePort', () => {
    assert.deepStrictEqual(esimport.parsePort('3000'), 3000)
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
