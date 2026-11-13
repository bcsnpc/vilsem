# Core 0.8.3 / Renderer 4.46

**Licensing and attribution only. There are no functional changes from 0.8.2 / 4.45.**

## Why

A licence audit found that the renderer bundles 37 third-party open-source packages: Apache ECharts, React, Redux, recharts, the d3 family, DOMPurify and others. The minified build shipped without their copyright and licence notices. It contained only a pointer to a `visual.js.LICENSE.txt` file that a `.pbiviz` never includes. All of these licences are permissive, so there is no licence conflict; their notices simply have to travel with the code.

## Changes

- **Generated notices:** `THIRD_PARTY_NOTICES.md` is built from the renderer's own module graph (webpack's bundle report plus the DOM layer's recorded module list). It contains every bundled package with its version, licence, copyright holders and full licence text. Identical licences are grouped, and ECharts' NOTICE is reproduced (Apache-2.0 §4(d)). DOMPurify is recorded as used under Apache-2.0.
- **Embedded in the renderer:** the notices are a preserved comment at the start of `visual.js`, replacing the dangling pointer.
- **Shipped in the package:** `@vilsem/core` now includes `THIRD_PARTY_NOTICES.md` and a `NOTICE`.
- **Fixed NOTICE:** the root `NOTICE` pointed at the wrong repository; it now points to `bcsnpc/vilsem`.
- **Fails safely:** the generator stops the build for a package with no licence file and no known licence text, rather than inventing one.

## Compatibility

The renderer GUID and `objects.semantica.primitiveSpec` are unchanged, and visuals render identically. Existing reports can keep 4.45. Importing 4.46 only adds the embedded notices.
