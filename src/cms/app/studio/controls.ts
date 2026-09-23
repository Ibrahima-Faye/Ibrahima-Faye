/**
 * Contrôles du Studio : couleur, curseur, liste, interrupteur, texte, valeurs par appareil.
 * Chaque contrôle affiche la valeur d'origine du site tant que rien n'est réglé, et un bouton ↺
 * pour revenir à cette valeur (le réglage est alors retiré du fichier, pas recopié).
 */
import { h, icon, type Child } from '../ui';

export type DeviceKey = 'desktop' | 'tablet' | 'mobile';
export const DEVICE_LABELS: Record<DeviceKey, string> = {
  desktop: 'Ordinateur',
  tablet: 'Tablette',
  mobile: 'Mobile',
};

/* ------------------------------------------------------------------ chemins « a.b.c » */
export function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], obj);
}

/** Écrit une valeur ; `undefined` la retire (et retire les objets devenus vides). */
export function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  const parents: Record<string, unknown>[] = [];
  let node = obj;
  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null || Array.isArray(node[key])) {
      if (value === undefined) return;
      node[key] = {};
    }
    parents.push(node);
    node = node[key] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1]!;
  if (value === undefined) delete node[last];
  else node[last] = value;
  // nettoyage des objets vides
  for (let i = keys.length - 2; i >= 0; i--) {
    const parent = parents[i]!;
    const child = parent[keys[i]!] as Record<string, unknown>;
    if (child && typeof child === 'object' && !Array.isArray(child) && !Object.keys(child).length)
      delete parent[keys[i]!];
  }
}

/* ------------------------------------------------------------------ mise en page */
export function group(title: string, children: Child[], open = false, extra?: Child) {
  return h(
    'details',
    { class: 'st-group', open },
    h('summary', null, h('span', null, title), extra ?? null),
    h('div', { class: 'st-group-body' }, children),
  );
}

export function row(
  label: string,
  control: Child,
  options: { hint?: string; customized?: boolean; onReset?: () => void; scope?: Child } = {},
) {
  return h(
    'div',
    { class: `st-row${options.customized ? ' is-custom' : ''}` },
    h(
      'div',
      { class: 'st-row-head' },
      h('label', null, label),
      options.scope ?? null,
      options.customized && options.onReset
        ? h(
            'button',
            {
              type: 'button',
              class: 'st-reset',
              title: 'Revenir à la valeur d’origine',
              onclick: options.onReset,
            },
            icon('refresh', 13),
          )
        : null,
    ),
    control,
    options.hint ? h('p', { class: 'st-hint' }, options.hint) : null,
  );
}

/* ------------------------------------------------------------------ contrôles */
const HEX = /^#[0-9a-f]{6}$/i;

export function colorControl(
  value: string | undefined,
  fallback: string,
  onInput: (v: string | undefined) => void,
) {
  const current = value ?? fallback;
  const picker = h('input', {
    type: 'color',
    class: 'st-color',
    value: HEX.test(current) ? current : '#7b4dff',
  });
  const text = h('input', {
    type: 'text',
    class: 'st-input st-mono',
    value: current,
    spellcheck: 'false',
  });
  picker.addEventListener('input', () => {
    text.value = picker.value;
    onInput(picker.value);
  });
  text.addEventListener('change', () => {
    const v = text.value.trim();
    if (HEX.test(v)) picker.value = v;
    onInput(v || undefined);
  });
  return h(
    'div',
    { class: 'st-color-row' },
    h('span', { class: 'st-swatch', style: `--c:${current}` }, picker),
    text,
  );
}

export function rangeControl(
  value: number | undefined,
  fallback: number,
  opts: { min: number; max: number; step: number; unit?: string },
  onInput: (v: number) => void,
) {
  const current = value ?? fallback;
  const range = h('input', {
    type: 'range',
    class: 'st-range',
    min: opts.min,
    max: opts.max,
    step: opts.step,
    value: current,
  });
  const number = h('input', {
    type: 'number',
    class: 'st-input st-num',
    min: opts.min,
    max: opts.max,
    step: opts.step,
    value: current,
  });
  const unit = opts.unit ? h('span', { class: 'st-unit' }, opts.unit) : null;
  range.addEventListener('input', () => {
    number.value = range.value;
    onInput(Number(range.value));
  });
  number.addEventListener('change', () => {
    const v = Number(number.value);
    if (!Number.isFinite(v)) return;
    range.value = String(v);
    onInput(v);
  });
  return h(
    'div',
    { class: 'st-range-row' },
    range,
    h('span', { class: 'st-num-wrap' }, number, unit),
  );
}

