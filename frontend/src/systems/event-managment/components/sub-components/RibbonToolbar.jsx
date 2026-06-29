import { RibbonBtn, RibbonSelect, Divider, GroupLabel } from './UIComponents';

export default function RibbonToolbar({
  editor, fontValue, headingValue, bulletStyle, orderedStyle,
  inTable, setListStyle, onShowLinkDialog, onImport, onExport
}) {
  return (
    <div className="bg-[#f3f2f1] border-b border-[#d4d4d4] px-2 py-1.5 flex-shrink-0">
      <div className="flex items-end gap-1 flex-wrap">
        <FontGroup
          editor={editor}
          fontValue={fontValue}
          headingValue={headingValue}
        />
        <Divider />
        <ParagraphGroup
          editor={editor}
          bulletStyle={bulletStyle}
          orderedStyle={orderedStyle}
          setListStyle={setListStyle}
        />
        <Divider />
        <InsertGroup
          editor={editor}
          onShowLinkDialog={onShowLinkDialog}
        />
        <Divider />
        <FileGroup
          onImport={onImport}
          onExport={onExport}
        />
      </div>
      {inTable && <TableToolbar editor={editor} />}
    </div>
  );
}

function FontGroup({ editor, fontValue, headingValue }) {
  const fontOptions = [
    { value: '', label: 'Calibri (Default)' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Cambria', label: 'Cambria' },
    { value: 'Comic Sans MS', label: 'Comic Sans MS' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Tahoma', label: 'Tahoma' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Verdana', label: 'Verdana' },
  ];

  const headingOptions = [
    { value: 'paragraph', label: 'Normal' },
    { value: '1', label: 'Heading 1' },
    { value: '2', label: 'Heading 2' },
    { value: '3', label: 'Heading 3' },
    { value: '4', label: 'Heading 4' },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 px-1">
        <RibbonSelect
          title="Font"
          width="w-36"
          value={fontValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          {fontOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </RibbonSelect>

        <RibbonSelect
          title="Style"
          width="w-28"
          value={headingValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'paragraph') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().setHeading({ level: parseInt(v, 10) }).run();
          }}
        >
          {headingOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </RibbonSelect>
      </div>

      <div className="flex items-center gap-0.5 px-1 mt-1">
        <RibbonBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <span className="font-bold text-[14px]">B</span>
        </RibbonBtn>
        <RibbonBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic text-[14px]">I</span>
        </RibbonBtn>
        <RibbonBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="underline text-[14px]">U</span>
        </RibbonBtn>
        <RibbonBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through text-[14px]">S</span>
        </RibbonBtn>
        <RibbonBtn title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          <span className="text-[12px] font-bold">&lt;/&gt;</span>
        </RibbonBtn>

        <ColorPicker
          title="Font color"
          defaultValue="#c00000"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          label="A"
        />
        <ColorPicker
          title="Highlight"
          defaultValue="#ffff00"
          onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          label="ab"
          labelClass="bg-yellow-200 px-0.5"
        />
      </div>
      <GroupLabel>Font</GroupLabel>
    </div>
  );
}

function ColorPicker({ title, defaultValue, onChange, label, labelClass = '' }) {
  return (
    <label title={title} className="inline-flex flex-col items-center justify-center h-7 px-1 hover:bg-[#e6f0fb] cursor-pointer border border-transparent hover:border-[#a8c5e8]">
      <span className={`text-[13px] leading-none font-bold text-slate-800 ${labelClass}`}>{label}</span>
      <input type="color" defaultValue={defaultValue}
        onChange={onChange}
        className="w-5 h-1 mt-0.5 border-0 p-0 bg-transparent cursor-pointer appearance-none" />
    </label>
  );
}

function ParagraphGroup({ editor, bulletStyle, orderedStyle, setListStyle }) {
  const bulletOptions = [
    { value: '', label: '• Default' },
    { value: 'disc', label: '• Disc' },
    { value: 'circle', label: '◦ Circle' },
    { value: 'square', label: '▪ Square' },
    { value: 'none', label: 'None' },
  ];

  const orderedOptions = [
    { value: '', label: 'Default 1.' },
    { value: 'decimal', label: '1, 2, 3' },
    { value: 'decimal-leading-zero', label: '01, 02, 03' },
    { value: 'lower-alpha', label: 'a, b, c' },
    { value: 'upper-alpha', label: 'A, B, C' },
    { value: 'lower-roman', label: 'i, ii, iii' },
    { value: 'upper-roman', label: 'I, II, III' },
  ];

  return (
    <div className="flex flex-col ml-0.5">
      <div className="flex items-center gap-1 px-1">
        <RibbonBtn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <span className="text-[16px] font-bold">List</span>
        </RibbonBtn>
        <RibbonSelect
          title="Bullet style"
          width="w-24"
          value={bulletStyle}
          onChange={(e) => setListStyle('bullet', e.target.value)}
          onPreview={(value) => { if (value) setListStyle('bullet', value); }}
        >
          {bulletOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </RibbonSelect>

        <RibbonBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <span className="text-[14px] ml-1 mr-1 font-bold">Type</span>
        </RibbonBtn>
        <RibbonSelect
          title="Numbering style"
          width="w-28"
          value={orderedStyle}
          onChange={(e) => setListStyle('ordered', e.target.value)}
          onPreview={(value) => { if (value) setListStyle('ordered', value); }}
        >
          {orderedOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </RibbonSelect>

        <RibbonBtn title="Task list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <span className="text-[16px]">☑</span>
        </RibbonBtn>
        <RibbonBtn title="Block quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <span className="text-[16px] font-bold">❝</span>
        </RibbonBtn>
        <RibbonBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <span className="text-[16px] font-bold">__</span>
        </RibbonBtn>
      </div>
      <div className="flex items-center gap-0.5 px-1 mt-1">
        <AlignmentButtons editor={editor} />
      </div>
      <GroupLabel>Paragraph & Lists</GroupLabel>
    </div>
  );
}

function AlignmentButtons({ editor }) {
  const alignments = [
    {
      align: 'left',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="17" y1="7" x2="3" y2="7" />
          <line x1="21" y1="11" x2="3" y2="11" />
          <line x1="17" y1="15" x2="3" y2="15" />
          <line x1="19" y1="19" x2="3" y2="19" />
        </svg>
      )
    },
    {
      align: 'center',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="17" y1="7" x2="7" y2="7" />
          <line x1="21" y1="11" x2="3" y2="11" />
          <line x1="17" y1="15" x2="7" y2="15" />
          <line x1="19" y1="19" x2="5" y2="19" />
        </svg>
      )
    },
    {
      align: 'right',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="21" y1="7" x2="7" y2="7" />
          <line x1="21" y1="11" x2="3" y2="11" />
          <line x1="21" y1="15" x2="7" y2="15" />
          <line x1="21" y1="19" x2="5" y2="19" />
        </svg>
      )
    },
    {
      align: 'justify',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="21" y1="7" x2="3" y2="7" />
          <line x1="21" y1="11" x2="3" y2="11" />
          <line x1="21" y1="15" x2="3" y2="15" />
          <line x1="21" y1="19" x2="3" y2="19" />
        </svg>
      )
    }
  ];

  return alignments.map(({ align, icon }) => (
    <RibbonBtn
      key={align}
      title={`Align ${align.charAt(0).toUpperCase() + align.slice(1)}`}
      active={editor.isActive({ textAlign: align })}
      onClick={() => editor.chain().focus().setTextAlign(align).run()}
    >
      {icon}
    </RibbonBtn>
  ));
}

