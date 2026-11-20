import { Fragment, type ComponentChildren } from 'preact';
import { Ext, LINKS, Mail, REPO, STUDIO } from './shared.tsx';

/**
 * The Markdown of the long pages: `## ` headings, paragraphs, `- ` and `1. ` lists (one item per line), `**bold**`,
 * links and two placeholders, `{email}` (the contact address) and `{sources}` (a block with the rule sources). A link
 * goes to a page of the site (`[how to play](/learn)`) or names an external address of `LINKS` (`[lila](lila)`), so
 * the addresses stay in code and a translation cannot add links of its own.
 */

/** External addresses a page can link to by name. */
export const LINK_TARGETS: Readonly<Record<string, string>> = { ...LINKS, studio: STUDIO, repo: REPO };

const INTERNAL = /^\/[a-z0-9/-]*$/;
const PLACEHOLDERS = ['email', 'sources'] as const;
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\{email\}/g;

type Block =
  | { readonly kind: 'h2'; readonly text: string }
  | { readonly kind: 'p'; readonly text: string }
  | { readonly kind: 'ul'; readonly items: readonly string[] }
  | { readonly kind: 'ol'; readonly items: readonly string[] }
  | { readonly kind: 'sources' };

const parse = (source: string): Block[] =>
  source
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Block => {
      const lines = chunk.split('\n').map((line) => line.trim());
      if (chunk === '{sources}') return { kind: 'sources' };
      if (lines.length === 1 && chunk.startsWith('## ')) return { kind: 'h2', text: chunk.slice(3) };
      if (lines.every((line) => line.startsWith('- '))) return { kind: 'ul', items: lines.map((line) => line.slice(2)) };
      if (lines.every((line) => /^\d+\. /.test(line))) return { kind: 'ol', items: lines.map((line) => line.replace(/^\d+\. /, '')) };
      return { kind: 'p', text: lines.join(' ') };
    });

const inline = (text: string): ComponentChildren[] => {
  const out: ComponentChildren[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    out.push(text.slice(last, match.index));
    const [whole, bold, label, target] = match;
    if (bold !== undefined) out.push(<b>{inline(bold)}</b>);
    else if (label !== undefined && target !== undefined) {
      if (INTERNAL.test(target)) out.push(<a href={target}>{inline(label)}</a>);
      else if (LINK_TARGETS[target]) out.push(<Ext href={LINK_TARGETS[target]}>{inline(label)}</Ext>);
      else out.push(label);
    } else if (whole === '{email}') out.push(<Mail />);
    last = match.index + whole.length;
  }
  out.push(text.slice(last));
  return out.filter((part) => part !== '');
};

/** What is wrong with a page's Markdown for the site: links to unknown targets, unknown placeholders, open bold. */
export const markdownProblems = (source: string): string[] => {
  const problems: string[] = [];
  for (const [, , target] of source.matchAll(/\[([^\]]+)\]\(([^)]*)\)/g)) {
    if (!target || !(INTERNAL.test(target) || LINK_TARGETS[target])) problems.push(`unknown link target ${target ?? ''}`);
  }
  for (const [, name] of source.matchAll(/\{([^}]*)\}/g)) if (!(PLACEHOLDERS as readonly string[]).includes(name ?? '')) problems.push(`unknown placeholder {${name}}`);
  for (const line of source.split('\n')) if ((line.match(/\*\*/g) ?? []).length % 2) problems.push(`open bold in "${line.slice(0, 40)}"`);
  return problems;
};

export const placeholdersOf = (source: string): string[] => [...new Set([...source.matchAll(/\{(\w+)\}/g)].map(([, name]) => name!))].sort();

interface MarkdownProps {
  readonly source: string;
  /** Rendered where the page has `{sources}`. */
  readonly sources?: ComponentChildren;
  readonly listClass?: string;
}

export const Markdown = ({ source, sources, listClass }: MarkdownProps) => (
  <>
    {parse(source).map((block, index) => {
      if (block.kind === 'h2') return <h2 key={index}>{inline(block.text)}</h2>;
      if (block.kind === 'p') return <p key={index}>{inline(block.text)}</p>;
      if (block.kind === 'sources') return <Fragment key={index}>{sources}</Fragment>;
      const items = block.items.map((item, i) => <li key={i}>{inline(item)}</li>);
      return block.kind === 'ul' ? (
        <ul key={index} class={listClass}>
          {items}
        </ul>
      ) : (
        <ol key={index}>{items}</ol>
      );
    })}
  </>
);

/** The FAQ: each `## ` heading is a question, and the Markdown up to the next one is its answer. */
export const faqItems = (source: string): Array<{ readonly q: string; readonly a: string }> =>
  source
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const [q = '', ...rest] = part.split('\n');
      return { q: q.trim(), a: rest.join('\n').trim() };
    })
    .filter((item) => item.q && item.a);

