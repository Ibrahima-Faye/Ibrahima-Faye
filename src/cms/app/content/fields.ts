/**
 * Champs du Contenu du site.
 *
 * Chaque champ affiche le texte ACTUEL du site (valeur réglée, sinon valeur d'origine du code) :
 * on modifie le texte en place. Seul ce qui diffère de l'origine est enregistré ; revenir au texte
 * d'origine (ou ↺) retire le réglage — le fichier ne recopie jamais les textes du code.
 */
import { h, icon, type Child } from '../ui';
import { getPath, row, setPath } from '../studio/controls';
import type { StudioState } from '../studio/state';
import type { SettingsName } from '../types';

export interface FieldContext {
  state: StudioState;
  /** Dictionnaire d'origine (src/i18n/ui/fr.ts). */
  dictionary: Record<string, unknown>;
  /** Redessine l'éditeur (après une modification de structure : ajout, ordre…). */
  redraw: () => void;
}

const texts = (ctx: FieldContext) =>
  (ctx.state.get('content').texts ?? {}) as Record<string, string | string[]>;

/* ------------------------------------------------------------------ zones de saisie */
function input(value: string, placeholder: string, onInput: (v: string) => void) {
  const el = h('input', { type: 'text', class: 'st-input', value, placeholder });
  el.addEventListener('input', () => onInput(el.value));
  return el;
}

