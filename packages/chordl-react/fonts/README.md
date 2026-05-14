# Bundled SMuFL fonts

`PHBravura.woff2` and `PHPetaluma.woff2` are 6-codepoint subsets of
[Bravura](https://github.com/steinbergmedia/bravura) and
[Petaluma](https://github.com/steinbergmedia/petaluma) by Steinberg Media
Technologies, released under the SIL Open Font License 1.1 (see `OFL.txt`).

Subsetted codepoints:

- `U+E050` gClef (treble clef)
- `U+E062` fClef (bass clef)
- `U+E0A2` noteheadWhole
- `U+E260` accidentalFlat
- `U+E261` accidentalNatural
- `U+E262` accidentalSharp

Renamed to `PHBravura` / `PHPetaluma` per the OFL Reserved Font Name clause —
these are modified versions, not the originals. The originals retain the
"Bravura" and "Petaluma" names.

These files are embedded as base64 in `src/staff-fonts.ts` and injected as
`@font-face` rules at module load. Consumers do not need to host them.
