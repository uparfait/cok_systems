import { Extension } from '@tiptap/core';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';

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
