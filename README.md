<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./images/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./images/logo-light.svg">
    <img alt="esimport: Blazing fast ESM compiler and importmap generator" src="./images/logo-light.svg">
  </picture>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word.svg">
  <img alt="Baseline: Newly available" src="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word.svg" height="32" align="right">
</picture>

## Why

ESM is the future. _No bundling, no bullsh\*t._

**esimport** is

- 🔥 blazing fast ([esbuild] & [go]),
- 🏆 simpel & modern,
- 🏴‍☠️ secure (sha512 hashes),
- ☎️ and backwards compatible.

<details open>
<summary>Comparison</summary>

|                                 | esimport | esm.sh | jsDelivr |
| ------------------------------- | -------- | ------ | -------- |
| private package support         | ✅       | ❌     | ❌       |
| offline development             | ✅       | ❌     | ❌       |
| dependabot support              | ✅       | ❌     | ❌       |
| integrity support               | ✅       | ❌     | ❌       |
| supply chain attacks protection | ✅       | ❌     | ❌       |
| highly efficient client caching | ✅       | ✅     | ✅       |

</details>

## Usage

```bash
# esimport <package-root> <output-dir> [--watch,--verbose,--help]
npx esimport . ./public/static/
```

That's it!

### Output

Let's assume we have a project with [Lit] and a custom component
defined via `imports`. After running `esimport` we have the following output:

```bash
# the folder containing browser ready ESM files
$ tree -d out
out
├── src
└── node_modules
    ├── lit
    │   ├── decorators
    │   └── directives
```

```bash
# a fully resolved importmap with sha512 hashes
$ jq '.' out/importmap.json
{
  "imports": {
    "#js/components/myWidget": "src/js/components/myWidget-KWLRK5KY.js",
    "lit": "node_modules/lit/index-W3JFEEGS.js",
    "lit/async-directive.js": "node_modules/lit/async-directive-C4RAQ6VS.js",
    "lit/decorators.js": "node_modules/lit/decorators-RLPUYE5L.js",
    // …
  },
  "integrity": {
    "src/js/components/myWidget-KWLRK5KY.js": "sha512-AcfJS2+aGBtNqX5ZPJFJPySC+bmDKC7I64mExuSJM+qnWmSrahd/a94XnsdpyeQWry9DaivErfhxu8avQ3Tiow==",
    "node_modules/lit/index-W3JFEEGS.js": "sha512-CxSTqZXCqTYvL7K0JJtFT5NJdVYp8fJnjXR6pVt/IcC3VAcr+J5EtQsgLR9Q30C0SJD/QmeX+cd6C4T8cbdihg==",
    "node_modules/lit/async-directive-C4RAQ6VS.js": "sha512-bftcjSsligJFPy44umcVoBR8A5Gnaosp6uLUett18w9zNaqfC6BgSFzIErq0Npb1tNUPwwCQckIMjKFyYKAGBg==",
    "node_modules/lit/decorators-RLPUYE5L.js": "sha512-zDE+J+OhoRU8Lle7jSxZVojj8JoWZuqWf2QzvFfF2CWgk4lGycTj8c7rZ3p24OLVDAhe/vUTWsb3gbt5m8JLgw==",
    // …
  }
}
```

[esbuild]: https://esbuild.github.io/
[go]: https://go.dev/
[lit]: https://lit.dev/
