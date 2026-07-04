import { MarkdownSerializer, type MarkdownSerializerState } from "prosemirror-markdown";
import { defaultMarkdownSerializer } from "prosemirror-markdown";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import { Schema, type Node } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { tableNodes } from "prosemirror-tables";
import type { Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { MutableRefObject } from "react";

export const documentSchema = new Schema({
  nodes: addListNodes(
    schema.spec.nodes.append(
      tableNodes({
        tableGroup: "block",
        cellContent: "block+",
        cellAttributes: {},
      }),
    ),
    "paragraph block*",
    "block",
  ),
  marks: schema.spec.marks,
});

// Ponytail: extend default markdown serializer with table support.
// Writes GFM table syntax; child node serializers are no-ops since
// table() handles row/cell content inline.
const serializeTable = (state: MarkdownSerializerState, node: Node) => {
  const rows: string[] = [];
  for (let r = 0; r < node.children.length; r++) {
    const row = node.children[r]!;
    const cells: string[] = [];
    for (let c = 0; c < row.children.length; c++) {
      const cell = row.children[c]!;
      let text = "";
      cell.forEach((child) => {
        if (child.isText) text += child.text;
      });
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
    table_row: () => {},
    table_cell: () => {},
    table_header: () => {},
  },
  defaultMarkdownSerializer.marks,
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
