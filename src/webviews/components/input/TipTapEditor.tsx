import Document from '@tiptap/extension-document';
import History from '@tiptap/extension-history';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { Editor, EditorContent, JSONContent, useEditor } from '@tiptap/react';
import { useInputHistory } from 'hooks/useInputHistory';
import useUpdatingRef from 'hooks/useUpdatingRef';
import { useCallback, useEffect, useRef } from 'react';
import { useSubmenuContext } from 'store/submenuContext';
import { SimpleHTMLElementProps } from 'utils/types';
import { ContextProviderDescription } from '../../../context/providers/types';
import InputToolbar from './InputToolbar';
import { Mention } from './MentionExtension';
import { getContextProviderDropdownOptions } from './suggestions';

type TipTapEditorProps = SimpleHTMLElementProps<HTMLDivElement> & {
  availableContextProviders: ContextProviderDescription[];
  historyKey: string;
  onEnter: (editorState: JSONContent, editor: Editor) => void;
  onClear: () => void;
  onCancel: () => void;
  showCancelButton: boolean;
};

const Tiptap = (props: TipTapEditorProps) => {
  const {
    availableContextProviders,
    historyKey,
    onEnter,
    onClear,
    onCancel,
    showCancelButton,
    ...rest
  } = props;
  const getSubmenuContextItems = useSubmenuContext((state) => state.getSubmenuContextItems);
  const availableContextProvidersRef = useUpdatingRef(availableContextProviders);

  const inSubmenuRef = useRef<string | undefined>(undefined);
  const inDropdownRef = useRef(false);

  const enterSubmenu = async (editor: Editor, providerId: string) => {
    const contents = editor.getText();
    const indexOfAt = contents.lastIndexOf('@');
    if (indexOfAt === -1) {
      return;
    }

    // Find the position of the last @ character
    // We do this because editor.getText() isn't a correct representation including node views
    let startPos = editor.state.selection.anchor;
    while (startPos > 0 && editor.state.doc.textBetween(startPos, startPos + 1) !== '@') {
      startPos--;
    }
    startPos++;

    editor.commands.deleteRange({
      from: startPos,
      to: editor.state.selection.anchor,
    });
    inSubmenuRef.current = providerId;

    // to trigger refresh of suggestions
    editor.commands.insertContent(':');
    editor.commands.deleteRange({
      from: editor.state.selection.anchor - 1,
      to: editor.state.selection.anchor,
    });
  };

  const onClose = () => {
    inSubmenuRef.current = undefined;
    inDropdownRef.current = false;
  };

  const onOpen = () => {
    inDropdownRef.current = true;
  };

  const { prevRef, nextRef, addRef } = useInputHistory(historyKey);

  const editor = useEditor({
    extensions: [
      Document,
      History,
      Placeholder.configure({
        placeholder: "Ask anything. Use '@' to add context",
      }),
      Paragraph.extend({
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (inDropdownRef.current) {
                return false;
              }

              onEnterRef.current();
              return true;
            },
            'Shift-Enter': () =>
              this.editor.commands.first(({ commands }) => [
                () => commands.newlineInCode(),
                () => commands.createParagraphNear(),
                () => commands.liftEmptyBlock(),
                () => commands.splitBlock(),
              ]),
            ArrowUp: () => {
              if (this.editor.state.selection.anchor > 1) {
                return false;
              }

              const previousInput = prevRef.current(this.editor.state.toJSON().doc);
              if (previousInput) {
                this.editor.commands.setContent(previousInput);
                setTimeout(() => {
                  this.editor.commands.blur();
                  this.editor.commands.focus('start');
                }, 0);
                return true;
              }

              return false;
            },
            ArrowDown: () => {
              if (this.editor.state.selection.anchor < this.editor.state.doc.content.size - 1) {
                return false;
              }
              const nextInput = nextRef.current();
              if (nextInput) {
                this.editor.commands.setContent(nextInput);
                setTimeout(() => {
                  this.editor.commands.blur();
                  this.editor.commands.focus('end');
                }, 0);
                return true;
              }

              return false;
            },
            'Ctrl-l': () => {
              onClear();
              return true;
            },
          };
        },
      }).configure({
        HTMLAttributes: {
          class: 'my-1',
        },
      }),
      Text,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: getContextProviderDropdownOptions(
          availableContextProvidersRef,
          getSubmenuContextItems,
          enterSubmenu,
          onClose,
          onOpen,
          inSubmenuRef
        ),
        renderHTML: (props) => {
          return `@${props.node.attrs.label || props.node.attrs.id}`;
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'outline-none overflow-hidden h-full min-h-[60px]',
        style: `font-size: 14px;`,
      },
    },
    content: '',
  });

  useEffect(() => {
    if (editor && document.hasFocus()) {
      editor.commands.focus('end');
    }
  }, [editor]);

  const onEnterRef = useUpdatingRef(() => {
    if (!editor) {
      return;
    }

    const json = editor.getJSON();

    // Don't do anything if input box is empty
    if (!json.content?.some((c) => c.content)) {
      return;
    }

    onEnter(json, editor);

    const content = editor.state.toJSON().doc;
    addRef.current(content);
  }, [onEnter, editor]);

  const onClearRef = useUpdatingRef(() => {
    onClear();
  });

  const onCancelRef = useUpdatingRef(() => {
    onCancel();
  });

  const insertCharacterWithWhitespace = useCallback(
    (char: string) => {
      if (editor) {
        const text = editor.getText();
        if (!text.endsWith(char)) {
          if (text.length > 0 && !text.endsWith(' ')) {
            editor.commands.insertContent(` ${char}`);
          } else {
            editor.commands.insertContent(char);
          }
          editor.commands.focus('end');
        }
      }
    },
    [editor]
  );

  return (
    <div
      onClick={() => {
        editor && editor.commands.focus();
      }}
      className={`ring-offset-background focus-visible:ring-ring flex min-h-[80px] w-full flex-col rounded-xs bg-input-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
      {...rest}
    >
      <EditorContent className="h-full w-full flex-1" spellCheck={false} editor={editor} />
      <InputToolbar
        disabled={false}
        onAddContextItem={() => insertCharacterWithWhitespace('@')}
        onEnter={onEnterRef.current}
        onClear={onClearRef.current}
        onCancel={onCancelRef.current}
        showCancelButton={showCancelButton}
      />
    </div>
  );
};

export default Tiptap;
