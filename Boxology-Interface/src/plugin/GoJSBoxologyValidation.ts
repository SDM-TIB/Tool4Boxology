import * as go from "gojs";
import { validateKautzDiagram } from './KautzBoxologyValidation.ts';

// --- Pattern and connection rules ---

const validNext: Record<string, string[]> = {
	"Actor": ["Engineer", "Actor", "Transform","Deduce"],
	//"artifacts": ["artifacts","symbol", "data","Deduce","Engineer", "Transform:embed", "generate", "Transform", "generate", "Train"],
  "Symbol": ["Deduce", "Train", "Generate","Engineer", "Transform", "Symbol", "artifacts"],
  "Data": ["Deduce", "Train", "Generate","Engineer", "Transform", "Data", "embed", "artifacts"],
  "Deduce": ["Symbol", "Model", "Deduce", "Data", "artifacts", "SemanticModel", "StatisticalModel"],
  "Model": ["Deduce", "Model", "Generate", "Train","Engineer", "StatisticalModel", "SemanticModel", "embed", "Transform"],
  "Train": ["Model", "Train", "SemanticModel", "StatisticalModel", "Train", "Generate"],
  "Generate": ["Model", "Generate", "SemanticModel", "StatisticalModel", "Data", "Symbol", "artifacts","Train","Engineer"],
  "Engineer": ["Model","StatisticalModel","SemanticModel", "Engineer", "Generate", "Data", "Symbol", "artifacts"],
  "SemanticModel": ["Deduce", "Model", "Generate", "Train", "StatisticalModel", "SemanticModel", "embed", "Transform"],
  "StatisticalModel": ["Deduce", "Model", "Generate", "Train", "StatisticalModel", "SemanticModel", "embed", "Transform"],
  //"embed": ["Data", "embed", "Symbol", "Transform", "SemanticModel", "StatisticalModel", "artifacts", "Model"],
  "Transform": ["Data", "Symbol", "artifacts", "Transform", "embed", "Model", "SemanticModel", "StatisticalModel"],
  "Infer": ["Symbol", "Model", "Data", "artifacts"],
  "Induce": ["Symbol", "Model", "Data", "artifacts"],
};

const allPatterns: { name: string; edges: [string, string][] }[] = [
  // Train model with artifacts
  { name: "train_model (symbol)", edges: [["Symbol", "Train"], ["Train", "Model"]] },
  { name: "train_model (data)", edges: [["Data", "Train"], ["Train", "Model"]] },
  { name: "generate_model from model and data ", edges: [["Model", "Train"], ["Data", "Train"], ["Train", "Model"]] },
  { name: "generate_model from model and symbol ", edges: [["Model", "Train"], ["Symbol", "Train"], ["Train", "Model"]] },
  { name: "generate_model from model and artifacts ", edges: [["Model", "Train"], ["artifacts", "Train"], ["Train", "Model"]] },
  
  // Transform data with symbol/artifacts/data
  { name: "Transform to data (symbol)", edges: [["Symbol", "Transform"], ["Transform", "Data"]] },
  { name: "Transform to data (data)", edges: [["Data", "Transform"], ["Transform", "Data"]] },
  { name: "Transform to symbol (data)", edges: [["Data", "Transform"], ["Transform", "Symbol"]] },
  { name: "Transform to symbol (symbol)", edges: [["Symbol", "Transform"], ["Transform", "Symbol"]] },
  { name: "Transform_model (model)", edges: [["Model", "Transform"], ["Transform", "Model"]] },
  
  //Engineer model from actor and artifacts
  { name: "actor Engineer model", edges: [["Actor", "Engineer"], ["Engineer", "Model"]] },
  { name: "actor Engineer data from data", edges: [["Actor", "Engineer"], ["Data", "Engineer"], ["Engineer", "Data"]] },
  { name: "actor Engineer symbol", edges: [["Actor", "Engineer"], ["Engineer", "Symbol"]] },
  { name: "actor Engineer data", edges: [["Actor", "Engineer"], ["Engineer", "Data"]] },
  { name: "actor Engineer symbol from symbol", edges: [["Actor", "Engineer"], ["Symbol", "Engineer"], ["Engineer", "Symbol"]] },
  { name: "actor Engineer model from model", edges: [["Actor", "Engineer"], ["Model", "Engineer"], ["Engineer", "Model"]] },
  { name: "actor Engineer data from model", edges: [["Actor", "Engineer"], ["Model", "Engineer"], ["Engineer", "Data"]] },
  { name: "actor Engineer symbol from model", edges: [["Actor", "Engineer"], ["Model", "Engineer"], ["Engineer", "Symbol"]] },
  { name: "actor Engineer model from symbol", edges: [["Actor", "Engineer"], ["Symbol", "Engineer"], ["Engineer", "Model"]] },
  { name: "actor Engineer model from data", edges: [["Actor", "Engineer"], ["Data", "Engineer"], ["Engineer", "Model"]] },
  { name: "actor Engineer data from symbol", edges: [["Actor", "Engineer"], ["Symbol", "Engineer"], ["Engineer", "Data"]] },
  { name: "actor Engineer symbol from data", edges: [["Actor", "Engineer"], ["Data", "Engineer"], ["Engineer", "Symbol"]] },

  { name: "infer_symbol (symbol → model → symbol)", edges: [["Model", "Deduce"], ["Symbol", "Deduce"], ["Deduce", "Symbol"]] },
  { name: "infer_symbol (data → model → symbol)", edges: [["Model", "Deduce"], ["Data", "Deduce"], ["Deduce", "Symbol"]] },
  { name: "infer_model (symbol → model → model)", edges: [["Model", "Deduce"], ["Symbol", "Deduce"], ["Deduce", "Model"]] },
  { name: "infer_model (data → model → model)", edges: [["Model", "Deduce"], ["Data", "Deduce"], ["Deduce", "Model"]] },
  { name: "infer_data (data → model → data)", edges: [["Model", "Deduce"], ["Data", "Deduce"], ["Deduce", "Data"]] },
  { name: "infer_data (symbol → model → data)", edges: [["Model", "Deduce"], ["Symbol", "Deduce"], ["Deduce", "Data"]] },
  { name: "embed Transform", edges: [["Symbol", "Embed"], ["Data", "Embed"], ["Embed", "Model"]] },

  { name: "data-symbol Transform", edges: [["Symbol", "Transform"], ["Data", "Transform"], ["Transform", "Data"]] },

  { name: "infer symbol from more model", edges: [["Model", "Deduce"], ["Data", "Deduce"], ["Deduce", "Symbol"]] }
];

