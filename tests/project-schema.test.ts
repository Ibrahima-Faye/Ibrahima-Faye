/** Les 10 vrais project.md passent le schéma partagé, sans aucune modification. */
import { describe, expect, it } from 'vitest';
import { projectSchema } from '@/schemas/project';
import { EXPECTED_SLUGS, realProjects } from './helpers';

describe('project.md existants', () => {
  const projects = realProjects();

  it('les 10 projets sont présents', () => {
    expect(projects.map((p) => p.slug).sort()).toEqual(EXPECTED_SLUGS);
  });

  for (const p of projects) {
    it(`${p.slug} : valide, sans blocs (composition historique)`, () => {
      const result = projectSchema.safeParse(p.data);
      if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2));
      expect(result.data.blocks).toBeUndefined();
      expect(result.data.title).toBe(p.data.title);
    });
  }

  it('un project.md avec des blocs mal formés est refusé avec un message clair', () => {
    const p = projects[0]!;
    const result = projectSchema.safeParse({
      ...p.data,
      blocks: [{ type: 'grid', items: [{ span: 2 }] }],
    });
    expect(result.success).toBe(false);
  });
});
