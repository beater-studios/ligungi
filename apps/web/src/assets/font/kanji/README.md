# Kanji fonts for the pieces

Subsets of four fonts from [Google Fonts](https://github.com/google/fonts), each cut down to the 14 kanji of the Gungi pieces (帥大中小侍槍馬忍砦兵砲弓筒謀) and saved as WOFF2. The variable fonts were fixed at one weight first. Every subset was renamed in its name table (`ligungi kanji ...`) because it is a modified version; the copyright and license notices inside the files are kept.

All four are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org), which allows bundling them with ligungi (AGPL-3.0-or-later). The full license of each font is in the `OFL-*.txt` file next to it.

| File | Font | Weight | Copyright | License |
|---|---|---|---|---|
| `kanji-brush.woff2` | Yuji Syuku | 400 | 2021 The Yuji Project Authors (https://github.com/Kinutafontfactory/Yuji) | [OFL-yuji-syuku.txt](OFL-yuji-syuku.txt) |
| `kanji-serif.woff2` | Noto Serif JP | 700 | 2012 Google Inc. | [OFL-noto-serif-jp.txt](OFL-noto-serif-jp.txt) |
| `kanji-gothic.woff2` | Noto Sans JP | 900 | 2014-2021 Adobe, with Reserved Font Name 'Source' | [OFL-noto-sans-jp.txt](OFL-noto-sans-jp.txt) |
| `kanji-pop.woff2` | Potta One | 400 | 2020 The Potta Project Authors (https://github.com/go108go/Potta) | [OFL-potta-one.txt](OFL-potta-one.txt) |

To rebuild a subset, use `pyftsubset` from fontTools with `--text` set to the 14 kanji and `--flavor=woff2`, after `fontTools.varLib.instancer` for the variable fonts.
