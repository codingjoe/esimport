import assert from 'node:assert'
import { describe, test } from 'node:test'

import * as esimport from 'esimport'

describe('integrityHash', () => {
  test('SHA-512', async () => {
    const hash = await esimport.integrityHash('foo')
    assert.strictEqual(
      hash,
      'sha512-9/u6bgY2+JDlb7vzKD5STG+jIErimDgtYkdB0NxmODJuKCxBvl5CVNiCB3LFUYosWowMf37aGVlKfrU5RT4e1w==',
    )
  })

  test('SHA-384', async () => {
    const hash = await esimport.integrityHash('foo', 'SHA-384')
    assert.strictEqual(
      hash,
      'sha384-mMEf/f3VQGdrGhN8saIrKnA1DJpEFx1rEYDGvly7LuP3nVMsih3Z7y6OCOdSo7q7',
    )
  })

  test('SHA-256', async () => {
    const hash = await esimport.integrityHash('foo', 'SHA-256')
    assert.strictEqual(hash, 'sha256-LCa0a2j/xo/5m0U8HTBBNBNCLXBkg7+g+YpeiGJm564=')
  })

  test('invalid algorithm', async () => {
    await assert.rejects(
      () => esimport.integrityHash('foo', 'invalid'),
      /Unrecognized algorithm name/,
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
})

describe('bundleExports', () => {
  test('exports', async () => {
    assert.deepStrictEqual(
      await esimport.bundleExports('tests/fixtures/fellowship', 'tests/fixtures/'),
      {
        fellowship: 'fellowship/src/index.js',
        'fellowship/hobbits/frodo.js': 'fellowship/src/hobbits/frodo.js',
        'fellowship/hobbits/sam.js': 'fellowship/src/hobbits/sam.js',
      },
    )
  })
})
