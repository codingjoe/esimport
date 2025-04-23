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
* secure (sha512 hashes),
* and transpiles legacy packages.

In contrast to esm.sh it enables local development, dependabot support
and limits your vulnerability to supply chain attacks.

## Usage

```bash
# esimport <package-root> <output-dir>
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
$ jq '.' out/imports.json
{
  "imports": {
    "#js/components/myWidget": "src/js/components/myWidget-KWLRK5KY.js",
    "lit": "node_modules/lit/index-W3JFEEGS.js",
    "lit/async-directive.js": "node_modules/lit/async-directive-C4RAQ6VS.js",
    "lit/decorators.js": "node_modules/lit/decorators-RLPUYE5L.js",
    "lit/decorators/custom-element.js": "node_modules/lit/decorators/custom-element-FJZ7OFGY.js",
    "lit/decorators/event-options.js": "node_modules/lit/decorators/event-options-VCSC2PVA.js",
    "lit/decorators/property.js": "node_modules/lit/decorators/property-625S746B.js",
    "lit/decorators/query-all.js": "node_modules/lit/decorators/query-all-4WY4RIME.js",
    "lit/decorators/query-assigned-elements.js": "node_modules/lit/decorators/query-assigned-elements-FO6QWV6X.js",
    "lit/decorators/query-assigned-nodes.js": "node_modules/lit/decorators/query-assigned-nodes-YS5OBBBA.js",
    "lit/decorators/query-async.js": "node_modules/lit/decorators/query-async-PITSY63N.js",
    "lit/decorators/query.js": "node_modules/lit/decorators/query-F3AGC6CR.js",
    "lit/decorators/state.js": "node_modules/lit/decorators/state-XR72DVIX.js",
    "lit/directive-helpers.js": "node_modules/lit/directive-helpers-PVW2LLPD.js",
    "lit/directive.js": "node_modules/lit/directive-GQYAJLBZ.js",
    "lit/directives/async-append.js": "node_modules/lit/directives/async-append-5E6TC3VP.js",
    "lit/directives/async-replace.js": "node_modules/lit/directives/async-replace-CUYJG3RH.js",
    "lit/directives/cache.js": "node_modules/lit/directives/cache-EIMF5U4U.js",
    "lit/directives/choose.js": "node_modules/lit/directives/choose-S743REFY.js",
    "lit/directives/class-map.js": "node_modules/lit/directives/class-map-NK2SJTJW.js",
    "lit/directives/guard.js": "node_modules/lit/directives/guard-ITY2N7UL.js",
    "lit/directives/if-defined.js": "node_modules/lit/directives/if-defined-RKFHFRYO.js",
    "lit/directives/join.js": "node_modules/lit/directives/join-YAV5S2DA.js",
    "lit/directives/keyed.js": "node_modules/lit/directives/keyed-EOGE6QL6.js",
    "lit/directives/live.js": "node_modules/lit/directives/live-RI65YQWX.js",
    "lit/directives/map.js": "node_modules/lit/directives/map-XAXKIJUE.js",
    "lit/directives/range.js": "node_modules/lit/directives/range-TUZNKFTH.js",
    "lit/directives/ref.js": "node_modules/lit/directives/ref-WPW4IMTM.js",
    "lit/directives/repeat.js": "node_modules/lit/directives/repeat-A6VAAUQ4.js",
    "lit/directives/style-map.js": "node_modules/lit/directives/style-map-XLJH2RUL.js",
    "lit/directives/template-content.js": "node_modules/lit/directives/template-content-E47ZXWXZ.js",
    "lit/directives/unsafe-html.js": "node_modules/lit/directives/unsafe-html-PB7SSZLT.js",
    "lit/directives/unsafe-mathml.js": "node_modules/lit/directives/unsafe-mathml-G7BZULGF.js",
    "lit/directives/unsafe-svg.js": "node_modules/lit/directives/unsafe-svg-GN2TL2IU.js",
    "lit/directives/until.js": "node_modules/lit/directives/until-B3GRACPD.js",
    "lit/directives/when.js": "node_modules/lit/directives/when-TAQALBJJ.js",
    "lit/html.js": "node_modules/lit/html-D32TB3NC.js",
    "lit/polyfill-support.js": "node_modules/lit/polyfill-support-4DD4XXKY.js",
    "lit/static-html.js": "node_modules/lit/static-html-WEYEAFSF.js",
  },
  "integrity": {
    "src/js/components/myWidget-KWLRK5KY.js": "sha512-AcfJS2+aGBtNqX5ZPJFJPySC+bmDKC7I64mExuSJM+qnWmSrahd/a94XnsdpyeQWry9DaivErfhxu8avQ3Tiow==",
    "node_modules/lit/index-W3JFEEGS.js": "sha512-CxSTqZXCqTYvL7K0JJtFT5NJdVYp8fJnjXR6pVt/IcC3VAcr+J5EtQsgLR9Q30C0SJD/QmeX+cd6C4T8cbdihg==",
    "node_modules/lit/async-directive-C4RAQ6VS.js": "sha512-bftcjSsligJFPy44umcVoBR8A5Gnaosp6uLUett18w9zNaqfC6BgSFzIErq0Npb1tNUPwwCQckIMjKFyYKAGBg==",
    "node_modules/lit/decorators-RLPUYE5L.js": "sha512-zDE+J+OhoRU8Lle7jSxZVojj8JoWZuqWf2QzvFfF2CWgk4lGycTj8c7rZ3p24OLVDAhe/vUTWsb3gbt5m8JLgw==",
    "node_modules/lit/decorators/custom-element-FJZ7OFGY.js": "sha512-enjhg7GRGlI7MyBxqna9j4N5ohK/Zr4sWkzL47+SJAzJWGjrx5KTnCr+jL+Nw8cIFXztpniQc32lAQc097DF2A==",
    "node_modules/lit/decorators/event-options-VCSC2PVA.js": "sha512-Xgf3EdXE8mytIX1uwxEvq83ZEQ3gpyPbpQxRy+5mlm07EtOM2HQI2/m8XWE7plinTO8EgOY3vsnu522qmsL5GA==",
    "node_modules/lit/decorators/property-625S746B.js": "sha512-6XJxCiSgUqLa4Hmh+u2y0hXj9PRVvVoLo+JcFI6Na9Pp2kstDsCT1VutDVVvmP3pMCmCfUfGoCI5xVdVfYG1sg==",
    "node_modules/lit/decorators/query-all-4WY4RIME.js": "sha512-iEBj2FVEQaX5o6RHqOXgx4K8JojfQXDR/aqKOcb847XHfh2rS9y0JR/5gnzD5QRs7/ocVU+41xDzr8Ysnd4Y+Q==",
    "node_modules/lit/decorators/query-assigned-elements-FO6QWV6X.js": "sha512-mhLNnXkY2fFMe199MQQedkgPPAWkvpV3SYCrjbtPTnAYH6FgSfGX0nk4wUEkDg/AwqwlH01Y5kqSCE8/j/cH2Q==",
    "node_modules/lit/decorators/query-assigned-nodes-YS5OBBBA.js": "sha512-mZUBYPBaJGG3/tzI1RmncHZYm6CvnyexXyeqBsCyAwDpPYJvFD6q8T7JqN+1GBuXq6L3KDPSh/NT6DQvBnfz1Q==",
    "node_modules/lit/decorators/query-async-PITSY63N.js": "sha512-g0wsHu48Eg5nJGkRMOtaDxlNgE7k2BZ8Uw8WXQt9jiXwt8yeIqrxRYX0JFhJBxisUGrBOs28OExcBXj2GiJcSA==",
    "node_modules/lit/decorators/query-F3AGC6CR.js": "sha512-5AEA/IMrodFJN2Pe1QjiCJXIGY5qdOQmWKcvCmrfTdBFsQrebjksbsKZmgXEYodsWo0UAP+gAEp0TL0GyhPpXA==",
    "node_modules/lit/decorators/state-XR72DVIX.js": "sha512-O+OskojaSyfMxsyE0v1cZ5yYtUUE174HMc16iB2S/ObbLj2C9qtxc3DQ1ZaRLDnUg9Mx4W0i5mtEJHRrxCTLSg==",
    "node_modules/lit/directive-helpers-PVW2LLPD.js": "sha512-lEQnIVbIJX+zMkDyTb4jhPhRR2/vZba8WNAaJu4zwjLe7+9kEgMKpsYWw/3sfzPJyCXHfZFTKJ5joiJF8tTLPg==",
    "node_modules/lit/directive-GQYAJLBZ.js": "sha512-c389+eYxccP/mUlZPMTQHqRJMgI3ZzgYOz/Q+yXUFdLwpLELu+Dv1W3A5xaPJKhav94Qpn1x4giz7b37txawyw==",
    "node_modules/lit/directives/async-append-5E6TC3VP.js": "sha512-x3F/0p/m7SiCrbYxiiQHUs80+t474dBN6hGIjdAt4X86zdvjwJkEZDVR16KvfGcL8Owf009m0zQ23x4zRHFuZA==",
    "node_modules/lit/directives/async-replace-CUYJG3RH.js": "sha512-gTDlfO5r9Gm7F3UxWcEz9lFU41ya24fHxwhr9XARZqg2QyYEv2B0sJoXQLNy9uFjT4m4m5s3RD5kQO2bFLSChg==",
    "node_modules/lit/directives/cache-EIMF5U4U.js": "sha512-CoGLEcEab4xDsdJy2uJ7uf83Dgmn3wbN3q7wc8ZrfboAaeXQSOJ9EW819LKf3i9R1oWA4YVG495CzLAU9lHI1A==",
    "node_modules/lit/directives/choose-S743REFY.js": "sha512-bMDQez+fNbM/K0vwND+w+ABKVryhuc81SEAhrXwGrnM37bcvSugtK2pBjs0Vy2dzKXY/DQF8Qw2Rixvaa5IB3Q==",
    "node_modules/lit/directives/class-map-NK2SJTJW.js": "sha512-33xfuKtDQantOXg94LkxeWa+4DdzVlrMtFAlsgzNllrxVHXkLW5MsVMMu41bCkZKS8owKB8GVuG1ritfe58tKw==",
    "node_modules/lit/directives/guard-ITY2N7UL.js": "sha512-+f5w8JkM9yiXTSVGYmPK9snIDWnDv8wo+ewLDI9Smz6+OHuIOPtJBfutFquoxr4njQw+TNUr6Dkrnmw6/Wiv9A==",
    "node_modules/lit/directives/if-defined-RKFHFRYO.js": "sha512-Qx8/CDMs74ILQwvRL2IyM28Y+kVdqCGnnBZE39N2hrjiqBYHf4LZ9C2WETyOsHAEd2q5p4KgQIrj2KUJVtBteQ==",
    "node_modules/lit/directives/join-YAV5S2DA.js": "sha512-V6aJZerw5IQttgIXmOnIipqTEdo2fqjhFfA6zubtFlSYYKU9MWB2i/38uXzEZefxD56Jx4dkOc+iwn48rYPk1Q==",
    "node_modules/lit/directives/keyed-EOGE6QL6.js": "sha512-avqyH5KoYPF7S5LlRdJZ83HWapI9z8NeHJH5Cd168SYHpO5VkjKSawwl4PkuxelGtk6zBUtM4wcU4HzMl5rc+A==",
    "node_modules/lit/directives/live-RI65YQWX.js": "sha512-xLnxNk8dqZcpHUuDQeFjfBVvNhnKXFubzhbqn/8HjDZHCIMshGmuGnjbtaNawWu7tEddQ1Rh6RLE40cNOmxkug==",
    "node_modules/lit/directives/map-XAXKIJUE.js": "sha512-y1JeMeSgiylPFqRWy528lsHdnbb84qUhNHpG1PLyiQ5+vSHDbUE8Ue8FPHXcsPXjsDjg9N2E8G1q1VUWSt3uhA==",
    "node_modules/lit/directives/range-TUZNKFTH.js": "sha512-Q6kVulq5lR6sgJ3HB6Iw3V/balTpGIK7cxvmlfWmw5L3l0y87PLG6AxxIbuQ9U04KmFsd4K27dVB/skZ0bQ6Qw==",
    "node_modules/lit/directives/ref-WPW4IMTM.js": "sha512-FXn8K72+dcpsp4l6tvnxq4rjpsD2qYGnXMU/2YhTitocIvhTYXuTll6OHygM3i1KN9QtcqKucoPfuelmaJP6ew==",
    "node_modules/lit/directives/repeat-A6VAAUQ4.js": "sha512-/qSbtauIOlNv8rcFLUhmU7YteSY5Jh5JLJsYiUjraNh12tcrgsU8GPGywZghvDbl8CriZ32sN7lkFCouvP2F4g==",
    "node_modules/lit/directives/style-map-XLJH2RUL.js": "sha512-lvPc5DQUEVbGjDTJtNzRDBbppXhQMKTDOkm+zb9v+qxwHcjXt1pphKA2+tnNQf0fyzkp1M0806AWwIGD6O4e0A==",
    "node_modules/lit/directives/template-content-E47ZXWXZ.js": "sha512-yhs3vnzHlDzlCU/1zukQMG6bN6Me42+0BZnwylIzVTJs+xUdE30N6orcm4MR6Qa3sKFsqw09BhvUo+KZf8MkTw==",
    "node_modules/lit/directives/unsafe-html-PB7SSZLT.js": "sha512-0CHKrFkpcPU8nIcElxSXa1ghOytPfSvRMXEOu/NnSycWw+WFiCdPvoDa3o1A1wMp3dncuVqqYGE88YYdNJ8Edw==",
    "node_modules/lit/directives/unsafe-mathml-G7BZULGF.js": "sha512-rt4Z7PijjX6akCmCdH+GPRLJykNNWrINHQELWyjlgxBIxQqoqmz/l/fijCFwpNUcLQOoZLwbNLHSBVrGf60FoA==",
    "node_modules/lit/directives/unsafe-svg-GN2TL2IU.js": "sha512-4MMzZLt8DA3TZlZE7WvGHTT3odbTwwrQLdVx7B+6g4ILSTA4CY5f6W5all9lfcMQMmBAFnq3rrf8ZbZSdaV/rQ==",
    "node_modules/lit/directives/until-B3GRACPD.js": "sha512-8qDm7G10BTC5R0tdr8kBWTyCD9bZ45O8lO88moJrF7+jx5CKc3R9V+YWjG5EHiPqBsd0iON8C/FugJ4P9q8CXA==",
    "node_modules/lit/directives/when-TAQALBJJ.js": "sha512-x/luCVJFgCRIJ4B/EnX5YdzhBOC06Vym9zNeY5RKq2BdMB4PcUsCZHEzADfsTRbc7bWQbxm5MIbFaCXHxy8gwg==",
    "node_modules/lit/html-D32TB3NC.js": "sha512-l6Wu6zGNxEsLgMywPIDtbjpO32uhTl15nbMx4X5cavHV/2dVq9fO10dmVSDKL5jyzAgZ2cciU3Og4oWSAyQIFA==",
    "node_modules/lit/polyfill-support-4DD4XXKY.js": "sha512-X9NGqEX/AJ//O8HbRDydj2X3CpWr1I3GP007jXLpVUInEnZu9ZrbfrpCcUPlLq8tILI1LIAGjhG0UYePjDHjXA==",
    "node_modules/lit/static-html-WEYEAFSF.js": "sha512-qByCeNzJeTZupu2EZDkQCouJIYWG+nfoD1W3sBOL9G3NinYmlt/wnl9BxM4ow+sxYrhVJSbUCRC6GmhWewsWiQ==",
  }
}
```

[esbuild]: https://esbuild.github.io/
[go]: https://go.dev/
[Lit]: https://lit.dev/
