import { generateMultiPageRMLExport } from './exportHelpers';

type Component = {
  id: string;
  name?: string;
  label?: string;
};

type DesignPattern = {
  id: string;
  label: string;
  input?: Component[];
  output?: Component[];
  process?: Component;
};

type Boxology = {
  id: string;
  label: string;
  DesignPattern?: DesignPattern[];
};

type KgExport = {
  metadata?: {
    exportId?: string;
    userId?: string;
    exportDate?: string;
  };
  boxologies: Boxology[];
};

type DocOptions = {
  includePatternDetails?: boolean;
  includeComponentGlossary?: boolean;
  titlePrefix?: string;
};

const PROCESS_RULES: Record<string, { phrase: string; purpose: string }> = {
  train: {
    phrase: 'trains a model',
    purpose: 'model learning from available artifacts'
  },
  training: {
    phrase: 'trains a model',
    purpose: 'model learning from available artifacts'
  },
  transform: {
    phrase: 'transforms data artifacts',
    purpose: 'data adaptation and preparation for downstream tasks'
  },
  embed: {
    phrase: 'embeds data into a transformed representation',
    purpose: 'representation learning'
  },
  deduce: {
    phrase: 'deduces symbolic outputs',
    purpose: 'reasoning and symbolic inference'
  },
  infer: {
    phrase: 'infers outputs',
    purpose: 'inference over learned or symbolic knowledge'
  },
  engineer: {
    phrase: 'engineers artifacts with actor input',
    purpose: 'human-in-the-loop system engineering'
  },
  generate: {
    phrase: 'generates system outputs',
    purpose: 'artifact generation'
  }
};

const TYPE_RULES: Record<string, string> = {
  data: 'data artifact',
  dataset: 'dataset',
  image: 'image data',
  text: 'text data',
  audio: 'audio data',
  video: 'video data',
  timeseries: 'time-series data',
  number: 'numeric data',
  tensor: 'tensor data',
  symbol: 'symbolic artifact',
  label: 'label artifact',
  trace: 'trace artifact',
  rules: 'rule artifact',
  kg: 'knowledge graph artifact',
  db: 'database artifact',
  model: 'model artifact',
  neuralmodel: 'neural model',
  semanticmodel: 'semantic model',
  statisticalmodel: 'statistical model',
  process: 'process component',
  actor: 'actor component',
  human: 'human actor',
  robot: 'robot actor'
};

