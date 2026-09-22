// Presentation-layer types: Core / Refinements are purely a view over the existing
// semantic diagram (nodeDataArray/linkDataArray/ClusterGroups). They only ever
// reference element keys - they never duplicate or replace semantic data, and are
// never read by the Knowledge Graph exporter.

export interface PresentationCore {
  id: string;
  label: string;
  elementIds: string[];
}

export interface PresentationRefinement {
  id: string;
  label: string;
  elementIds: string[];
  visible: boolean;
}

export interface Presentation {
  core: PresentationCore | null;
  refinements: PresentationRefinement[];
}

export function createEmptyPresentation(): Presentation {
  return { core: null, refinements: [] };
}

// Old .boxology files have no `presentation` key at all; this makes loading them
// behave exactly like starting with an empty presentation layer.
export function normalizePresentation(raw: any): Presentation {
  if (!raw || typeof raw !== 'object') return createEmptyPresentation();

  const core: PresentationCore | null =
    raw.core && Array.isArray(raw.core.elementIds)
      ? {
          id: String(raw.core.id || 'core'),
          label: String(raw.core.label || 'Core System'),
          elementIds: raw.core.elementIds.map(String),
        }
      : null;

  const refinements: PresentationRefinement[] = Array.isArray(raw.refinements)
    ? raw.refinements
        .filter((r: any) => r && typeof r === 'object')
        .map((r: any) => ({
          id: String(r.id || `refinement_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
          label: String(r.label || 'Refinement'),
          elementIds: Array.isArray(r.elementIds) ? r.elementIds.map(String) : [],
          visible: r.visible !== false,
        }))
    : [];

  return { core, refinements };
}