export function selectControl<T extends string>(
  value: T | undefined,
  options: readonly { value: T | ''; label: string; group?: string }[],
  onChange: (v: T | undefined) => void,
) {
  const select = h('select', { class: 'st-input' });
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const o of options) {
    const option = h('option', { value: o.value, selected: (value ?? '') === o.value }, o.label);
    if (o.group) {
      if (!groups.has(o.group)) {
        const g = h('optgroup', { label: o.group });
        groups.set(o.group, g);
        select.append(g);
      }
      groups.get(o.group)!.append(option);
    } else select.append(option);
  }
  select.addEventListener('change', () => onChange((select.value || undefined) as T | undefined));
  return select;
}

export function segmented<T extends string>(
  value: T,
  options: readonly { value: T; label: string; title?: string }[],
  onChange: (v: T) => void,
) {
  const wrap = h('div', { class: 'st-seg', role: 'group' });
  for (const o of options) {
    const button = h(
      'button',
      {
        type: 'button',
        class: `st-seg-btn${o.value === value ? ' is-on' : ''}`,
        'aria-pressed': String(o.value === value),
        title: o.title,
      },
      o.label,
    );
    button.addEventListener('click', () => {
      wrap.querySelectorAll('.st-seg-btn').forEach((b) => {
        b.classList.toggle('is-on', b === button);
        b.setAttribute('aria-pressed', String(b === button));
      });
      onChange(o.value);
    });
    wrap.append(button);
  }
  return wrap;
}

export function toggleControl(checked: boolean, onChange: (v: boolean) => void, label = '') {
  const input = h('input', { type: 'checkbox', checked, role: 'switch' });
  input.addEventListener('change', () => onChange(input.checked));
  return h(
    'label',
    { class: 'st-toggle' },
    input,
    h('span', { class: 'st-toggle-ui', 'aria-hidden': 'true' }),
    label,
  );
}

export function textControl(
  value: string | undefined,
  placeholder: string,
  onInput: (v: string | undefined) => void,
  multiline = false,
) {
  const el = multiline
    ? h('textarea', { class: 'st-input st-textarea', rows: 4, placeholder }, value ?? '')
    : h('input', { type: 'text', class: 'st-input', value: value ?? '', placeholder });
  el.addEventListener('input', () => onInput(el.value.trim() ? el.value : undefined));
  return el;
}

/**
 * Valeur éventuellement différente selon l'appareil : { desktop, tablet, mobile } ou une seule valeur.
 * `scope` : « Tous » ou un appareil ; l'interface édite la valeur de cette portée.
 */
export function responsiveScope(
  value: unknown,
  scope: 'all' | DeviceKey,
  onScope: (s: 'all' | DeviceKey) => void,
) {
  const perDevice = typeof value === 'object' && value !== null;
  return segmented<'all' | DeviceKey>(
    scope,
    [
      { value: 'all', label: 'Tous', title: 'Même valeur partout' },
      { value: 'desktop', label: 'D', title: `Ordinateur${perDevice ? '' : ''}` },
      { value: 'tablet', label: 'T', title: 'Tablette' },
      { value: 'mobile', label: 'M', title: 'Mobile' },
    ],
    onScope,
  );
}

/** Lit la valeur pour une portée. */
export function scopedValue(value: unknown, scope: 'all' | DeviceKey): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null) {
    const v = (value as Record<string, unknown>)[scope === 'all' ? 'desktop' : scope];
    return typeof v === 'number' ? v : undefined;
  }
  return undefined;
}

/** Nouvelle valeur après modification d'une portée. */
export function withScope(
  value: unknown,
  scope: 'all' | DeviceKey,
  next: number | undefined,
): unknown {
  if (scope === 'all') return next;
  const base: Record<string, number> =
    typeof value === 'object' && value !== null
      ? { ...(value as Record<string, number>) }
      : typeof value === 'number'
        ? { desktop: value, tablet: value, mobile: value }
        : {};
  if (next === undefined) delete base[scope];
  else base[scope] = next;
  return Object.keys(base).length ? base : undefined;
}
