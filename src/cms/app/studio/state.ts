/**
 * État du Studio : les 4 fichiers de réglages (src/settings/), enregistrement automatique,
 * annulation (Ctrl+Z / Ctrl+Maj+Z), conflits (fichier modifié ailleurs → confirmation).
 */
import { api, ApiError } from '../api';
import type { SettingsFile, SettingsName } from '../types';
import { confirmModal, toast } from '../ui';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

interface Doc {
  data: Record<string, unknown>;
  /** Dernière version enregistrée (pour « Annuler les modifications »). */
  saved: string;
  updatedAt: number;
  dirty: boolean;
  timer: number;
  undo: string[];
  redo: string[];
  lastSnapshot: number;
}

/** Délai avant enregistrement automatique (le thème et les animations se voient déjà en direct). */
const DELAY: Record<SettingsName, number> = {
  theme: 900,
  animations: 900,
  layout: 600,
  navigation: 600,
  content: 600,
};

export class StudioState {
  private docs: Record<SettingsName, Doc>;
  private listeners = new Set<(name: SettingsName) => void>();
  private statusListeners = new Set<(status: SaveStatus) => void>();
  private saving = 0;
  private failed = false;
  /** false : pas d'enregistrement automatique (Contenu du site : bouton « Enregistrer »). */
  private readonly autosave: boolean;
  /** Copie systématique de la version précédente à chaque enregistrement (historique). */
  private readonly snapshot: boolean;
  /** Appelé juste avant d'écrire un fichier (l'aperçu peut ainsi éviter de se recharger). */
  beforeSave?: (name: SettingsName) => void;
  /** Appelé après l'écriture effective d'un fichier. */
  afterSave?: (name: SettingsName) => void;

  private constructor(
    files: Record<SettingsName, SettingsFile>,
    options: { autosave?: boolean; snapshot?: boolean } = {},
  ) {
    this.autosave = options.autosave !== false;
    this.snapshot = options.snapshot === true;
    const doc = (f: SettingsFile | undefined): Doc => ({
      data: structuredClone(f?.data ?? { version: 1 }),
      saved: JSON.stringify(f?.data ?? { version: 1 }),
      updatedAt: f?.updatedAt ?? 0,
      dirty: false,
      timer: 0,
      undo: [],
      redo: [],
      lastSnapshot: 0,
    });
    this.docs = {
      theme: doc(files.theme),
      layout: doc(files.layout),
      navigation: doc(files.navigation),
      animations: doc(files.animations),
      content: doc(files.content),
    };
  }

  static async load(options: { autosave?: boolean; snapshot?: boolean } = {}) {
    return new StudioState(await api.settings(), options);
  }

  isDirty(name?: SettingsName) {
    return name ? this.docs[name].dirty : Object.values(this.docs).some((d) => d.dirty);
  }

  /** Abandonne les modifications non enregistrées (retour à la dernière version enregistrée). */
  revert(name?: SettingsName) {
    for (const n of name ? [name] : (Object.keys(this.docs) as SettingsName[])) {
      const doc = this.docs[n];
      if (!doc.dirty) continue;
      clearTimeout(doc.timer);
      doc.undo.push(JSON.stringify(doc.data));
      doc.data = JSON.parse(doc.saved);
      doc.dirty = false;
      this.listeners.forEach((fn) => fn(n));
    }
    this.emitStatus();
  }

  get<T = Record<string, unknown>>(name: SettingsName): T {
    return this.docs[name].data as T;
  }

  onChange(fn: (name: SettingsName) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: (status: SaveStatus) => void) {
    this.statusListeners.add(fn);
    fn(this.status());
    return () => this.statusListeners.delete(fn);
  }

  status(): SaveStatus {
    if (this.failed) return 'error';
    if (this.saving) return 'saving';
    return Object.values(this.docs).some((d) => d.dirty) ? 'dirty' : 'saved';
  }

  private emitStatus() {
    const s = this.status();
    this.statusListeners.forEach((fn) => fn(s));
  }

