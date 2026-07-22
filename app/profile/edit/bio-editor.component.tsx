'use client'

import { useCallback, useEffect, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import {
  ListNode,
  ListItemNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list'
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type TextFormatType,
} from 'lexical'
import IconComponent from '@components/icon/icon.component'

const theme = {
  paragraph: 'bio-editor__paragraph',
  text: {
    bold: 'bio-editor__bold',
    italic: 'bio-editor__italic',
    underline: 'bio-editor__underline',
  },
  list: {
    ul: 'bio-editor__ul',
    ol: 'bio-editor__ol',
    listitem: 'bio-editor__li',
  },
  link: 'bio-editor__link',
}

/** Seed the editor from the saved bio HTML, once, on creation. Browser-only
 * (DOMParser) — the whole editor is mounted with ssr:false by the parent. */
function loadInitialHtml(html: string) {
  return (editor: LexicalEditor) => {
    if (!html) return
    const dom = new DOMParser().parseFromString(html, 'text/html')
    const nodes = $generateNodesFromDOM(editor, dom)
    $getRoot().select()
    $insertNodes(nodes)
  }
}

type ToolbarButton = {
  icon: string
  label: string
  format?: TextFormatType
  action?: (editor: LexicalEditor) => void
}

const BUTTONS: ToolbarButton[] = [
  { icon: 'mdi:format-bold', label: 'Bold', format: 'bold' },
  { icon: 'mdi:format-italic', label: 'Italic', format: 'italic' },
  { icon: 'mdi:format-underline', label: 'Underline', format: 'underline' },
  {
    icon: 'mdi:format-list-bulleted',
    label: 'Bulleted list',
    action: (editor) => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
  },
  {
    icon: 'mdi:format-list-numbered',
    label: 'Numbered list',
    action: (editor) => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
  },
  {
    icon: 'mdi:link-variant',
    label: 'Insert link',
    action: (editor) => {
      const url = window.prompt('Link URL (https://…)')?.trim()
      if (url === undefined) return
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url ? url : null)
    },
  },
]

function Toolbar() {
  const [editor] = useLexicalComposerContext()
  const [active, setActive] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const readFormats = () => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return false
      setActive({
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        underline: selection.hasFormat('underline'),
      })
      return false
    }

    return editor.registerCommand(SELECTION_CHANGE_COMMAND, readFormats, COMMAND_PRIORITY_LOW)
  }, [editor])

  return (
    <div className="bio-editor__toolbar" role="toolbar" aria-label="Bio formatting">
      {BUTTONS.map((button) => (
        <button
          key={button.label}
          type="button"
          className="bio-editor__tool"
          aria-label={button.label}
          aria-pressed={button.format ? Boolean(active[button.format]) : undefined}
          data-active={button.format && active[button.format] ? 'true' : undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            button.format
              ? editor.dispatchCommand(FORMAT_TEXT_COMMAND, button.format)
              : button.action?.(editor)
          }
        >
          <IconComponent icon={button.icon} width={18} height={18} />
        </button>
      ))}
    </div>
  )
}

type BioEditorProps = {
  initialHtml: string
  onChange: (html: string) => void
}

const BioEditor = ({ initialHtml, onChange }: BioEditorProps) => {
  const handleChange = useCallback(
    (_: unknown, editor: LexicalEditor) => {
      editor.read(() => {
        const html = $generateHtmlFromNodes(editor, null)
        // An empty editor serializes to an empty paragraph — normalize to '' so
        // the profile page doesn't render a blank bio block.
        onChange(html === '<p class="bio-editor__paragraph"><br></p>' ? '' : html)
      })
    },
    [onChange],
  )

  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'profile-bio',
        theme,
        nodes: [ListNode, ListItemNode, LinkNode],
        editorState: loadInitialHtml(initialHtml),
        onError: (error) => console.error('[BioEditor]', error),
      }}
    >
      <div className="bio-editor">
        <Toolbar />
        <div className="bio-editor__shell">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="bio-editor__input"
                aria-label="Bio"
                aria-placeholder="Tell other duelists about yourself…"
                placeholder={
                  <p className="bio-editor__placeholder">Tell other duelists about yourself…</p>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
    </LexicalComposer>
  )
}

export default BioEditor
