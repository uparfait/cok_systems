import {
  FiRotateCcw, FiRotateCw, FiList, FiCheckSquare, FiMinus,
  FiAlignLeft, FiAlignCenter, FiAlignRight, FiAlignJustify,
  FiLink, FiGrid, FiImage, FiPaperclip,
  FiSave, FiUpload, FiDownload, FiPrinter, FiXCircle,
} from 'react-icons/fi';
import { RibbonBtn, RibbonSelect, Divider, GroupLabel } from './UIComponents';

const PRIMARY = '#056daa';

export default function RibbonToolbar({
  editor, fontValue, fontSizeValue, headingValue, bulletStyle, orderedStyle,
  inTable, setListStyle, onShowLinkDialog, onImport, onExport,
  onInsertImage, onAttachFile, onPrint, onSave,
}) {
  return (
    <div className="bg-white border-b px-2 py-1.5 flex-shrink-0" style={{ borderColor: '#E0E0E0' }}>
      <div className="flex items-end gap-1 flex-wrap">
        <HistoryGroup editor={editor} />
        <Divider />
        <FontGroup
          editor={editor}
          fontValue={fontValue}
          fontSizeValue={fontSizeValue}
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
          onInsertImage={onInsertImage}
          onAttachFile={onAttachFile}
        />
        <Divider />
        <FileGroup
          onImport={onImport}
          onExport={onExport}
          onPrint={onPrint}
          onSave={onSave}
        />
      </div>
      {inTable && <TableToolbar editor={editor} />}
    </div>
  );
}

function HistoryGroup({ editor }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5 px-1">
        <RibbonBtn
          title="Undo (Ctrl+Z)"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <FiRotateCcw className="w-4 h-4" />
        </RibbonBtn>
        <RibbonBtn
          title="Redo (Ctrl+Y)"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <FiRotateCw className="w-4 h-4" />
        </RibbonBtn>
      </div>
      <GroupLabel>History</GroupLabel>
    </div>
  );
}

function FontGroup({ editor, fontValue, fontSizeValue, headingValue }) {
  const fontOptions = [
    { value: '', label: 'Calibri (Default)' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Cambria', label: 'Cambria' },
    { value: 'Comic Sans MS', label: 'Comic Sans MS' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Tahoma', label: 'Tahoma' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Verdana', label: 'Verdana' },
  ];

  const sizeOptions = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'];

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
          title="Font size"
          width="w-16"
          value={fontSizeValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(`${v}pt`).run();
          }}
        >
          <option value="">Size</option>
          {sizeOptions.map(s => (
            <option key={s} value={s}>{s}</option>
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
        <RibbonBtn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <FiXCircle className="w-4 h-4" />
        </RibbonBtn>
      </div>
      <GroupLabel>Font</GroupLabel>
    </div>
  );
}

function ColorPicker({ title, defaultValue, onChange, label, labelClass = '' }) {
  return (
    <label
      title={title}
      className="inline-flex flex-col items-center justify-center h-7 px-1 cursor-pointer border border-transparent hover:bg-[#E3F2FD] hover:border-[#9CC7E4]"
    >
      <span className={`text-[13px] leading-none font-bold ${labelClass}`} style={{ color: '#333333' }}>{label}</span>
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
          <FiList className="w-4 h-4" />
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

        <RibbonBtn wide title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <span className="text-[13px] font-bold">1.</span>
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
          <FiCheckSquare className="w-4 h-4" />
        </RibbonBtn>
        <RibbonBtn title="Block quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <span className="text-[16px] font-bold">❝</span>
        </RibbonBtn>
        <RibbonBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <FiMinus className="w-4 h-4" />
        </RibbonBtn>
      </div>
      <div className="flex items-center gap-0.5 px-1 mt-1">
        <AlignmentButtons editor={editor} />
      </div>
      <GroupLabel>Paragraph &amp; Lists</GroupLabel>
    </div>
  );
}

function AlignmentButtons({ editor }) {
  const alignments = [
    { align: 'left', Icon: FiAlignLeft },
    { align: 'center', Icon: FiAlignCenter },
    { align: 'right', Icon: FiAlignRight },
    { align: 'justify', Icon: FiAlignJustify },
  ];

  return alignments.map(({ align, Icon }) => (
    <RibbonBtn
      key={align}
      title={`Align ${align.charAt(0).toUpperCase() + align.slice(1)}`}
      active={editor.isActive({ textAlign: align })}
      onClick={() => editor.chain().focus().setTextAlign(align).run()}
    >
      <Icon className="w-4 h-4" />
    </RibbonBtn>
  ));
}

function InsertGroup({ editor, onShowLinkDialog, onInsertImage, onAttachFile }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5 px-1">
        <RibbonBtn wide title="Insert link" active={editor.isActive('link')} onClick={onShowLinkDialog}>
          <FiLink className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">Link</span>
        </RibbonBtn>
        <RibbonBtn wide title="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <FiGrid className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">Table</span>
        </RibbonBtn>
        <RibbonBtn wide title="Insert image" onClick={onInsertImage}>
          <FiImage className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">Image</span>
        </RibbonBtn>
        <RibbonBtn wide title="Attach file" onClick={onAttachFile}>
          <FiPaperclip className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">File</span>
        </RibbonBtn>
      </div>
      <GroupLabel>Insert</GroupLabel>
    </div>
  );
}

function FileGroup({ onImport, onExport, onPrint, onSave }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5 px-1">
        <RibbonBtn wide title="Save (Ctrl+S)" onClick={onSave}>
          <FiSave className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">Save</span>
        </RibbonBtn>
        <RibbonBtn wide title="Import document (.docx, .xlsx, .txt, .md, .html)" onClick={onImport}>
          <FiUpload className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">Import</span>
        </RibbonBtn>
        <RibbonBtn wide title="Export to Word (.docx)" onClick={onExport}>
          <FiDownload className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">Export</span>
        </RibbonBtn>
        <RibbonBtn wide title="Print" onClick={onPrint}>
          <FiPrinter className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          <span className="text-[12px]">Print</span>
        </RibbonBtn>
      </div>
      <GroupLabel>File</GroupLabel>
    </div>
  );
}

function TableToolbar({ editor }) {
  return (
    <div className="mt-2 pt-2 border-t flex items-center gap-1 flex-wrap" style={{ borderColor: '#E0E0E0' }}>
      <span className="text-[11px] px-1 font-semibold" style={{ color: PRIMARY, fontFamily: "'Montserrat', sans-serif" }}>Table Tools:</span>
      <RibbonBtn wide title="Add column before" onClick={() => editor.chain().focus().addColumnBefore().run()}>
        <span className="text-[12px]">Insert Left</span>
      </RibbonBtn>
      <RibbonBtn wide title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <span className="text-[12px]">Insert Right</span>
      </RibbonBtn>
      <RibbonBtn wide title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
        <span className="text-[12px]" style={{ color: '#E74C3C' }}>Delete Column</span>
      </RibbonBtn>
      <Divider />
      <RibbonBtn wide title="Add row above" onClick={() => editor.chain().focus().addRowBefore().run()}>
        <span className="text-[12px]">Insert Above</span>
      </RibbonBtn>
      <RibbonBtn wide title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <span className="text-[12px]">Insert Below</span>
      </RibbonBtn>
      <RibbonBtn wide title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
        <span className="text-[12px]" style={{ color: '#E74C3C' }}>Delete Row</span>
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
        <span className="text-[12px] font-semibold" style={{ color: '#E74C3C' }}>Delete Table</span>
      </RibbonBtn>
    </div>
  );
}
