import { useEffect } from 'react';

export function useEditorHeight(editor) {
  useEffect(() => {
    if (editor) {
      const editorElement = editor.view.dom;
      editorElement.style.minHeight = 'auto';
      editorElement.style.height = 'auto';
      
      const updateHeight = () => {
        if (editorElement) {
          editorElement.style.height = 'auto';
          const newHeight = Math.max(editorElement.scrollHeight, 500);
          editorElement.style.height = `${newHeight}px`;
        }
      };

      const observer = new MutationObserver(updateHeight);
      observer.observe(editorElement, { childList: true, subtree: true, characterData: true });
      updateHeight();

      return () => observer.disconnect();
    }
  }, [editor]);
}