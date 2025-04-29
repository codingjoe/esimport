import assert from 'node:assert'
import process from 'node:process'
import path from 'node:path'
import { describe, mock, test } from 'node:test'

import * as esimport from 'esimport'
import { run } from 'esimport'

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
      esimport.resolveImport([{
        import: {
          types: 'foo.d',
          default: 'foo.mjs',
        },
      }, 'foo.cjs']),
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
        'fellowship': './ring.mjs',
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
      [
        './src/hobbits/sam.js',
        './src/hobbits/frodo.js',
      ],
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
        bar: 'foo',
        qux: 'baz',
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
        [
          'fellowship',
          'fellowship/hobbits/sam.js',
          'fellowship/hobbits/frodo.js',
        ],
      ],
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
        fellowship: './src/index-MTLAIIAI.js',
        'fellowship/hobbits/sam.js': './src/hobbits/sam-LVWKD6NO.js',
        'fellowship/hobbits/frodo.js': './src/hobbits/frodo-7EUGPPXN.js',
      },
      integrity: {
        './src/index-MTLAIIAI.js':
          'sha512-32SQGLXQb+loEHapkAaKYexoCzRiLz1mS/WHHTEqSi+JWe5XBvLEOizSWXYGdKRnXQqjWsm7Co4326h7grz/Mg==',
        './src/hobbits/sam-LVWKD6NO.js':
          'sha512-PtjdOvmN761rp0fqUNGn2hchVI6t+27o2O/5YhY6Ypvhhn8WC+RUqCpL8RRvg2zZz+v54HLplDukLXXZ9s1XUA==',
        './src/hobbits/frodo-7EUGPPXN.js':
          'sha512-UpMiJ/zRrbPDMpbjcdnGBYD8/qP2ZuAl9mHZXgA1A1DCYRCAN2WZb+T3CNrQKVOwbPH3rrEUxGZ156ev3vDmdg==',
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
