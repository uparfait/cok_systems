import { Extension, Node } from '@tiptap/core';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';

// Word-style page break: an atom block that starts a new page when the
// document is printed or exported (docx/pdf)
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML() {
    return ['div', { 'data-page-break': 'true', class: 'cok-page-break' }];
  },

  // The paginator positions each break on an exact page boundary by setting
  // its top margin; a node view keeps ProseMirror from undoing those styles
  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.setAttribute('data-page-break', 'true');
      dom.className = 'cok-page-break';
      return { dom, ignoreMutation: () => true };
    };
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }])
            .run(),
    };
  },
});

export const StyledBulletList = BulletList.extend({
  addAttributes() {
    return {
      listStyleType: {
        default: null,
        parseHTML: (el) => el.style.listStyleType || null,
        renderHTML: (attrs) =>
          attrs.listStyleType ? { style: `list-style-type: ${attrs.listStyleType}` } : {},
      },
    };
  },
});

export const StyledOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listStyleType: {
        default: null,
        parseHTML: (el) => el.style.listStyleType || null,
        renderHTML: (attrs) =>
          attrs.listStyleType ? { style: `list-style-type: ${attrs.listStyleType}` } : {},
      },
    };
  },
});

// Word-style font size support, stored on the shared textStyle mark
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).run(),
    };
  },
});
