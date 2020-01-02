// Everything in this file will eventually be moved to the package's index.js
// file. It is kept here temporarily for development purposes.

class MarkdownView {

    constructor(place, value, editable=true) {
        this.textarea = place.appendChild(document.createElement("textarea"));
        this.textarea.disabled = !editable;
        this.textarea.value = value;
    }

    get content() {
        return this.textarea.value;
    }

    set content(value) {
        this.textarea.value = value;
    }

    focus() {
        this.textarea.focus();
    }

    destroy() {
        this.textarea.remove();
    }
}


class ProseMirrorView {

    constructor(place, value, editable=true) {
        this.place = place;
        this.view = new ProseArea.EditorView(place, {
            state: this.make_editor_state(value),
            editable: function() { return editable; }
        });
    }

    make_editor_state(value) {
        return ProseArea.EditorState.create({
            doc: ProseArea.defaultMarkdownParser.parse(value),
            plugins: ProseArea.exampleSetup({ 'schema': ProseArea.schema })
        });
    }

    get content() {
        return ProseArea.defaultMarkdownSerializer.serialize(this.view.state.doc);
    }

    set content(value) {
        let new_state = this.make_editor_state(value);
        this.view.updateState(new_state);
    }

    focus() {
        this.view.focus();
    }

    destroy() {
        this.view.destroy();
    }
}


function markdownify(target, default_text_type='wysiwyg', translations={}, show_view_buttons=true) {

    // Seamless support for multiple targets. If we've received more than one
    // object, we'll iterate through them and call this very same function
    // again on each one, in which case this iteration will **not** be run,
    // but the remainder of the function instead.
    if (target.length != undefined) {
        for (let i = 0; i < target.length; i++) {
            markdownify(target[i], default_text_type, translations, show_view_buttons);
        }
        return;
    }

    // Make sure that translations are reasonable.
    if (!(translations instanceof Object)) {
        translations = {};
    }
    if (!translations.hasOwnProperty('markdown')) {
        translations['markdown'] = 'Markdown';
    }
    if (!translations.hasOwnProperty('wysiwyg')) {
        translations['wysiwyg'] = 'WYSIWYG';
    }

    // Warn the user if the target has no name, which we need to correctly set
    // up Markdown/WYSIWYG ratio buttons.
    let target_name = target.getAttribute('name');
    if (!target_name) {
        console.error('Markdown/WYSIWYG target textarea should have a name.');
    }

    // Fetch and clear information we need from the target.
    let start_content = target.value;
    let editable = !target.disabled;
    target.innerText = '';

    // Update the target's innerText from the value on form submit to make
    // sure that the value is properly submitted with the form.
    if (target.form) {
        target.form.addEventListener('submit', function(event) {
            target.innerText = target.value;
        });
    }

    // Create a more malleable div called "place" to host the editor, out of
    // the given textarea called "target".
    let place = document.createElement('div');
    target.parentNode.insertBefore(place, target);
    target.style.display = 'none';
    Object.defineProperty(target, 'value', {
        get: function() {
            if (view) {
                return view.content;
            }
        },
        set: function(input_value) {
            if (view) {
                view.content = input_value;
            }
        }
    });

    // Create the appropriate ProseMirror view.
    let View = default_text_type == 'markdown' ? MarkdownView : ProseMirrorView;
    var view = new View(place, start_content, editable);

    if (show_view_buttons) {
        ['markdown', 'wysiwyg'].forEach(text_type => {
            // Create HTML elements for label and radio button.
            let label = document.createElement('label');
            let button = document.createElement('input');

            // Configure the radio button.
            button.setAttribute('name', 'text_type_' + target_name);
            button.setAttribute('type', 'radio');
            button.setAttribute('value', text_type);
            if (text_type == default_text_type) {
                button.setAttribute('checked', 'checked');
            }

            // Add the radio button to the label.
            label.append(button);
            label.append(' ' + translations[text_type]);

            // Place the label (containing the button) immediately following the
            // element that we wish to convert into a WYSIWYG/Markdown editor.
            place.parentNode.insertBefore(label, place);

            // Make the button do stuff.
            button.addEventListener("change", () => {
                // Obviously, the radio button shouldn't do anything unless it's
                // the one being selected.
                if (!button.checked) {
                    return;
                }

                // Figure out whether WYSIWYG or markdown are being selected.
                let View = button.value == "markdown" ? MarkdownView : ProseMirrorView;

                // No need to do anything is current view already selected.
                if (view instanceof View) {
                    return;
                }

                // Re-create view according to selection with content.
                let content = view.content;
                view.destroy();
                view = new View(place, content, editable);
                view.focus();
            });
        });
    }
}