// --- Utility functions ---
function getNodeName(node: go.Node): string {
  // Use only the stable semantic identity
  const nm = (node.data?.name ?? '').toString().trim();
  return nm || (node.data?.key?.toString() ?? 'Unnamed');
}

function isIgnorable(node: go.Node): boolean {
  // Ignore by stable name (not label). Also ignore groups.
  const ignored = new Set([
    'comment', 'cluster', 'text', 'note', 'conditions', 'description',
    'pre-conditions', 'post-condition'
  ]);

  // Ignore GoJS Group nodes (clusters)
  if (node instanceof go.Group) return true;
  if (node.category === 'ClusterGroup') return true;

  const nm = (node.data?.name ?? '').toString().toLowerCase().trim();
  return nm.length > 0 && ignored.has(nm);
}

// --- Merge duplicate nodes (by name) if connected ---
function mergeIdenticalNodes(diagram: go.Diagram, fromNode: go.Node, toNode: go.Node) {
  if (!fromNode || !toNode) return;
  if (getNodeName(fromNode) !== getNodeName(toNode)) return;
  if (fromNode.key === toNode.key) return;

  const model = diagram.model as go.GraphLinksModel;
  model.startTransaction("merge nodes");

  // 🎯 FIRST: Remove the connecting link between the two identical nodes
  const connectingLinks = [...diagram.links].filter(link => 
    (link.fromNode === fromNode && link.toNode === toNode) ||
    (link.fromNode === toNode && link.toNode === fromNode)
  );
  
  connectingLinks.forEach(link => {
    model.removeLinkData(link.data);
  });

  // THEN: Rewire all OTHER links of toNode to fromNode
  diagram.links.each(link => {
    // Skip the links we just removed
    if (connectingLinks.includes(link)) return;
    
    if (link.fromNode === toNode) {
      model.set(link.data, "from", fromNode.key);
    }
    if (link.toNode === toNode) {
      model.set(link.data, "to", fromNode.key);
    }
  });

  // Finally: Remove the duplicate node
  model.removeNodeData(toNode.data);

  model.commitTransaction("merge nodes");
}

