import { textblockTypeInputRule } from "prosemirror-inputrules";
import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import { type Node, Schema } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import type { Transaction } from "prosemirror-state";
import { tableNodes } from "prosemirror-tables";
import type { EditorView } from "prosemirror-view";
import type { MutableRefObject } from "react";

export const documentSchema = new Schema({
  nodes: addListNodes(
    schema.spec.nodes.append(
      tableNodes({
        tableGroup: "block",
        cellContent: "block+",
        cellAttributes: {},
      })
    ),
    "paragraph block*",
    "block"
  ),
  marks: schema.spec.marks,
});

// Ponytail: extend default markdown serializer with table support.
// Writes GFM table syntax; child node serializers are no-ops since
// table() handles row/cell content inline.
const serializeTable = (state: MarkdownSerializerState, node: Node) => {
  const rows: string[] = [];
  for (let r = 0; r < node.children.length; r++) {
    // biome-ignore lint/style/noNonNullAssertion: Index is within bounds of node.children
    const row = node.children[r]!;
    const cells: string[] = [];
    for (const cell of row.children) {
      let text = "";
      if (cell.isText) {
        text += cell.text;
      }
      cells.push(text);
    }
    rows.push(`| ${cells.join(" | ")} |`);
    if (r === 0) {
      rows.push(`| ${cells.map(() => "---").join(" | ")} |`);
    }
  }
  state.text(rows.join("\n"), false);
};

const tableMarkdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    table: serializeTable,
    // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional serializer stubs — parent table() handles row/cell content inline
    table_row: () => {},
    // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional serializer stubs — parent table() handles row/cell content inline
    table_cell: () => {},
    // biome-ignore lint/suspicious/noEmptyBlockStatements: Intentional serializer stubs — parent table() handles row/cell content inline
    table_header: () => {},
  },
  defaultMarkdownSerializer.marks
);

export const buildContentFromDocument = (document: Node) => {
  return tableMarkdownSerializer.serialize(document);
};

export function headingRule(level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${level}})\\s$`),
    documentSchema.nodes.heading,
    () => ({ level })
  );
}

export const handleTransaction = ({
  transaction,
  editorRef,
  onSaveContent,
}: {
  transaction: Transaction;
  editorRef: MutableRefObject<EditorView | null>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}) => {
  if (!editorRef?.current) {
    return;
  }

  const newState = editorRef.current.state.apply(transaction);
  editorRef.current.updateState(newState);

  if (transaction.docChanged && !transaction.getMeta("no-save")) {
    const updatedContent = buildContentFromDocument(newState.doc);

    if (transaction.getMeta("no-debounce")) {
      onSaveContent(updatedContent, false);
    } else {
      onSaveContent(updatedContent, true);
    }
  }
};
