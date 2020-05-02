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

If you only want to start using ProseArea to turn textareas on your webpage to fully-functional WYSIWYG editors spouting out beautiful markdown, then everything you need is in `public/js`.

To see how to use it, take a look at `public/demo.html` for an example of how to convert HTML textareas into WYSIWYG/markdown editors.

Once a textarea has been turned into a WYSIWYG editor, you can read and write its content through the regular `value` property of the textarea, as shown in the example (`public/demo.html`). On GET and POST submissions, the editor's content will be delivered in markdown format with the textarea's name as a variable.

One of ProseArea's most important design goals is ease-of-use without in-depth knowledge of ProseMirror. If you have any kind of trouble using ProseArea, please let the authors know, since that indicates a need to make it even simpler.

### Notes on usage

When ProseArea is applied to a `<textarea/>` (as per `public/demo.html`), it gains the CSS class `prosearea-instance`, which you can use to apply your own styles to it.

In particular, if you are applying it to already existing web designs, you might want to play around with CSS styles `display`, `float`, and dimension styles such as `max-width`. This is because ProseArea turns `<textarea/>` nodes into `<div/>` nodes, which behave differently with regard to available space and such.

## Building

ProseArea is developed using Node.js, which you are expected to be at least mildly familiar with.

You need `yarn` (or at least `npm`) and `rollup` installed to **build** ProseArea.

Note that building is not necessary if you just want to start using it. You only need to do this if you want to play around with the code or partake in ProseArea's development.

    yarn install # Same as `npm install` except better.
    rollup -c

## License

Distributed under the MIT license as detailed in the file `LICENSE`.

## Authors

* Helgi Hrafn Gunnarsson <helgi@binary.is>
