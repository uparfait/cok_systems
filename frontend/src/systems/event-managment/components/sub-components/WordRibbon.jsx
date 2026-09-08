import { useState, useRef, useEffect } from 'react';
import {
  FiScissors, FiCopy, FiClipboard, FiEdit3,
  FiBold, FiItalic, FiUnderline, FiList, FiCheckSquare, FiMinus,
  FiAlignLeft, FiAlignCenter, FiAlignRight, FiAlignJustify,
  FiLink, FiGrid, FiImage, FiPaperclip, FiSearch, FiRepeat,
  FiMousePointer, FiSave, FiUpload, FiDownload, FiPrinter,
  FiRotateCcw, FiRotateCw, FiXCircle, FiCheck, FiBookOpen, FiZoomIn,
  FiFilePlus, FiFileMinus,
} from 'react-icons/fi';
import { RibbonBtn, RibbonSelect, GroupLabel } from './UIComponents';

const PRIMARY = '#056daa';
const CHROME_BG = '#F8F9FA';
const CHROME_BORDER = '#E4E6E8';
const TEXT = '#333333';
const fontHeading = "'Montserrat', sans-serif";

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Merriweather', value: "'Merriweather', serif" },
  { label: 'Montserrat', value: "'Montserrat', sans-serif" },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
];

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];

const STYLE_GALLERY = [
  { key: 'normal', label: 'Normal', preview: 'AaBbCcD', previewStyle: { fontSize: 13 } },
  { key: 'nospacing', label: 'No Spacing', preview: 'AaBbCcD', previewStyle: { fontSize: 13 } },
  { key: 'h1', label: 'Heading 1', preview: 'AaBbC', previewStyle: { fontSize: 15, color: PRIMARY, fontWeight: 600 } },
  { key: 'h2', label: 'Heading 2', preview: 'AaBbCc', previewStyle: { fontSize: 14, color: PRIMARY, fontWeight: 600 } },
  { key: 'h3', label: 'Heading 3', preview: 'AaBbCc', previewStyle: { fontSize: 13, color: PRIMARY, fontWeight: 600 } },
  { key: 'title', label: 'Title', preview: 'AaB', previewStyle: { fontSize: 18, fontWeight: 300 } },
  { key: 'subtitle', label: 'Subtitle', preview: 'AaBbCcDd', previewStyle: { fontSize: 12, color: '#767676' } },
  { key: 'emphasis', label: 'Emphasis', preview: 'AaBbCcD', previewStyle: { fontSize: 13, fontStyle: 'italic' } },
  { key: 'strong', label: 'Strong', preview: 'AaBbCcD', previewStyle: { fontSize: 13, fontWeight: 700 } },
];

function Group({ label, children }) {
  return (
    <div className="flex flex-col justify-between self-stretch px-1.5">
      <div className="flex items-center gap-0.5 flex-wrap">{children}</div>
      <GroupLabel>{label}</GroupLabel>
    </div>
  );
}

function GroupDivider() {
  return <div className="w-px self-stretch my-1" style={{ backgroundColor: CHROME_BORDER }} />;
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-1.5 text-[13px] cursor-pointer select-none"
      style={{
        color: active ? PRIMARY : TEXT,
        fontWeight: active ? 600 : 400,
        backgroundColor: active ? '#FFFFFF' : 'transparent',
        borderBottom: active ? '2px solid #FFFFFF' : '2px solid transparent',
        marginBottom: '-1px',
        fontFamily: fontHeading,
      }}
    >
      {children}
    </button>
  );
}