function norm(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function dedupeById(items: Component[]): Component[] {
  const seen = new Set<string>();
  const out: Component[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function describeComponent(component: Component): string {
  const name = component.name || 'Artifact';
  const label = component.label || name;
  const kind = TYPE_RULES[norm(name)] || `${name} artifact`;
  return `${label} (${kind})`;
}

function processRule(processName?: string): { phrase: string; purpose: string } {
  const key = norm(processName);
  if (PROCESS_RULES[key]) return PROCESS_RULES[key];
  return {
    phrase: `${processName || 'processes artifacts'}`,
    purpose: 'system transformation step'
  };
}

function buildPatternGraph(patterns: DesignPattern[]) {
  const producedBy = new Map<string, string>();
  for (const pattern of patterns) {
    for (const out of pattern.output || []) {
      if (out?.id) producedBy.set(out.id, pattern.id);
    }
  }

  const edges = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  for (const p of patterns) {
    edges.set(p.id, new Set<string>());
    indegree.set(p.id, 0);
  }

  for (const target of patterns) {
    for (const input of target.input || []) {
      const sourceId = input?.id ? producedBy.get(input.id) : undefined;
      if (!sourceId || sourceId === target.id) continue;
      if (!edges.get(sourceId)?.has(target.id)) {
        edges.get(sourceId)?.add(target.id);
        indegree.set(target.id, (indegree.get(target.id) || 0) + 1);
      }
    }
  }

  return { edges, indegree };
}

function orderPatterns(patterns: DesignPattern[]): DesignPattern[] {
  const { edges, indegree } = buildPatternGraph(patterns);
  const queue: string[] = [];

  for (const p of patterns) {
    if ((indegree.get(p.id) || 0) === 0) queue.push(p.id);
  }

  const byId = new Map<string, DesignPattern>(patterns.map(p => [p.id, p]));
  const ordered: DesignPattern[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const pattern = byId.get(id);
    if (!pattern) continue;
    ordered.push(pattern);

    for (const next of edges.get(id) || []) {
      const d = (indegree.get(next) || 0) - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  // Keep deterministic fallback for cycles or disconnected subgraphs.
  if (ordered.length < patterns.length) {
    const orderedIds = new Set(ordered.map(p => p.id));
    for (const p of patterns) {
      if (!orderedIds.has(p.id)) ordered.push(p);
    }
  }

  return ordered;
}

function buildSystemSummary(boxology: Boxology, orderedPatterns: DesignPattern[]): string {
  const steps = orderedPatterns.map(p => {
    const proc = p.process;
    const rule = processRule(proc?.name || proc?.label);
    return `${p.label}: ${rule.phrase}`;
  });

  const allInputs = dedupeById(orderedPatterns.flatMap(p => p.input || []));
  const allOutputs = dedupeById(orderedPatterns.flatMap(p => p.output || []));

  const inputText = allInputs.length
    ? allInputs.slice(0, 4).map(i => i.label || i.name || i.id).join(', ')
    : 'input artifacts';

  const outputText = allOutputs.length
    ? allOutputs.slice(0, 4).map(o => o.label || o.name || o.id).join(', ')
    : 'output artifacts';

  const flowText = steps.length > 0
    ? steps.join(' -> ')
    : 'No process flow detected';

  return `The system ${boxology.label} starts from ${inputText}, executes the following pipeline: ${flowText}, and produces ${outputText}.`;
}

function buildPipelineMarkdown(patterns: DesignPattern[]): string {
  if (patterns.length === 0) return '- No design patterns available.';

  return patterns
    .map((pattern, index) => {
      const proc = pattern.process;
      const procLabel = proc?.label || proc?.name || 'Unknown process';
      const rule = processRule(proc?.name || proc?.label);
      const inputs = (pattern.input || []).map(describeComponent).join(', ') || 'none';
      const outputs = (pattern.output || []).map(describeComponent).join(', ') || 'none';

      return `${index + 1}. ${pattern.label}\n   Process: ${procLabel}\n   Purpose: ${rule.purpose}\n   Inputs: ${inputs}\n   Outputs: ${outputs}`;
    })
    .join('\n');
}

function buildGlossaryMarkdown(patterns: DesignPattern[]): string {
  const allComponents = dedupeById(
    patterns.flatMap(p => [
      ...(p.input || []),
      ...(p.output || []),
      ...(p.process ? [p.process] : [])
    ])
  );

  if (allComponents.length === 0) return '- No components found.';

  return allComponents
    .map(c => {
      const name = c.name || 'Artifact';
      const typeDescription = TYPE_RULES[norm(name)] || `${name} artifact`;
      const label = c.label || c.id;
      return `- ${label}: ${typeDescription}`;
    })
    .join('\n');
}

export function generateSystemDocumentationFromKg(
  kg: KgExport,
  options: DocOptions = {}
): string {
  const includePatternDetails = options.includePatternDetails ?? true;
  const includeComponentGlossary = options.includeComponentGlossary ?? true;
  const titlePrefix = options.titlePrefix || 'Automatic System Documentation';

  const parts: string[] = [];

  parts.push(`# ${titlePrefix}`);

  if (kg.metadata) {
    parts.push(`Generated from export ${kg.metadata.exportId || 'unknown'} on ${kg.metadata.exportDate || 'unknown date'}.`);
  }

  for (const boxology of kg.boxologies || []) {
    const patterns = orderPatterns(boxology.DesignPattern || []);

    parts.push(`\n## ${boxology.label}`);
    parts.push('\n### System Description');
    parts.push(buildSystemSummary(boxology, patterns));

    if (includePatternDetails) {
      parts.push('\n### Pipeline');
      parts.push(buildPipelineMarkdown(patterns));
    }

    if (includeComponentGlossary) {
      parts.push('\n### Component Definitions');
      parts.push(buildGlossaryMarkdown(patterns));
    }
  }

  return parts.join('\n\n');
}

export function generateSystemDocumentationFromPages(
  pages: any[],
  metadata?: KgExport['metadata'],
  options: DocOptions = {}
): string {
  const exported = generateMultiPageRMLExport(pages);
  const kg: KgExport = {
    metadata,
    boxologies: exported.boxologies || []
  };
  return generateSystemDocumentationFromKg(kg, options);
}
