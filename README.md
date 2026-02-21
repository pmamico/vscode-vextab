[![made-for-VSCode](https://img.shields.io/badge/Made%20for-VSCode-1f425f.svg)]([https://code.visualstudio.com/](https://marketplace.visualstudio.com/items?itemName=MicoPapp.vextab))

# VexTab

Preview and export VexTab guitar tabs (powered by VexFlow) with cursor highlighting and more.

![vscode demo](https://raw.githubusercontent.com/pmamico/vscode-vextab/refs/heads/main/images/example.jpg "VSCode plugin")

## Features

- Live preview for `.vt`, `.vextab`, and `.tab` files
- Export the current document to a PDF

This extension is built on a fork of the upstream VexTab 4.0 project, with additional parser/editor-focused features:

- `\` line continuation for multi-line VexTab input
- Cursor API (editors can highlight the current position while typing)
- `tabstave` and `tuning` settings inherit to newly created `tabstave`s until explicitly overridden
- Document header text: `title`, `subtitle`, `sidenote` (drawn above the first stave)

## Usage

1. Open a VexTab file (`.vt`, `.vextab`, to use quick syntax `.tab`).
2. Run `Open VexTab Preview` from the Command Palette.
3. Optional: run `Export VexTab to PDF` to save a PDF.

## Quick syntax (`.tab`)

The `.tab` extension enables a shorthand format that the extension preprocesses before passing it to the VexTab parser.

- A leading `tabstave` is optional; the extension inserts it when missing.
- A line that looks like `key=value key=value ...` is treated as `tabstave <that line>` (except `tuning=...`, which stays as-is).
- An empty line can be used as a quick `tabstave` opener.

Same content in regular VexTab vs. quick syntax:

```vextab
// song.vt (regular VexTab)
title Autumn Leaves
subtitle (lead sheet excerpt)
sidenote capo 2 - swing

tabstave notation=true tablature=true time=4/4 key=A
notes :8 5/6 7/6 8/6 7/6 | :q 5/6

tabstave notation=true tablature=true time=4/4 key=A
notes :8 5/6 7/6 8/6 7/6 | :q 5/6
```

```vextab
// song.tab (quick syntax)
title Autumn Leaves
subtitle (lead sheet excerpt)
sidenote capo 2 - swing

notation=true tablature=true time=4/4 key=A
notes :8 5/6 7/6 8/6 7/6 | :q 5/6

notes :8 5/6 7/6 8/6 7/6 | :q 5/6
```

## Commands

- `vextab.preview`: Open VexTab Preview
- `vextab.exportPdf`: Export VexTab to PDF


## About VexTab

VexTab is a language that allows you to create, edit, and share music notation and guitar tablature. Unlike ASCII tab (optimized for readability), VexTab is optimized for writeability.  

- Tutorial: http://vexflow.com/vextab/tutorial.html. 

## Issues

Report bugs and feature requests here:   
https://github.com/pmamico/vscode-vextab/issues.  

## Credits

VexTab 4.0: A VexTab Parser for VexFlow.   