export default function WordRibbon({
  editor, fontValue, fontSizeValue, inTable,
  onShowLinkDialog, onImport, onExport, onInsertImage, onAttachFile,
  onPrint, onSave, onFindReplace, onFormatPainter, formatPainterActive,
  onInsertPage, onDeletePage,
  pageSize, setPageSize, margins, setMargins, zoom, setZoom,
}) {
  const [activeTab, setActiveTab] = useState('home');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [tellQuery, setTellQuery] = useState('');
  const fileMenuRef = useRef(null);

  useEffect(() => {
    if (!fileMenuOpen) return;
    const onOutside = (e) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target)) setFileMenuOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [fileMenuOpen]);

  useEffect(() => {
    if (inTable) setActiveTab('table');
    else if (activeTab === 'table') setActiveTab('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTable]);

  const applyStyle = (key) => {
    const chain = editor.chain().focus();
    switch (key) {
      case 'normal':
      case 'nospacing':
        chain.setParagraph().unsetAllMarks().run(); break;
      case 'h1': chain.setHeading({ level: 1 }).run(); break;
      case 'h2': chain.setHeading({ level: 2 }).run(); break;
      case 'h3': chain.setHeading({ level: 3 }).run(); break;
      case 'title': chain.setHeading({ level: 1 }).setTextAlign('center').run(); break;
      case 'subtitle': chain.setHeading({ level: 3 }).setItalic().run(); break;
      case 'emphasis': chain.setParagraph().setItalic().run(); break;
      case 'strong': chain.setParagraph().setBold().run(); break;
      default: break;
    }
  };

  const tabs = [
    { key: 'home', label: 'Home' },
    { key: 'insert', label: 'Insert' },
    { key: 'layout', label: 'Layout' },
    { key: 'review', label: 'Review' },
    { key: 'view', label: 'View' },
    ...(inTable ? [{ key: 'table', label: 'Table' }] : []),
  ];

  return (
    <div className="flex-shrink-0 select-none" style={{ backgroundColor: CHROME_BG }}>
      {/* Tab row: File block, ribbon tabs and the Tell-me search */}
      <div className="flex items-center px-1 pt-1 gap-0.5 flex-wrap" style={{ borderBottom: `1px solid ${CHROME_BORDER}` }}>
        <div className="relative" ref={fileMenuRef}>
          <button
            type="button"
            onClick={() => setFileMenuOpen((v) => !v)}
            className="px-4 py-1.5 text-[13px] font-semibold text-white cursor-pointer"
            style={{ backgroundColor: PRIMARY, fontFamily: fontHeading }}
          >
            File
          </button>
          {fileMenuOpen && (
            <div className="absolute left-0 top-full z-40 min-w-[180px]" style={{ backgroundColor: CHROME_BG }}>
              {[
                { label: 'Save', icon: FiSave, run: onSave },
                { label: 'Import Document', icon: FiUpload, run: onImport },
                { label: 'Export as Word (.docx)', icon: FiDownload, run: onExport },
                { label: 'Print', icon: FiPrinter, run: onPrint },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => { setFileMenuOpen(false); item.run?.(); }}
                  className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 cursor-pointer hover:bg-[#EDEFF1]"
                  style={{ color: TEXT }}
                >
                  <item.icon className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {tabs.map((t) => (
          <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </TabButton>
        ))}

        <div className="flex-1 min-w-[120px] max-w-xs ml-2 hidden md:block">
          <div className="flex items-center gap-1.5 px-2 h-6 bg-white" style={{ border: `1px solid ${CHROME_BORDER}` }}>
            <FiSearch className="w-3 h-3 shrink-0" style={{ color: '#9E9E9E' }} />
            <input
              type="text"
              value={tellQuery}
              onChange={(e) => setTellQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onFindReplace?.(tellQuery); setTellQuery(''); } }}
              placeholder="Find in document"
              className="w-full text-[12px] focus:outline-none bg-transparent"
              style={{ color: TEXT }}
            />
          </div>
        </div>
      </div>

      {/* Ribbon commands for the active tab */}
      <div className="flex items-stretch gap-0 px-1 py-1 overflow-x-auto no-scrollbar bg-white" style={{ borderBottom: `1px solid ${CHROME_BORDER}` }}>
        {activeTab === 'home' && (
          <>
            <Group label="Clipboard">
              <div className="flex flex-col items-center px-1">
                <RibbonBtn wide title="Paste (Ctrl+V)" onClick={() => navigator.clipboard.readText().then((t) => { if (t) editor.chain().focus().insertContent(t).run(); }).catch(() => {})}>
                  <FiClipboard className="w-4 h-4" />
                  <span className="text-[11px]">Paste</span>
                </RibbonBtn>
              </div>
              <div className="flex flex-col gap-0.5">
                <RibbonBtn wide title="Cut (Ctrl+X)" onClick={() => { const { from, to } = editor.state.selection; navigator.clipboard.writeText(editor.state.doc.textBetween(from, to)); editor.commands.deleteSelection(); }}>
                  <FiScissors className="w-3.5 h-3.5" /><span className="text-[11px]">Cut</span>
                </RibbonBtn>
                <RibbonBtn wide title="Copy (Ctrl+C)" onClick={() => { const { from, to } = editor.state.selection; navigator.clipboard.writeText(editor.state.doc.textBetween(from, to)); }}>
                  <FiCopy className="w-3.5 h-3.5" /><span className="text-[11px]">Copy</span>
                </RibbonBtn>
                <RibbonBtn wide title="Format Painter: copy formatting, then select text to apply" active={formatPainterActive} onClick={onFormatPainter}>
                  <FiEdit3 className="w-3.5 h-3.5" /><span className="text-[11px]">Painter</span>
                </RibbonBtn>
              </div>
            </Group>
            <GroupDivider />
            <Group label="Font">
              <RibbonSelect title="Font family" width="w-32" value={fontValue}
                onChange={(e) => { const v = e.target.value; if (v) editor.chain().focus().setFontFamily(v).run(); else editor.chain().focus().unsetFontFamily().run(); }}>
                {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
              </RibbonSelect>
              <RibbonSelect title="Font size" width="w-14" value={fontSizeValue || '12'}
                onChange={(e) => editor.chain().focus().setFontSize(`${e.target.value}pt`).run()}>
                {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </RibbonSelect>
              <RibbonBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><FiBold className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><FiItalic className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><FiUnderline className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><span className="line-through text-[13px]">S</span></RibbonBtn>
              <label title="Text color" className="inline-flex items-center justify-center w-7 h-7 cursor-pointer hover:bg-[#EDEFF1]">
                <span className="text-[13px] font-bold" style={{ borderBottom: `3px solid ${editor.getAttributes('textStyle').color || TEXT}` }}>A</span>
                <input type="color" className="w-0 h-0 opacity-0" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
              </label>
              <label title="Highlight color" className="inline-flex items-center justify-center w-7 h-7 cursor-pointer hover:bg-[#EDEFF1]">
                <FiEdit3 className="w-3.5 h-3.5" style={{ color: '#767676' }} />
                <input type="color" className="w-0 h-0 opacity-0" defaultValue="#FFF176" onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} />
              </label>
              <RibbonBtn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><FiXCircle className="w-3.5 h-3.5" /></RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Paragraph">
              <RibbonBtn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><FiList className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><span className="text-[11px] leading-none">1.<br />2.</span></RibbonBtn>
              <RibbonBtn title="Task list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><FiCheckSquare className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Decrease indent" onClick={() => editor.chain().focus().liftListItem('listItem').run()}><span className="text-[13px]">⇤</span></RibbonBtn>
              <RibbonBtn title="Increase indent" onClick={() => editor.chain().focus().sinkListItem('listItem').run()}><span className="text-[13px]">⇥</span></RibbonBtn>
              <RibbonBtn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><FiAlignLeft className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><FiAlignCenter className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><FiAlignRight className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><FiAlignJustify className="w-3.5 h-3.5" /></RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Styles">
              <div className="flex items-stretch gap-0.5">
                {STYLE_GALLERY.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    title={s.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle(s.key)}
                    className="flex flex-col items-center justify-between px-1.5 py-0.5 bg-white cursor-pointer hover:bg-[#EDEFF1] min-w-[64px]"
                    style={{ border: `1px solid ${CHROME_BORDER}` }}
                  >
                    <span style={{ ...s.previewStyle, lineHeight: 1.2 }}>{s.preview}</span>
                    <span className="text-[10px]" style={{ color: '#767676' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </Group>
            <GroupDivider />
            <Group label="Editing">
              <div className="flex flex-col gap-0.5">
                <RibbonBtn wide title="Find (Ctrl+F)" onClick={() => onFindReplace?.()}>
                  <FiSearch className="w-3.5 h-3.5" /><span className="text-[11px]">Find</span>
                </RibbonBtn>
                <RibbonBtn wide title="Replace" onClick={() => onFindReplace?.()}>
                  <FiRepeat className="w-3.5 h-3.5" /><span className="text-[11px]">Replace</span>
                </RibbonBtn>
                <RibbonBtn wide title="Select all" onClick={() => editor.commands.selectAll()}>
                  <FiMousePointer className="w-3.5 h-3.5" /><span className="text-[11px]">Select</span>
                </RibbonBtn>
              </div>
            </Group>
          </>
        )}

        {activeTab === 'insert' && (
          <>
            <Group label="Pages">
              <RibbonBtn wide title="Insert a page break to start a new page" onClick={onInsertPage}>
                <FiFilePlus className="w-3.5 h-3.5" /><span className="text-[11px]">New Page</span>
              </RibbonBtn>
              <RibbonBtn wide title="Delete the page the cursor is on" onClick={onDeletePage}>
                <FiFileMinus className="w-3.5 h-3.5" /><span className="text-[11px]">Delete Page</span>
              </RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Tables">
              <RibbonBtn wide title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <FiGrid className="w-3.5 h-3.5" /><span className="text-[11px]">Table</span>
              </RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Illustrations">
              <RibbonBtn wide title="Insert image" onClick={onInsertImage}><FiImage className="w-3.5 h-3.5" /><span className="text-[11px]">Image</span></RibbonBtn>
              <RibbonBtn wide title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><FiMinus className="w-3.5 h-3.5" /><span className="text-[11px]">Rule</span></RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Links">
              <RibbonBtn wide title="Insert link (Ctrl+K)" active={editor.isActive('link')} onClick={onShowLinkDialog}><FiLink className="w-3.5 h-3.5" /><span className="text-[11px]">Link</span></RibbonBtn>
              <RibbonBtn wide title="Attach a file into the document" onClick={onAttachFile}><FiPaperclip className="w-3.5 h-3.5" /><span className="text-[11px]">File</span></RibbonBtn>
            </Group>
          </>
        )}

        {activeTab === 'layout' && (
          <>
            <Group label="Page Setup">
              <RibbonSelect title="Page size" width="w-24" value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="letter">Letter</option>
                <option value="a4">A4</option>
              </RibbonSelect>
              <RibbonSelect title="Margins" width="w-24" value={margins} onChange={(e) => setMargins(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="narrow">Narrow</option>
                <option value="wide">Wide</option>
              </RibbonSelect>
            </Group>
            <GroupDivider />
            <Group label="Paragraph">
              <RibbonBtn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><FiAlignLeft className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><FiAlignCenter className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><FiAlignRight className="w-3.5 h-3.5" /></RibbonBtn>
              <RibbonBtn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><FiAlignJustify className="w-3.5 h-3.5" /></RibbonBtn>
            </Group>
          </>
        )}

        {activeTab === 'review' && (
          <>
            <Group label="Proofing">
              <RibbonBtn wide title="Spelling is checked by the browser while you type" active onClick={() => {}}>
                <FiCheck className="w-3.5 h-3.5" /><span className="text-[11px]">Spelling</span>
              </RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Editing">
              <RibbonBtn wide title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
                <FiRotateCcw className="w-3.5 h-3.5" /><span className="text-[11px]">Undo</span>
              </RibbonBtn>
              <RibbonBtn wide title="Redo (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
                <FiRotateCw className="w-3.5 h-3.5" /><span className="text-[11px]">Redo</span>
              </RibbonBtn>
            </Group>
          </>
        )}

        {activeTab === 'view' && (
          <>
            <Group label="Zoom">
              {[75, 100, 125, 150].map((z) => (
                <RibbonBtn key={z} wide title={`Zoom ${z}%`} active={zoom === z} onClick={() => setZoom(z)}>
                  <FiZoomIn className="w-3 h-3" /><span className="text-[11px]">{z}%</span>
                </RibbonBtn>
              ))}
            </Group>
            <GroupDivider />
            <Group label="Views">
              <RibbonBtn wide title="Print layout" active onClick={() => {}}>
                <FiBookOpen className="w-3.5 h-3.5" /><span className="text-[11px]">Print Layout</span>
              </RibbonBtn>
            </Group>
          </>
        )}

        {activeTab === 'table' && inTable && (
          <>
            <Group label="Rows & Columns">
              <RibbonBtn wide title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}><span className="text-[11px]">+ Row</span></RibbonBtn>
              <RibbonBtn wide title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}><span className="text-[11px]">+ Column</span></RibbonBtn>
              <RibbonBtn wide title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}><span className="text-[11px]">- Row</span></RibbonBtn>
              <RibbonBtn wide title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}><span className="text-[11px]">- Column</span></RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Merge">
              <RibbonBtn wide title="Merge cells" onClick={() => editor.chain().focus().mergeCells().run()}><span className="text-[11px]">Merge</span></RibbonBtn>
              <RibbonBtn wide title="Split cell" onClick={() => editor.chain().focus().splitCell().run()}><span className="text-[11px]">Split</span></RibbonBtn>
            </Group>
            <GroupDivider />
            <Group label="Table">
              <RibbonBtn wide title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><span className="text-[11px]">Delete Table</span></RibbonBtn>
            </Group>
          </>
        )}
      </div>
    </div>
  );
}
