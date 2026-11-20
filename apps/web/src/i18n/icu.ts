/**
 * A small ICU MessageFormat interpreter for the translations: `{name}` arguments, `{n, plural, =0 {…} one {…} other {…}}`
 * with `#` for the number, `{x, select, a {…} other {…}}`, and `<tag>…</tag>` around a part of the text, which the
 * caller turns into markup. Apostrophes quote as in ICU: `''` is one apostrophe, `'{'` a literal brace.
 * Numbers are written as the code passes them (no thousands separators), as the site always did.
 */

type Node =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'arg'; readonly name: string }
  | { readonly kind: 'pound' }
  | { readonly kind: 'plural' | 'select'; readonly name: string; readonly branches: ReadonlyMap<string, Node[]> }
  | { readonly kind: 'tag'; readonly name: string; readonly children: Node[] };

export class IcuError extends Error {}

const parse = (source: string): Node[] => {
  let i = 0;
  const fail = (message: string): never => {
    throw new IcuError(`${message} at ${i} in "${source}"`);
  };

  const parseText = (inPlural: boolean, stop: (c: string) => boolean): Node[] => {
    const nodes: Node[] = [];
    let text = '';
    const flush = () => {
      if (text) nodes.push({ kind: 'text', value: text });
      text = '';
    };
    while (i < source.length) {
      const c = source[i]!;
      if (stop(c)) break;
      if (c === "'") {
        const next = source[i + 1];
        if (next === "'") {
          text += "'";
          i += 2;
        } else if (next === '{' || next === '}' || next === '<' || (inPlural && next === '#')) {
          const end = source.indexOf("'", i + 1);
          if (end === -1) fail('unclosed quote');
          text += source.slice(i + 1, end);
          i = end + 1;
        } else {
          text += c;
          i++;
        }
      } else if (c === '{') {
        flush();
        nodes.push(parseArgument(inPlural));
      } else if (c === '#' && inPlural) {
        flush();
        nodes.push({ kind: 'pound' });
        i++;
      } else if (c === '<' && /^<[a-z][a-z0-9]*>/i.test(source.slice(i))) {
        flush();
        const name = source.slice(i + 1, source.indexOf('>', i));
        i = source.indexOf('>', i) + 1;
        const close = `</${name}>`;
        const children = parseText(inPlural, () => source.startsWith(close, i));
        if (!source.startsWith(close, i)) fail(`unclosed <${name}>`);
        i += close.length;
        nodes.push({ kind: 'tag', name, children });
      } else if (c === '<' && source.startsWith('</', i)) {
        break;
      } else {
        text += c;
        i++;
      }
    }
    flush();
    return nodes;
  };

  const skipSpace = () => {
    while (/\s/.test(source[i] ?? '')) i++;
  };
  const word = () => {
    skipSpace();
    const start = i;
    while (i < source.length && !/[\s,{}]/.test(source[i]!)) i++;
    return source.slice(start, i);
  };

  const parseArgument = (inPlural: boolean): Node => {
    i++;
    const name = word();
    skipSpace();
    if (source[i] === '}') {
      i++;
      return { kind: 'arg', name };
    }
    if (source[i] !== ',') fail('expected , or }');
    i++;
    const type = word();
    if (type !== 'plural' && type !== 'select') return fail(`unknown type ${type}`);
    skipSpace();
    if (source[i] !== ',') fail('expected ,');
    i++;
    const branches = new Map<string, Node[]>();
    for (;;) {
      skipSpace();
      if (source[i] === '}') {
        i++;
        break;
      }
      const key = word();
      skipSpace();
      if (source[i] !== '{') fail(`expected { after ${key}`);
      i++;
      branches.set(key, parseText(type === 'plural' || inPlural, (c) => c === '}'));
      if (source[i] !== '}') fail('unclosed branch');
      i++;
    }
    if (!branches.has('other')) fail('missing other');
    return { kind: type, name, branches };
  };

  const nodes = parseText(false, () => false);
  if (i < source.length) fail('unexpected text');
  return nodes;
};

const cache = new Map<string, Node[]>();
const compiled = (source: string): Node[] => {
  let nodes = cache.get(source);
  if (!nodes) {
    nodes = parse(source);
    cache.set(source, nodes);
  }
  return nodes;
};

/** Throws an `IcuError` when the message is not valid ICU for this interpreter. */
export const checkMessage = (source: string): void => {
  compiled(source);
};

const namesOf = (source: string, kind: 'arg' | 'tag'): string[] => {
  const names: string[] = [];
  const add = (name: string) => {
    if (!names.includes(name)) names.push(name);
  };
  const walk = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (kind === 'arg' && (node.kind === 'arg' || node.kind === 'plural' || node.kind === 'select')) add(node.name);
      if (kind === 'tag' && node.kind === 'tag') add(node.name);
      if (node.kind === 'plural' || node.kind === 'select') for (const branch of node.branches.values()) walk(branch);
      if (node.kind === 'tag') walk(node.children);
    }
  };
  walk(compiled(source));
  return names;
};

/** The argument names a message uses, in order of first appearance. */
export const argumentsOf = (source: string): string[] => namesOf(source, 'arg');

/** The tag names a message uses, in order of first appearance. */
export const tagsOf = (source: string): string[] => namesOf(source, 'tag');

export type Args = Readonly<Record<string, unknown>>;

/** Turns `<tag>…</tag>` into markup; without a handler for a tag, its content is kept as is. */
export type Tags<T> = Readonly<Record<string, (children: Array<string | T>) => T>>;

const run = <T>(nodes: readonly Node[], args: Args, locale: string, tags: Tags<T>, pound: number | null): Array<string | T> => {
  const out: Array<string | T> = [];
  const push = (value: string | T) => {
    if (typeof value === 'string' && typeof out[out.length - 1] === 'string') out[out.length - 1] += value;
    else out.push(value);
  };
  for (const node of nodes) {
    if (node.kind === 'text') push(node.value);
    else if (node.kind === 'pound') push(String(pound ?? ''));
    else if (node.kind === 'arg') {
      const value = args[node.name];
      push(value === null || value === undefined ? '' : typeof value === 'string' || typeof value === 'number' ? String(value) : (value as T));
    } else if (node.kind === 'plural') {
      const n = Number(args[node.name]);
      const branch = node.branches.get(`=${n}`) ?? node.branches.get(new Intl.PluralRules(locale).select(n)) ?? node.branches.get('other')!;
      for (const part of run(branch, args, locale, tags, n)) push(part);
    } else if (node.kind === 'select') {
      const value = args[node.name];
      const key = value === null || value === undefined ? 'none' : value === '' ? 'empty' : String(value);
      for (const part of run(node.branches.get(key) ?? node.branches.get('other')!, args, locale, tags, pound)) push(part);
    } else if (node.kind === 'tag') {
      const children = run(node.children, args, locale, tags, pound);
      const handler = tags[node.name];
      if (handler) push(handler(children));
      else for (const part of children) push(part);
    }
  }
  return out;
};

/** The message as text. */
export const formatText = (source: string, args: Args, locale: string): string => run<string>(compiled(source), args, locale, {}, null).join('');

/** The message as a list of text and markup, for messages with tags or with markup passed as arguments. */
export const formatParts = <T>(source: string, args: Args, locale: string, tags: Tags<T>): Array<string | T> => run(compiled(source), args, locale, tags, null);