  /** Modifie un réglage. Les gestes rapprochés (curseur que l'on fait glisser) forment une seule étape d'annulation. */
  change(name: SettingsName, mutate: (data: Record<string, unknown>) => void) {
    const doc = this.docs[name];
    const now = Date.now();
    if (now - doc.lastSnapshot > 700) {
      doc.undo.push(JSON.stringify(doc.data));
      if (doc.undo.length > 60) doc.undo.shift();
      doc.redo = [];
    }
    doc.lastSnapshot = now;
    mutate(doc.data);
    this.touch(name);
  }

  /** Remplace tout le fichier (import, réinitialisation) — annulable. */
  replace(name: SettingsName, data: Record<string, unknown>) {
    const doc = this.docs[name];
    doc.undo.push(JSON.stringify(doc.data));
    doc.redo = [];
    doc.data = structuredClone(data);
    this.touch(name);
  }

  undo(name: SettingsName) {
    const doc = this.docs[name];
    const previous = doc.undo.pop();
    if (previous === undefined) return false;
    doc.redo.push(JSON.stringify(doc.data));
    doc.data = JSON.parse(previous);
    doc.lastSnapshot = 0;
    this.touch(name);
    return true;
  }

  redo(name: SettingsName) {
    const doc = this.docs[name];
    const next = doc.redo.pop();
    if (next === undefined) return false;
    doc.undo.push(JSON.stringify(doc.data));
    doc.data = JSON.parse(next);
    doc.lastSnapshot = 0;
    this.touch(name);
    return true;
  }

  private touch(name: SettingsName) {
    const doc = this.docs[name];
    doc.dirty = true;
    this.listeners.forEach((fn) => fn(name));
    this.emitStatus();
    clearTimeout(doc.timer);
    if (this.autosave) doc.timer = window.setTimeout(() => void this.save(name), DELAY[name]);
  }

  async flush() {
    await Promise.all(
      (Object.keys(this.docs) as SettingsName[])
        .filter((n) => this.docs[n].dirty)
        .map((n) => {
          clearTimeout(this.docs[n].timer);
          return this.save(n);
        }),
    );
  }

  private async save(name: SettingsName, force = false): Promise<void> {
    const doc = this.docs[name];
    if (!doc.dirty) return;
    const snapshot = JSON.stringify(doc.data);
    let retryWithForce = false;
    this.saving++;
    this.emitStatus();
    try {
      this.beforeSave?.(name);
      const result = await api.saveSettings(name, {
        data: JSON.parse(snapshot),
        baseUpdatedAt: doc.updatedAt,
        force,
        snapshot: this.snapshot,
      });
      doc.updatedAt = result.updatedAt;
      doc.saved = snapshot;
      if (JSON.stringify(doc.data) === snapshot) doc.dirty = false; // sinon : nouvelle modification entre-temps
      this.failed = false;
      if (!result.unchanged) this.afterSave?.(name);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        retryWithForce = await confirmModal({
          title: 'Réglages modifiés ailleurs',
          body: 'Ce fichier de réglages a changé depuis l’ouverture du Studio (autre onglet, éditeur de texte…). Écraser avec la version du Studio ? L’autre version reste récupérable dans .cms/historique/reglages/.',
          confirm: 'Écraser',
          danger: true,
        });
        if (!retryWithForce) this.failed = true;
      } else {
        this.failed = true;
        toast(error instanceof Error ? error.message : 'Enregistrement impossible.', 'error', 6000);
        clearTimeout(doc.timer);
        if (this.autosave) doc.timer = window.setTimeout(() => void this.save(name), 5000); // nouvel essai automatique
      }
    } finally {
      this.saving--;
      this.emitStatus();
    }
    if (retryWithForce) return this.save(name, true);
  }

  dispose() {
    Object.values(this.docs).forEach((d) => clearTimeout(d.timer));
    this.listeners.clear();
    this.statusListeners.clear();
  }
}
