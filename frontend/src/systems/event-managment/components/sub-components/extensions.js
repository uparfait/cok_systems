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