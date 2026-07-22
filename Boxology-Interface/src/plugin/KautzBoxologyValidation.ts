import * as go from 'gojs';
import { kautzPatterns } from '../data/kautzPatterns';
import { shapeTypesTree, type ShapeTypeTree } from '../data/shape';

type KautzPattern = (typeof kautzPatterns)[number];
type KautzPatternNode = KautzPattern['nodes'][number];

// Finds the subtree rooted at `typeName` inside a type hierarchy such as shapeTypesTree.
// Returns `undefined` when `typeName` doesn't appear anywhere in the tree, and the
// (possibly `null`, i.e. leaf) subtree value when it does.
function findTypeSubtree(tree: ShapeTypeTree, typeName: string): ShapeTypeTree | null | undefined {
  const target = typeName.toLowerCase();
  for (const [key, value] of Object.entries(tree)) {
    if (key.toLowerCase() === target) return value;
    if (value) {
      const nested = findTypeSubtree(value, typeName);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

// True when `typeName` sits inside `ancestorTypeName`'s subtree of the type hierarchy
// (e.g. "CNN" is a descendant of "NeuralNetwork").
function isDescendantOf(typeName: string, ancestorTypeName: string): boolean {
  const subtree = findTypeSubtree(shapeTypesTree, ancestorTypeName);
  if (!subtree) return false; // ancestor not in the tree, or it's a leaf with no descendants
  return findTypeSubtree(subtree, typeName) !== undefined;
}

// Two types are compatible if one is the other (case-insensitively), or one is an
// ancestor/descendant of the other in the ontology-derived hierarchy (e.g. "CNN" is a
// NeuralNetwork). Sibling branches (e.g. "NeuralNetwork" vs "SymbolicLearningModel",
// both under Model) are NOT compatible — that is precisely the kind of type mismatch
// this pattern check needs to catch instead of silently ignoring.
function isTypeFamilyMatch(typeA: string, typeB: string): boolean {
  if (typeA.toLowerCase() === typeB.toLowerCase()) return true;
  return isDescendantOf(typeA, typeB) || isDescendantOf(typeB, typeA);
}

// A pattern rule's required type is satisfied if the node has no specific subtype set yet
// (don't punish diagrams that haven't been refined past the root category), or its type is
// in the same family as the required type.
function typeSatisfiesRule(nodeType: unknown, ruleType: string | undefined): boolean {
  if (!ruleType) return true;
  const actual = String(nodeType ?? '').trim();
  if (!actual) return true;
  return isTypeFamilyMatch(actual, ruleType);
}

interface PatternComparison {
  matches: boolean;
  matchedNodeRules: string[];
  missingNodeRules: string[];
  missingClusterRules: string[];
  missingLinks: string[];
}

function collectScopedNodes(diagram: go.Diagram, selectionOnly: boolean): go.Node[] {
  const nodes: go.Node[] = [];

  if (selectionOnly) {
    diagram.selection.each((part) => {
      if (part instanceof go.Node && !part.data?.isGroup && part.category !== 'ClusterGroup') {
        nodes.push(part);
      }
    });
    return nodes;
  }

  diagram.nodes.each((node) => {
    if (!node.data?.isGroup && node.category !== 'ClusterGroup') {
      nodes.push(node);
    }
  });

  return nodes;
}

function groupLabelsForNode(diagram: go.Diagram, node: go.Node): Set<string> {
  const labels = new Set<string>();
  const groupKeys = [node.data?.group, ...(Array.isArray(node.data?.sharedGroups) ? node.data.sharedGroups : [])];

  groupKeys.forEach((groupKey) => {
    if (!groupKey) return;
    const group = diagram.findNodeForKey(groupKey);
    const label = String(group?.data?.label ?? '').trim();
    if (label) labels.add(label);
  });

  return labels;
}

function describeNodeRule(node: KautzPatternNode): string {
  return `${node.label} (${node.name}${node.type ? ` / ${node.type}` : ''})`;
}

function describeLink(pattern: KautzPattern, link: KautzPattern['links'][number]): string {
  const from = pattern.nodes.find((node) => node.id === link.from);
  const to = pattern.nodes.find((node) => node.id === link.to);
  return `${from ? describeNodeRule(from) : link.from} → ${to ? describeNodeRule(to) : link.to}`;
}

// Explains *why* a rule found zero candidates, so the alert can point at the actual
// problem (missing component vs. wrong type vs. wrong cluster) instead of a generic
// "not found".
function describeRuleMismatch(scopedNodes: go.Node[], rule: KautzPatternNode): string {
  const sameName = scopedNodes.filter((node) => node.data?.name === rule.name);

  if (sameName.length === 0) {
    return `missing component: ${describeNodeRule(rule)}`;
  }

  const typeCompatible = sameName.filter((node) => typeSatisfiesRule(node.data?.type, rule.type));
  if (rule.type && typeCompatible.length === 0) {
    const actualTypes = Array.from(
      new Set(sameName.map((node) => String(node.data?.type ?? '').trim()).filter(Boolean))
    );
    return (
      `type mismatch for ${describeNodeRule(rule)}: you have ${rule.name} component(s) typed ` +
      `${actualTypes.length > 0 ? actualTypes.map((t) => `"${t}"`).join(', ') : 'with no specific type set'}, ` +
      `which ${actualTypes.length > 1 ? 'are' : 'is'} not compatible with the required "${rule.type}"`
    );
  }

  return `cluster requirement not met for ${describeNodeRule(rule)}`;
}

function nodeMatchesRule(
  diagram: go.Diagram,
  node: go.Node,
  rule: KautzPatternNode,
  clusterLabels: Map<string, string>
): boolean {
  const data = node.data ?? {};

  // Match on the stable semantic identity (same as GoJSBoxologyValidation's getNodeName):
  // a node's `name` never changes, but its `label`/`shape` can be edited freely by the
  // user, so those must not affect whether a pattern matches. `type` is also checked when
  // the rule specifies one, since several Kautz categories share the same root `name`
  // (e.g. Model/Deduce) and are only distinguished by whether the model is neural or
  // symbolic — ignoring `type` let unrelated components satisfy the wrong pattern slot.
  if (data.name !== rule.name) {
    return false;
  }
  if (!typeSatisfiesRule(data.type, rule.type)) {
    return false;
  }

  const actualGroupLabels = groupLabelsForNode(diagram, node);
  const requiredGroupIds = [rule.group, ...(rule.sharedGroups ?? [])].filter(
    (groupId): groupId is string => Boolean(groupId)
  );

  return requiredGroupIds.every((groupId) => {
    const clusterLabel = clusterLabels.get(groupId);
    return clusterLabel !== undefined && actualGroupLabels.has(clusterLabel);
  });
}

function comparePatternToDiagram(
  diagram: go.Diagram,
  pattern: KautzPattern,
  scopedNodes: go.Node[]
): PatternComparison {
  const clusterLabels = new Map((pattern.clusters ?? []).map((cluster) => [cluster.id, cluster.label]));
  const availableGroupLabels = new Set<string>();
  scopedNodes.forEach((node) => groupLabelsForNode(diagram, node).forEach((label) => availableGroupLabels.add(label)));

  const missingClusterRules = Array.from(clusterLabels.values()).filter((label) => !availableGroupLabels.has(label));
  const candidates = new Map<string, go.Node[]>();

  pattern.nodes.forEach((rule) => {
    candidates.set(
      rule.id,
      scopedNodes.filter((node) => nodeMatchesRule(diagram, node, rule, clusterLabels))
    );
  });

  const missingNodeRules = pattern.nodes
    .filter((rule) => candidates.get(rule.id)?.length === 0)
    .map((rule) => describeRuleMismatch(scopedNodes, rule));

  if (missingClusterRules.length > 0 || missingNodeRules.length > 0) {
    return {
      matches: false,
      matchedNodeRules: pattern.nodes
        .filter((rule) => (candidates.get(rule.id)?.length ?? 0) > 0)
        .map(describeNodeRule),
      missingNodeRules,
      missingClusterRules,
      missingLinks: [],
    };
  }

  const scopedKeys = new Set(scopedNodes.map((node) => String(node.key)));
  const links = new Set<string>();
  diagram.links.each((link) => {
    const from = String(link.data?.from ?? link.fromNode?.key ?? '');
    const to = String(link.data?.to ?? link.toNode?.key ?? '');
    if (scopedKeys.has(from) && scopedKeys.has(to)) {
      links.add(`${from}\u0000${to}`);
    }
  });

  // The candidate order minimizes backtracking for repeated labels such as "Symbol".
  const orderedRules = [...pattern.nodes].sort(
    (left, right) => (candidates.get(left.id)?.length ?? 0) - (candidates.get(right.id)?.length ?? 0)
  );
  const assignments = new Map<string, go.Node>();
  const usedNodeKeys = new Set<string>();
  let attempts = 0;
  const maxAttempts = 50_000;

  const hasRequiredLinksForAssignment = (ruleId: string): boolean => {
    for (const link of pattern.links) {
      if (link.from !== ruleId && link.to !== ruleId) continue;

      const from = assignments.get(link.from);
      const to = assignments.get(link.to);
      if (from && to && !links.has(`${from.key}\u0000${to.key}`)) {
        return false;
      }
    }
    return true;
  };

  // Tracks the deepest partial assignment seen across the whole search, so a failed
  // match can explain specifically what's wrong instead of dumping every pattern link.
  let bestAssignment = new Map<string, go.Node>();
  const trackBest = () => {
    if (assignments.size > bestAssignment.size) {
      bestAssignment = new Map(assignments);
    }
  };

  const findMatch = (index: number): boolean => {
    if (index === orderedRules.length) return true;
    if (attempts++ >= maxAttempts) return false;
    trackBest();

    const rule = orderedRules[index];
    for (const candidate of candidates.get(rule.id) ?? []) {
      const key = String(candidate.key);
      if (usedNodeKeys.has(key)) continue;

      assignments.set(rule.id, candidate);
      usedNodeKeys.add(key);
      if (hasRequiredLinksForAssignment(rule.id) && findMatch(index + 1)) return true;
      assignments.delete(rule.id);
      usedNodeKeys.delete(key);
    }

    trackBest();
    return false;
  };

  const matches = findMatch(0);
  if (matches) {
    return {
      matches: true,
      matchedNodeRules: pattern.nodes.map(describeNodeRule),
      missingNodeRules: [],
      missingClusterRules: [],
      missingLinks: [],
    };
  }

  // Best-effort diagnosis: report which pattern roles couldn't get a component of their
  // own (because every matching component was already claimed by another role), and
  // which required connections are missing between the components that WERE assigned —
  // rather than claiming every single pattern link is "not found".
  const missingLinks: string[] = [];
  pattern.nodes
    .filter((rule) => !bestAssignment.has(rule.id))
    .forEach((rule) => {
      missingLinks.push(
        `needs its own ${describeNodeRule(rule)} — the matching component(s) in your diagram are ` +
        `already used to satisfy another part of this pattern`
      );
    });
  pattern.links.forEach((link) => {
    const from = bestAssignment.get(link.from);
    const to = bestAssignment.get(link.to);
    if (!from || !to) return; // already reported above as an unassigned role
    if (!links.has(`${from.key} ${to.key}`)) {
      missingLinks.push(
        `"${String(from.data?.label ?? from.key)}" is not connected to "${String(to.data?.label ?? to.key)}" ` +
        `as required by this pattern (${describeLink(pattern, link)})`
      );
    }
  });

  return {
    matches: false,
    matchedNodeRules: pattern.nodes.map(describeNodeRule),
    missingNodeRules: [],
    missingClusterRules: [],
    missingLinks,
  };
}

export function validateKautzDiagram(diagram: go.Diagram, selectionOnly: boolean): string {
  const scopedNodes = collectScopedNodes(diagram, selectionOnly);
  const comparisons = kautzPatterns.map((pattern) => ({
    pattern,
    result: comparePatternToDiagram(diagram, pattern, scopedNodes),
  }));
  const matches = comparisons.filter(({ result }) => result.matches);

  if (matches.length === 0) {
    const closest = [...comparisons].sort((left, right) => {
      const leftMisses = left.result.missingNodeRules.length + left.result.missingClusterRules.length + left.result.missingLinks.length;
      const rightMisses = right.result.missingNodeRules.length + right.result.missingClusterRules.length + right.result.missingLinks.length;
      return leftMisses - rightMisses;
    })[0];

    let message = '❌ No Kautz pattern detected.';
    if (closest) {
      const sections: string[] = [];
      if (closest.result.missingNodeRules.length > 0) {
        sections.push(
          `Component/type issues:\n${closest.result.missingNodeRules.map((s) => `• ${s}`).join('\n')}`
        );
      }
      if (closest.result.missingClusterRules.length > 0) {
        sections.push(`Missing clusters: ${closest.result.missingClusterRules.join(', ')}`);
      }
      if (closest.result.missingLinks.length > 0) {
        sections.push(
          `Connection issues:\n${closest.result.missingLinks.map((s) => `• ${s}`).join('\n')}`
        );
      }
      if (sections.length > 0) {
        message += `\n\nClosest match: ${closest.pattern.name} (${closest.pattern.description.trim()})\n\n${sections.join('\n\n')}`;
      }
    }
    return message;
  }

  return `🧠 Kautz pattern(s) detected:\n\n${matches
    .map(({ pattern, result }) => `• ${pattern.name} — matched ${result.matchedNodeRules.length} node rule(s) and ${pattern.links.length} link rule(s)`)
    .join('\n')}`;
}
