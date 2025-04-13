<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./images/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./images/logo-light.svg">
    <img alt="esimport: Cutting edge ESM bundler and importmap generator" src="./images/logo-light.svg">
  </picture>
</p>

## Why

ESM (ECMAScript Modules) is the future of JavaScript in the browser.
It allows you to simply your development workflow and improve browser cacheing.

**esimport** is

* blazing fast (thanks to [esbuild] & [go]),
* easily setup,
* secure,
* and transpiles legacy packages.

In contrast to esm.sh it enables local development, dependabot support
and limits your vulnerability to supply chain attacks.

## Usage

```bash
# esimport <package-root> <output-dir>
npx esimport . ./public/static/
```

[esbuild]: https://esbuild.github.io/
[go]: https://go.dev/
