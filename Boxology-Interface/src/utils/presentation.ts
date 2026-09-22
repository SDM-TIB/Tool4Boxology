// Presentation (Core / Refinement) helpers.
//
// These operate purely on element keys and the live GoJS diagram/model. They never
// touch the Knowledge Graph exporter (buildDesignPatternsFromModelData /
// generateMultiPageRMLExport), which keeps reading nodeDataArray/linkDataArray/
// ClusterGroups exactly as before.
import * as go from 'gojs';
import type { Presentation } from '../types/presentation';

/**
 * Keys that must be hidden given the current presentation state.
 *
 * An element referenced by the Core or by a *visible* refinement is always
 * protected, even if some other hidden refinement also references it (shared
 * element safety - see spec section 17). Hiding a ClusterGroup also hides its
 * member nodes, since GoJS does not do this automatically for `visible=false`
 * on a Group.
 */
export function computeHiddenKeys(nodeDataArray: any[], presentation: Presentation): Set<string> {
  const coreKeys = new Set<string>(presentation.core?.elementIds ?? []);
  const visibleRefKeys = new Set<string>();
  const hiddenRefKeys = new Set<string>();

  for (const r of presentation.refinements) {
    const target = r.visible ? visibleRefKeys : hiddenRefKeys;
    r.elementIds.forEach((id) => target.add(String(id)));
  }

  const protectedKeys = new Set<string>([...coreKeys, ...visibleRefKeys]);
  const hiddenKeys = new Set<string>([...hiddenRefKeys].filter((k) => !protectedKeys.has(k)));

  // Expand to member nodes of hidden groups (fixed point, in case of nested groups).
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodeDataArray) {
      const key = String(n.key);
      if (n.isGroup || hiddenKeys.has(key) || protectedKeys.has(key)) continue;
      if (!n.group || !hiddenKeys.has(String(n.group))) continue;

      // A shared node stays visible if any of its other groups is not hidden.
      const isSharedElsewhere =
        n.isShared && Array.isArray(n.sharedGroups) && n.sharedGroups.some((g: string) => !hiddenKeys.has(String(g)));
      if (isSharedElsewhere) continue;

      hiddenKeys.add(key);
      changed = true;
    }
  }

  return hiddenKeys;
}

/** Apply presentation visibility to the live diagram without touching model data. */
export function applyPresentationVisibility(diagram: go.Diagram, presentation: Presentation) {
  if (!diagram) return;
  const model = diagram.model as go.GraphLinksModel;
  const nodeDataArray = (model.nodeDataArray ?? []) as any[];
  const hiddenKeys = computeHiddenKeys(nodeDataArray, presentation);

  diagram.nodes.each((node) => {
    node.visible = !hiddenKeys.has(String(node.data?.key));
  });
  diagram.links.each((link) => {
    const data = link.data ?? {};
    const linkKey = data.key !== undefined ? String(data.key) : null;
    const hidden =
      hiddenKeys.has(String(data.from)) || hiddenKeys.has(String(data.to)) || (linkKey !== null && hiddenKeys.has(linkKey));
    link.visible = !hidden;
  });
}

/** Element keys (nodes, groups, links-with-keys) currently selected on the diagram. */
export function getSelectedElementIds(diagram: go.Diagram): string[] {
  const ids: string[] = [];
  diagram.selection.each((part) => {
    if (part instanceof go.Node && part.data?.key !== undefined) {
      ids.push(String(part.data.key));
    } else if (part instanceof go.Link && part.data?.key !== undefined) {
      ids.push(String(part.data.key));
    }
  });
  return ids;
}

/** Element ids referenced by this refinement and no other core/refinement. */
export function computeExclusiveElementIds(presentation: Presentation, refinementId: string): string[] {
  const refinement = presentation.refinements.find((r) => r.id === refinementId);
  if (!refinement) return [];

  const referencedElsewhere = new Set<string>([
    ...(presentation.core?.elementIds ?? []),
    ...presentation.refinements.filter((r) => r.id !== refinementId).flatMap((r) => r.elementIds),
  ]);

  return refinement.elementIds.filter((id) => !referencedElsewhere.has(id));
}

/**
 * Delete elements exclusively owned by a removed refinement from the underlying
 * model: the referenced nodes/groups, member nodes of removed groups (unless
 * shared with a surviving group), and any links left dangling.
 */
export function removeExclusiveElements(diagram: go.Diagram, exclusiveIds: string[]) {
  if (exclusiveIds.length === 0) return;
  const model = diagram.model as go.GraphLinksModel;
  const nodeDataArray = (model.nodeDataArray ?? []) as any[];
  const idSet = new Set(exclusiveIds);

  const removedGroupKeys = new Set(
    nodeDataArray.filter((n) => n.isGroup && idSet.has(String(n.key))).map((n) => String(n.key))
  );

  const removeKeys = new Set(idSet);
  for (const n of nodeDataArray) {
    if (n.isGroup || !n.group || !removedGroupKeys.has(String(n.group))) continue;
    const isSharedElsewhere =
      n.isShared && Array.isArray(n.sharedGroups) && n.sharedGroups.some((g: string) => !removedGroupKeys.has(String(g)));
    if (!isSharedElsewhere) removeKeys.add(String(n.key));
  }

  diagram.startTransaction('remove refinement elements');
  const linksToRemove = ((model.linkDataArray ?? []) as any[]).filter(
    (l) => removeKeys.has(String(l.from)) || removeKeys.has(String(l.to)) || (l.key !== undefined && removeKeys.has(String(l.key)))
  );
  linksToRemove.forEach((l) => model.removeLinkData(l));

  const nodesToRemove = nodeDataArray.filter((n) => removeKeys.has(String(n.key)));
  nodesToRemove.forEach((n) => model.removeNodeData(n));
  diagram.commitTransaction('remove refinement elements');
}
