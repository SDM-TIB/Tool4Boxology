import * as go from 'gojs';
import { kautzPatterns } from '../data/kautzPatterns';

type KautzPattern = (typeof kautzPatterns)[number];
type KautzPatternNode = KautzPattern['nodes'][number];

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

function nodeMatchesRule(
  diagram: go.Diagram,
  node: go.Node,
  rule: KautzPatternNode,
  clusterLabels: Map<string, string>
): boolean {
  const data = node.data ?? {};

  // Match on the stable semantic identity only (same as GoJSBoxologyValidation's
  // getNodeName): a node's `name` never changes, but its `label`/`shape` can be
  // edited freely by the user, so those must not affect whether a pattern matches.
  if (data.name !== rule.name) {
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
    .map(describeNodeRule);

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

  const findMatch = (index: number): boolean => {
    if (index === orderedRules.length) return true;
    if (attempts++ >= maxAttempts) return false;

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

    return false;
  };

  const matches = findMatch(0);
  return {
    matches,
    matchedNodeRules: matches ? pattern.nodes.map(describeNodeRule) : [],
    missingNodeRules: [],
    missingClusterRules: [],
    missingLinks: matches ? [] : pattern.links.map((link) => describeLink(pattern, link)),
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
      const details: string[] = [];
      if (closest.result.missingNodeRules.length > 0) {
        details.push(`missing node rules: ${closest.result.missingNodeRules.join(', ')}`);
      }
      if (closest.result.missingClusterRules.length > 0) {
        details.push(`missing clusters: ${closest.result.missingClusterRules.join(', ')}`);
      }
      if (closest.result.missingLinks.length > 0) {
        details.push(`required links not found: ${closest.result.missingLinks.join(', ')}`);
      }
      if (details.length > 0) {
        message += `\n\nClosest match: ${closest.pattern.name} — ${details.join('; ')}.`;
      }
    }
    return message;
  }

  return `🧠 Kautz pattern(s) detected:\n\n${matches
    .map(({ pattern, result }) => `• ${pattern.name} — matched ${result.matchedNodeRules.length} node rule(s) and ${pattern.links.length} link rule(s)`)
    .join('\n')}`;
}