// --- Prevent invalid edges and merge on link creation ---
export function setupDiagramValidation(diagram: go.Diagram) {
  // Prevent invalid connections and merge duplicate nodes
  diagram.addDiagramListener("LinkDrawn", e => {
    const link = e.subject as go.Link;
    if (!link.fromNode || !link.toNode) return;

    const fromName = getNodeName(link.fromNode);
    const toName = getNodeName(link.toNode);

    // Prevent invalid connection by rule table
    if (!validNext[fromName] || !validNext[fromName].includes(toName)) {
      diagram.model.startTransaction("remove invalid link");
      (diagram.model as go.GraphLinksModel).removeLinkData(link.data);
      diagram.model.commitTransaction("remove invalid link");
      alert("Invalid connection. Edge removed.");
      return;
    }

    // Enforce process output cardinality: exactly one of symbol/model/data
    if (PROCESS_NODES.has(fromName) && OUTPUT_TARGETS.has(toName)) {
      const outCount = countProcessOutputs(link.fromNode);
      if (outCount > 1) {
        diagram.model.startTransaction("enforce process output cardinality");
        (diagram.model as go.GraphLinksModel).removeLinkData(link.data);
        diagram.model.commitTransaction("enforce process output cardinality");
        alert("A process can have exactly one output (symbol, model, or data).");
        return;
      }
    }

    // 🎯 FIXED: Only merge nodes if they have SAME NAME AND SAME LABEL
    const fromLabel = link.fromNode.data.label || "";
    const toLabel = link.toNode.data.label || "";
    
    if (fromName === toName && fromLabel === toLabel) {
      // Same name AND same label = merge required
      mergeIdenticalNodes(diagram, link.fromNode, link.toNode);
    }
    // If same name but different labels = allow connection (no merge)
  });
}

interface SemanticNodeRef {
  key: string;
  semanticName: string;
  label: string;
}

interface SemanticDesignPattern {
  process: SemanticNodeRef;
  input: SemanticNodeRef[];
  output: SemanticNodeRef[];
}

function buildNodeRef(node: go.Node): SemanticNodeRef {
  return {
    key: String(node.data?.key ?? ""),
    semanticName: getNodeName(node),
    label: String(node.data?.label ?? getNodeName(node))
  };
}

function combineValidationSummaries(elementarySummary: string, kautzSummary: string): string {
  const sections = [elementarySummary, kautzSummary].filter(section => section.trim().length > 0);
  return sections.join("\n\n") || "❌ INVALID: No process pattern detected.";
}

function extractDesignPatterns(diagram: go.Diagram, selectionOnly: boolean): SemanticDesignPattern[] {
  const nodesToCheck: go.Node[] = [];
  const selectedNodeKeys = new Set<string>();

  if (selectionOnly) {
    diagram.selection.each(part => {
      if (part instanceof go.Node && !isIgnorable(part)) {
        nodesToCheck.push(part);
        selectedNodeKeys.add(String(part.data?.key ?? ""));
      }
    });
  } else {
    diagram.nodes.each(node => {
      if (!isIgnorable(node)) nodesToCheck.push(node);
    });
  }

  const patterns: SemanticDesignPattern[] = [];

  nodesToCheck.forEach(processNode => {
    const processName = getNodeName(processNode);
    if (!PROCESS_NODES.has(processName)) return;

    const input: SemanticNodeRef[] = [];
    const output: SemanticNodeRef[] = [];

    processNode.findLinksInto().each(link => {
      const src = link.fromNode;
      if (!src || isIgnorable(src)) return;
      if (selectionOnly && !selectedNodeKeys.has(String(src.data?.key ?? ""))) return;
      input.push(buildNodeRef(src));
    });

    processNode.findLinksOutOf().each(link => {
      const dst = link.toNode;
      if (!dst || isIgnorable(dst)) return;
      if (selectionOnly && !selectedNodeKeys.has(String(dst.data?.key ?? ""))) return;
      output.push(buildNodeRef(dst));
    });

    if (input.length > 0 || output.length > 0) {
      patterns.push({
        process: buildNodeRef(processNode),
        input,
        output
      });
    }
  });

  return patterns;
}