function InsertGroup({ editor, onShowLinkDialog }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5 px-1">
        <RibbonBtn wide title="Insert link" active={editor.isActive('link')} onClick={onShowLinkDialog}>
          <span className="text-[12px]">🔗 Link</span>
        </RibbonBtn>
        <RibbonBtn wide title="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <span className="text-[12px]">▦ Table</span>
        </RibbonBtn>
      </div>
      <GroupLabel>Insert</GroupLabel>
    </div>
  );
}

function FileGroup({ onImport, onExport }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5 px-1">
        <RibbonBtn wide title="Import document" onClick={onImport}>
          <span className="text-[12px]">📁 Import</span>
        </RibbonBtn>
        <RibbonBtn wide title="Export to DOCX" onClick={onExport}>
          <span className="text-[12px]">💾 Export</span>
        </RibbonBtn>
      </div>
      <GroupLabel>File</GroupLabel>
    </div>
  );
}

function TableToolbar({ editor }) {
  return (
    <div className="mt-2 pt-2 border-t border-[#d4d4d4] flex items-center gap-1 flex-wrap">
      <span className="text-[11px] text-slate-600 px-1 font-semibold">Table Tools:</span>
      <RibbonBtn wide title="Add column before" onClick={() => editor.chain().focus().addColumnBefore().run()}>
        <span className="text-[12px]">Insert Left</span>
      </RibbonBtn>
      <RibbonBtn wide title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <span className="text-[12px]">Insert Right</span>
      </RibbonBtn>
      <RibbonBtn wide title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
        <span className="text-[12px] text-red-600">Delete Column</span>
      </RibbonBtn>
      <Divider />
      <RibbonBtn wide title="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
        <span className="text-[12px]">Insert Above</span>
      </RibbonBtn>
      <RibbonBtn wide title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <span className="text-[12px]">Insert Below</span>
      </RibbonBtn>
      <RibbonBtn wide title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
        <span className="text-[12px] text-red-600">Delete Row</span>
      </RibbonBtn>
      <Divider />
      <RibbonBtn wide title="Toggle header row" active={editor.isActive('tableHeader')} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
        <span className="text-[12px]">Header Row</span>
      </RibbonBtn>
      <RibbonBtn wide title="Merge cells" onClick={() => editor.chain().focus().mergeCells().run()}>
        <span className="text-[12px]">Merge Cells</span>
      </RibbonBtn>
      <RibbonBtn wide title="Split cell" onClick={() => editor.chain().focus().splitCell().run()}>
        <span className="text-[12px]">Split Cell</span>
      </RibbonBtn>
      <Divider />
      <RibbonBtn wide title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
        
        <span className="text-[12px] text-red-700 font-semibold">Delete Table</span>
      </RibbonBtn>
    </div>
  );
}