# ProseArea

## About

ProseArea is a drop-in replacement for HTML textareas, providing [WYSIWYG](https://en.wikipedia.org/wiki/WYSIWYG) editing of [markdown](https://en.wikipedia.org/wiki/Markdown), based on the [ProseMirror](https://prosemirror.net/) web library.

## Design goals

* WYSIWYG markdown editing.
* Plaintext markdown editing.
* Drop-in replacement for HTML textareas.
* UI-framework agnosticism.
* Simplicity of use.

## Installation

You need `yarn` and `rollup` installed.

    yarn install # Same as `npm install` except better.
    rollup -c

Then take a look at `public/index.html` for an example of how to convert HTML textareas into WYSIWYG/markdown editors.