function area(value: string, placeholder: string, onInput: (v: string) => void, rows = 4) {
  const el = h('textarea', { class: 'st-input st-textarea ce-area', rows, placeholder }, value);
  const fit = () => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(520, el.scrollHeight + 2)}px`;
  };
  el.addEventListener('input', () => {
    fit();
    onInput(el.value);
  });
  requestAnimationFrame(fit);
  return el;
}

/** Texte long avec Markdown léger : **gras**, *italique*, [lien](url), listes « - », paragraphes. */
export function richText(value: string, placeholder: string, onInput: (v: string) => void) {
  const el = area(value, placeholder, onInput, 5);
  const wrap = (before: string, after = before, fallback = 'texte') => {
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const selected = v.slice(a, b) || fallback;
    el.setRangeText(`${before}${selected}${after}`, a, b, 'select');
    el.dispatchEvent(new Event('input'));
    el.focus();
  };
  const list = () => {
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const start = v.lastIndexOf('\n', a - 1) + 1;
    const block = v.slice(start, b) || 'élément';
    el.setRangeText(
      block
        .split('\n')
        .map((l) => (l.startsWith('- ') ? l : `- ${l}`))
        .join('\n'),
      start,
      b,
      'end',
    );
    el.dispatchEvent(new Event('input'));
    el.focus();
  };
  const tool = (label: string, title: string, fn: () => void) =>
    h('button', { type: 'button', class: 'ce-tool', title, onclick: fn }, label);
  return h(
    'div',
    { class: 'ce-rich' },
    h(
      'div',
      { class: 'ce-toolbar' },
      tool('B', 'Gras (**texte**)', () => wrap('**')),
      tool('I', 'Italique (*texte*)', () => wrap('*')),
      tool('🔗', 'Lien ([texte](https://…))', () => wrap('[', '](https://)', 'texte du lien')),
      tool('• Liste', 'Liste (une ligne par élément, « - » devant)', list),
      h('span', { class: 'ce-toolbar-hint' }, 'Ligne vide = nouveau paragraphe'),
    ),
    el,
  );
}

/* ------------------------------------------------------------------ texte du dictionnaire */
/**
 * Texte du site repéré par son chemin dans le dictionnaire (ex. « hero.eyebrow »).
 * `kind` : ligne, texte long, Markdown, liste (une ligne par élément), paragraphes (ligne vide).
 */
export function dictField(
  ctx: FieldContext,
  label: string,
  path: string,
  kind: 'line' | 'text' | 'rich' | 'lines' | 'paragraphs' = 'line',
  hint?: string,
) {
  const origin = getPath(ctx.dictionary, path) as string | string[] | undefined;
  const own = texts(ctx)[path];
  const sep = kind === 'paragraphs' ? '\n\n' : '\n';
  const show = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(sep) : (v ?? ''));
  const originText = show(origin);
  const current = own !== undefined ? show(own) : originText;

  const write = (raw: string) => {
    const parse = (v: string): string | string[] =>
      Array.isArray(origin)
        ? v
            .split(kind === 'paragraphs' ? /\n\s*\n/ : /\n/)
            .map((x) => x.trim())
            .filter(Boolean)
        : v;
    const next = parse(raw);
    const same =
      JSON.stringify(next) === JSON.stringify(origin) || (typeof next === 'string' && !next.trim());
    ctx.state.change('content', (d) => {
      d.texts ??= {};
      const t = d.texts as Record<string, unknown>;
      if (same) delete t[path];
      else t[path] = next;
      if (!Object.keys(t).length) delete d.texts;
    });
    rowEl.classList.toggle('is-custom', !same);
  };

  const control =
    kind === 'line'
      ? input(current, originText, write)
      : kind === 'rich' || kind === 'paragraphs'
        ? richText(current, originText, write)
        : area(current, originText, write, kind === 'lines' ? 3 : 3);
  const rowEl = row(label, control, {
    customized: own !== undefined,
    onReset: () => {
      ctx.state.change('content', (d) => {
        const t = (d.texts ?? {}) as Record<string, unknown>;
        delete t[path];
        if (!Object.keys(t).length) delete d.texts;
      });
      ctx.redraw();
    },
    hint: hint ?? (kind === 'lines' ? 'Une ligne par élément.' : undefined),
  });
  return rowEl;
}

/* ------------------------------------------------------------------ valeur d'un fichier de réglages */
/** Champ enregistré dans un fichier de réglages (chemin « a.b »), avec sa valeur d'origine. */
export function valueField(
  ctx: FieldContext,
  label: string,
  doc: SettingsName,
  path: string,
  origin: string,
  kind: 'line' | 'text' | 'rich' = 'line',
  hint?: string,
) {
  const own = getPath(ctx.state.get(doc), path) as string | undefined;
  const current = own ?? origin;
  const write = (v: string) => {
    const same = v.trim() === origin.trim();
    ctx.state.change(doc, (d) => setPath(d, path, same || (!v.trim() && !origin) ? undefined : v));
    rowEl.classList.toggle('is-custom', !same);
  };
  const control =
    kind === 'line'
      ? input(current, origin || '(vide)', write)
      : kind === 'rich'
        ? richText(current, origin || '(vide)', write)
        : area(current, origin || '(vide)', write);
  const rowEl = row(label, control, {
    customized: own !== undefined,
    onReset: () => {
      ctx.state.change(doc, (d) => setPath(d, path, undefined));
      ctx.redraw();
    },
    hint,
  });
  return rowEl;
}

/* ------------------------------------------------------------------ listes éditables */
export interface ListOptions<T> {
  items: T[];
  /** Enregistre la nouvelle liste (ordre, ajout, retrait). */
  save: (items: T[]) => void;
  title: (item: T, index: number) => string;
  body: (item: T, index: number, update: (patch: Partial<T>) => void) => Child;
  visible?: (item: T) => boolean;
  toggleVisible?: (item: T) => T;
  removable?: (item: T) => boolean;
  add?: { label: string; create: () => T };
}

export function listEditor<T>(ctx: FieldContext, options: ListOptions<T>) {
  const { items } = options;
  /** Liste à jour : plusieurs champs d'un même élément peuvent changer sans redessin. */
  let current = [...items];
  const commit = (next: T[]) => {
    current = next;
    options.save(next);
    ctx.redraw();
  };
  const move = (i: number, delta: number) => {
    const next = [...current];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    commit(next);
  };
  return h(
    'div',
    { class: 'ce-list' },
    items.map((item, i) => {
      const visible = options.visible?.(item) ?? true;
      const update = (patch: Partial<T>) => {
        current = current.map((x, j) => (j === i ? { ...x, ...patch } : x));
        options.save(current);
      };
      return h(
        'details',
        { class: `ce-item${visible ? '' : ' is-hidden'}` },
        h(
          'summary',
          null,
          h('span', { class: 'ce-item-num' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'ce-item-title' }, options.title(item, i)),
          h(
            'span',
            { class: 'ce-item-actions' },
            h(
              'button',
              {
                type: 'button',
                class: 'st-icon-btn',
                title: 'Monter',
                disabled: i === 0,
                onclick: (e: Event) => (e.preventDefault(), move(i, -1)),
              },
              '↑',
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'st-icon-btn',
                title: 'Descendre',
                disabled: i === items.length - 1,
                onclick: (e: Event) => (e.preventDefault(), move(i, 1)),
              },
              '↓',
            ),
            options.toggleVisible
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'st-icon-btn',
                    title: visible ? 'Masquer' : 'Afficher',
                    onclick: (e: Event) => {
                      e.preventDefault();
                      commit(current.map((x, j) => (j === i ? options.toggleVisible!(x) : x)));
                    },
                  },
                  icon(visible ? 'eye' : 'eyeOff', 15),
                )
              : null,
            options.removable?.(item)
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'st-icon-btn',
                    title: 'Retirer',
                    onclick: (e: Event) => {
                      e.preventDefault();
                      commit(current.filter((_, j) => j !== i));
                    },
                  },
                  icon('trash', 14),
                )
              : null,
          ),
        ),
        h('div', { class: 'ce-item-body' }, options.body(item, i, update)),
      );
    }),
    options.add
      ? h(
          'button',
          {
            type: 'button',
            class: 'cms-btn is-ghost ce-add',
            onclick: () => commit([...current, options.add!.create()]),
          },
          icon('plus', 15),
          options.add.label,
        )
      : null,
  );
}

/** Petite ligne libre (dans un élément de liste). */
export function plainInput(
  label: string,
  value: string | undefined,
  placeholder: string,
  onInput: (v: string | undefined) => void,
) {
  return row(
    label,
    input(value ?? '', placeholder, (v) => onInput(v.trim() ? v : undefined)),
  );
}

export function plainRich(
  label: string,
  value: string | undefined,
  placeholder: string,
  onInput: (v: string | undefined) => void,
) {
  return row(
    label,
    richText(value ?? '', placeholder, (v) => onInput(v.trim() ? v : undefined)),
  );
}

export function heading(title: string, hint?: string) {
  return h(
    'div',
    { class: 'ce-heading' },
    h('h3', null, title),
    hint ? h('p', { class: 'st-hint' }, hint) : null,
  );
}
