global.require = require;
const assert = require('chai').assert;
const jsdom = require('jsdom').jsdom;
const NeovimStore = require('../../src/out/neovim/store').default;
const NeovimInput = require('../../src/out/neovim/input').default;

(function(){
var window;

function keydownEvent(opts) {
    const o = opts || {};
    if (o.keyCode) {
        o.charCode = o.which = o.keyCode;
    } else if (o.key !== undefined) {
        o.keyCode = o.charCode = o.which = o.key.charCodeAt(0);
    } else {
        throw 'Invalid options for KeyboardEvent';
    }
    return new window.KeyboardEvent('keydown', o);
}

function dispatchKeydown(opts) {
    return global.input_element.dispatchEvent(keydownEvent(opts));
}

function inputByKeydown(opts) {
    global.last_input = '';
    dispatchKeydown(opts);
    const i = global.last_input;
    global.last_input = '';
    return i;
}

function dispatchInputEvent() {
    global.input_element.dispatchEvent(
        new window.Event('input', {
            bubbles: true,
            cancelable: false
        })
    );
}

function catchInputOnInputEvent(i) {
    global.last_input = '';
    global.input_element.value = i;
    dispatchInputEvent();
    const tmp = global.last_input;
    global.last_input = '';
    return tmp;
}

describe('NeovimInput', () => {
    before(() => {
        /* global document input_element window input last_input */
        global.document = jsdom('<body><input class="neovim-input"/></body>');
        global.input_element = document.querySelector('.neovim-input');
        input_element.value = '';
        window = document.defaultView;
        const s = new NeovimStore();
        /* eslint no-unused-vars:0 */
        global.input = new NeovimInput(s);
        global.last_input = '';
        s.on('input', i => {
            global.last_input = i;
        });
    });

    after(() => {
        delete global.document;
        delete global.input;
        delete global.input_element;
    });

    it('focuses on an input element on initialization', () => {
        assert.equal(document.activeElement.className, 'neovim-input');
    });

    context("on 'keydown' event", () => {
        it('ignores normal char input without modifiers', () => {
            global.last_input = '';

            dispatchKeydown({key: 'a'});
            assert.equal(last_input, '');

            dispatchKeydown({key: '['});
            assert.equal(last_input, '');

            dispatchKeydown({key: '3', shiftKey: true});
            assert.equal(last_input, '');

            dispatchKeydown({key: 'あ'});
            assert.equal(last_input, '');
        });

        it('accepts input with ctrl key', () => {
            assert.equal(inputByKeydown({key: '\u0001', ctrlKey: true}), '\u0001');  // <C-a>
            assert.equal(inputByKeydown({key: '\u000f', ctrlKey: true}), '\u000f');  // <C-o>
            // Note: Ctrl key input is omitted in many Ctrl+{number} or Ctrl+{sign} sequences.
            assert.equal(inputByKeydown({key: '3', ctrlKey: true}), '3');
        });

        it('accepts input with alt key', () => {
            assert.equal(inputByKeydown({key: ',', altKey: true}), '<A-,>');
            assert.equal(inputByKeydown({key: 'r', altKey: true}), '<A-r>');
            assert.equal(inputByKeydown({key: '4', altKey: true}), '<A-4>');
        });

        it('accepts input with alt+ctrl keys', () => {
            assert.equal(inputByKeydown({key: '\u0001', ctrlKey: true, altKey: true}), '<A-\u0001>');  // Ctrl is included in \u0001
            assert.equal(inputByKeydown({key: '\u000f', ctrlKey: true, altKey: true}), '<A-\u000f>');  // Ctrl is included in \u000f
        });

        it('accepts special keys', () => {
            assert.equal(inputByKeydown({key: 'Tab'}), '<Tab>');
            assert.equal(inputByKeydown({key: 'Tab', altKey: true}), '<A-Tab>');
            assert.equal(inputByKeydown({key: 'Tab', ctrlKey: true, shiftKey: true}), '<C-S-Tab>');
            assert.equal(inputByKeydown({key: 'Enter'}), '<CR>');
            assert.equal(inputByKeydown({key: 'Enter', altKey: true}), '<A-CR>');
            assert.equal(inputByKeydown({key: 'Enter', ctrlKey: true, shiftKey: true}), '<C-S-CR>');
            assert.equal(inputByKeydown({key: 'ArrowLeft'}), '<Left>');
            assert.equal(inputByKeydown({key: 'ArrowLeft', altKey: true}), '<A-Left>');
            assert.equal(inputByKeydown({key: 'ArrowLeft', ctrlKey: true, shiftKey: true}), '<C-S-Left>');
            assert.equal(inputByKeydown({key: '<', ctrlKey: true, shiftKey: true}), '<C-LT>');
            assert.equal(inputByKeydown({key: '<', altKey: true, shiftKey: true}), '<A-LT>');
            assert.equal(inputByKeydown({key: '\0'}), '<Nul>');
        });

        it('handles <CR>, <Esc>, <BS> and <C-m>, <C-[>, <C-h> edge cases', () => {
            assert.equal(inputByKeydown({key: 'Enter', keyCode: 13}), '<CR>');
            assert.equal(inputByKeydown({key: 'Enter', keyCode: 77, ctrlKey: true}), '<C-m>');
            assert.equal(inputByKeydown({key: 'Enter', keyCode: 13, ctrlKey: true}), '<C-CR>');

            assert.equal(inputByKeydown({key: 'Escape', keyCode: 27}), '<Esc>');
            assert.equal(inputByKeydown({key: 'Escape', keyCode: 219, ctrlKey: true}), '<C-[>');
            assert.equal(inputByKeydown({key: 'Escape', keyCode: 27, ctrlKey: true}), '<C-Esc>');

            assert.equal(inputByKeydown({key: 'Backspace', keyCode: 8}), '<BS>');
            assert.equal(inputByKeydown({key: 'Backspace', keyCode: 72, ctrlKey: true}), '<C-h>');
            assert.equal(inputByKeydown({key: 'Backspace', keyCode: 8, ctrlKey: true}), '<C-BS>');

            assert.equal(inputByKeydown({key: 'Tab', keyCode: 9}), '<Tab>');
            assert.equal(inputByKeydown({key: 'Tab', keyCode: 73, ctrlKey: true}), '<C-i>');
            assert.equal(inputByKeydown({key: 'Tab', keyCode: 9, ctrlKey: true}), '<C-Tab>');
        });

        context("when alt key is disabled", () => {
            it('ignores event.altKey', () => {
                global.input.store.alt_key_disabled = true;
                global.last_input = '';

                dispatchKeydown({key: 'a', altKey: true});
                assert.equal(last_input, 'a');

                assert.equal(inputByKeydown({key: '\u0001', altKey: true, ctrlKey: true}), '\u0001');  // <C-a>
                assert.equal(inputByKeydown({key: '\u000f', altKey: true, shiftKey: true, ctrlKey: true}), '\u000f');  // <C-o>
            });

            it('does not ignore any other modifiers', () => {
                global.input.store.alt_key_disabled = true;
                global.last_input = '';

                dispatchKeydown({key: 'a'});
                assert.equal(last_input, '');

                assert.equal(inputByKeydown({key: '\u0001', ctrlKey: true}), '\u0001');  // <C-a>
                assert.equal(inputByKeydown({key: '\u000f', ctrlKey: true}), '\u000f');  // <C-o>
            });
        });
    });

    context("on 'input' event", () => {
        it('sends input character to Neovim', () => {
            assert.equal(catchInputOnInputEvent('a'), 'a');
            assert.equal(catchInputOnInputEvent('3'), '3');
            assert.equal(catchInputOnInputEvent(';'), ';');
            assert.equal(catchInputOnInputEvent('^'), '^');
        });

        it('clears value in <input>', () => {
            global.input_element.value = 'a';
            dispatchInputEvent();
            assert.equal(global.input_element.value, '');
        });

        it("handles '<' edge case", () => {
            assert.equal(catchInputOnInputEvent('<'), '<LT>');
        });
    });

    context("on focus events", () => {
        it('emits <FocusGained> on focused', () => {
            const e = new window.Event('focus', {
                bubbles: true,
                cancelable: false
            });
            global.input_element.dispatchEvent(e);
            assert.equal(global.last_input, '<FocusGained>');
        });

        it('emits <FocusLost> on focused', () => {
            const e = new window.Event('blur', {
                bubbles: true,
                cancelable: false
            });
            global.input_element.dispatchEvent(e);
            assert.equal(global.last_input, '<FocusLost>');
        });
    });

    it('moves <input> element following cursor', () => {
        const store = input.store;
        store.cursor = {
            line: 12,
            col: 24
        };
        store.font_attr.width = 4;
        store.font_attr.height = 8;

        store.emit('cursor');
        assert.equal(input_element.style.left, store.cursor.col * store.font_attr.width + 'px');
        assert.equal(input_element.style.top, store.cursor.line * store.font_attr.height + 'px');
    });
});
})();