function validateSemanticPattern(pattern: SemanticDesignPattern): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const proc = pattern.process.semanticName;

  if (!PROCESS_NODES.has(proc)) {
    issues.push(`invalid process type: ${proc}`);
    return { valid: false, issues };
  }

  if (pattern.input.length === 0) {
    issues.push("missing input");
  }
  if (pattern.output.length === 0) {
    issues.push("missing output");
  }

  const outputTargets = pattern.output.filter(o => OUTPUT_TARGETS.has(o.semanticName));
  if (outputTargets.length !== 1) {
    issues.push("must have exactly one output target (Symbol, Model, or Data)");
  }

  pattern.input.forEach(input => {
    const allowed = validNext[input.semanticName] ?? [];
    if (!allowed.includes(proc)) {
      issues.push(`invalid input edge: ${input.semanticName} -> ${proc}`);
    }
  });

  pattern.output.forEach(output => {
    const allowed = validNext[proc] ?? [];
    if (!allowed.includes(output.semanticName)) {
      issues.push(`invalid output edge: ${proc} -> ${output.semanticName}`);
    }
  });

  // Deduce requires model + one evidence input (symbol or data).
  if (proc === "Deduce") {
    const inputTypes = new Set(pattern.input.map(i => i.semanticName));
    if (!inputTypes.has("Model")) {
      issues.push("Deduce requires Model as an input");
    }
    if (!inputTypes.has("Symbol") && !inputTypes.has("Data")) {
      issues.push("Deduce requires Symbol or Data as evidence input");
    }
  }

  return { valid: issues.length === 0, issues };
}

function summarizePatterns(patterns: SemanticDesignPattern[]): string {
  const valid: SemanticDesignPattern[] = [];
  const invalid: { pattern: SemanticDesignPattern; issues: string[] }[] = [];

  patterns.forEach(p => {
    const result = validateSemanticPattern(p);
    if (result.valid) valid.push(p);
    else invalid.push({ pattern: p, issues: result.issues });
  });

  let summary = "";
  if (valid.length > 0) {
    summary += "✅ Valid pattern(s) detected:\n\n";
    valid.forEach(p => {
      const inNames = p.input.map(i => i.semanticName).join(", ");
      const outNames = p.output.map(o => o.semanticName).join(", ");
      summary += `• ${p.process.semanticName}: [${inNames}] -> [${outNames}]\n`;
    });
  }

  if (invalid.length > 0) {
    if (summary.length > 0) summary += "\n";
    summary += "❌ Invalid process pattern(s):\n\n";
    invalid.forEach(item => {
      summary += `• ${item.pattern.process.semanticName} (${item.pattern.process.label}): ${item.issues.join("; ")}\n`;
    });
  }

  return summary || "❌ INVALID: No process pattern detected.";
}

// --- Pattern validation for selection ---
export function validateGoJSDiagram(diagram: go.Diagram): string {
  if (diagram.selection.count === 0) {
    return "⚠️ No selection made! Please select a pattern before validation.";
  }

  const patterns = extractDesignPatterns(diagram, true);
  const elementarySummary = patterns.length === 0
    ? "❌ INVALID: No process node found in selection."
    : summarizePatterns(patterns);
  const kautzSummary = validateKautzDiagram(diagram, true);

  return combineValidationSummaries(elementarySummary, kautzSummary);
}

// --- Pattern validation for entire diagram ---
export function validateEntireDiagram(diagram: go.Diagram): string {
  const patterns = extractDesignPatterns(diagram, false);
  const elementarySummary = patterns.length === 0
    ? "❌ INVALID: No process node found in diagram."
    : summarizePatterns(patterns);
  const kautzSummary = validateKautzDiagram(diagram, false);

  return combineValidationSummaries(elementarySummary, kautzSummary);
}

// --- Elementary-only validation helper (exported for programmatic checks) ---
export function validateElementaryOnlyDiagram(diagram: go.Diagram): { valid: boolean; summary: string } {
  const patterns = extractDesignPatterns(diagram, false);
  if (patterns.length === 0) {
    return { valid: false, summary: "❌ INVALID: No process node found in diagram." };
  }

  const invalid = patterns.some(p => {
    const res = validateSemanticPattern(p);
    return !res.valid;
  });

  const summary = summarizePatterns(patterns);
  return { valid: !invalid, summary };
}

const PROCESS_NODES = new Set(['Train', 'Engineer', 'Transform', 'Deduce']);
const OUTPUT_TARGETS = new Set(['Symbol', 'Model', 'Data']);

function countProcessOutputs(node: go.Node): number {
  if (!node) return 0;
  let n = 0;
  node.findLinksOutOf().each(l => {
    const tgt = l.toNode ? getNodeName(l.toNode) : '';
    if (OUTPUT_TARGETS.has(tgt)) n++;
  });
  return n;
}