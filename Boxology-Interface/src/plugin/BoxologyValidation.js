Draw.loadPlugin(function(ui) {
    console.log("✅ Boxology Plugin Loaded");

    var graph = ui.editor.graph;
    graph.setDisconnectOnMove(false);
    graph.setCellsDisconnectable(false);
    graph.setCellsDeletable(true);
    graph.setAllowDanglingEdges(false);
    graph.setTooltips(true);

    graph.getTooltipForCell = function(cell) {
        return cell.tooltip || null;
    };
// --- UPDATED: canonical shapes based on src/data/shape.ts ---
    const shapes = [
        "symbol",
        "data",
        "actor",
        "model",
        "transform",
        "deduce",
        "training",
        "engineering",
        "comment",
    ];

// --- UPDATED: patterns aligned to GoJS Boxology and shape.ts ---
const allPatterns = [
    // Train model with artifacts
  { name: "train_model (symbol)", edges: [["symbol", "training"], ["training", "model"]] },
  { name: "train_model (data)", edges: [["data", "training"], ["training", "model"]] },
  { name: "generate_model from model and data ", edges: [["model", "training"], ["data", "training"], ["training", "model"]] },
  { name: "generate_model from model and symbol ", edges: [["model", "training"], ["symbol", "training"], ["training", "model"]] },
  { name: "generate_model from model and artifacts ", edges: [["model", "training"], ["artifacts", "training"], ["training", "model"]] },
  
  // Transform data with symbol/artifacts/data
  { name: "transform to data (symbol)", edges: [["symbol", "transform"], ["transform", "data"]] },
  { name: "transform to data (data)", edges: [["data", "transform"], ["transform", "data"]] },
  { name: "transform to data (data + model)", edges: [["data", "transform"], ["model", "transform"], ["transform", "data"]] },
  { name: "transform to symbol (data)", edges: [["data", "transform"], ["transform", "symbol"]] },
  { name: "transform to symbol (symbol)", edges: [["symbol", "transform"], ["transform", "symbol"]] },
  { name: "transform_model (model)", edges: [["model", "transform"], ["transform", "model"]] },
  
  //engineer model from actor and artifacts
  { name: "actor engineer model", edges: [["actor", "engineering"], ["engineering", "model"]] },
  { name: "actor engineer data from data", edges: [["actor", "engineering"], ["data", "engineering"], ["engineering", "data"]] },
  { name: "actor engineer symbol", edges: [["actor", "engineering"], ["engineering", "symbol"]] },
  { name: "actor engineer data", edges: [["actor", "engineering"], ["engineering", "data"]] },
  { name: "actor engineer symbol from symbol", edges: [["actor", "engineering"], ["symbol", "engineering"], ["engineering", "symbol"]] },
  { name: "actor engineer model from model", edges: [["actor", "engineering"], ["model", "engineering"], ["engineering", "model"]] },
  { name: "actor engineer data from model", edges: [["actor", "engineering"], ["model", "engineering"], ["engineering", "data"]] },
  { name: "actor engineer symbol from model", edges: [["actor", "engineering"], ["model", "engineering"], ["engineering", "symbol"]] },
  { name: "actor engineer model from symbol", edges: [["actor", "engineering"], ["symbol", "engineering"], ["engineering", "model"]] },
  { name: "actor engineer model from data", edges: [["actor", "engineering"], ["data", "engineering"], ["engineering", "model"]] },
  { name: "actor engineer data from symbol", edges: [["actor", "engineering"], ["symbol", "engineering"], ["engineering", "data"]] },
  { name: "actor engineer symbol from data", edges: [["actor", "engineering"], ["data", "engineering"], ["engineering", "symbol"]] },

  { name: "infer_symbol (symbol → model → symbol)", edges: [["model", "deduce"], ["symbol", "deduce"], ["deduce", "symbol"]] },
  { name: "infer_symbol (data → model → symbol)", edges: [["model", "deduce"], ["data", "deduce"], ["deduce", "symbol"]] },
  { name: "infer_model (symbol → model → model)", edges: [["model", "deduce"], ["symbol", "deduce"], ["deduce", "model"]] },
  { name: "infer_model (data → model → model)", edges: [["model", "deduce"], ["data", "deduce"], ["deduce", "model"]] },
  { name: "infer_data (data → model → data)", edges: [["model", "deduce"], ["data", "deduce"], ["deduce", "data"]] },
  { name: "infer_data (symbol → model → data)", edges: [["model", "deduce"], ["symbol", "deduce"], ["deduce", "data"]] },
  { name: "embed transform", edges: [["symbol", "embed"], ["data", "embed"], ["embed", "model"]] },

  { name: "data-symbol transform", edges: [["symbol", "transform"], ["data", "transform"], ["transform", "data"]] },

  { name: "infer symbol from more model", edges: [["model", "deduce"], ["data", "deduce"], ["deduce", "symbol"]] }
];

// --- UPDATED: next-step constraints per shape.ts semantics ---
    const validNext = {
        // Inputs can go to processing or inference
        "symbol":     ["training", "engineering", "transform", "deduce", "symbol"],
        "data":       ["training", "engineering", "transform", "deduce", "data"],

        // Actor only engineers
        "actor":      ["engineering", "actor"],

        // Processing steps
        "training":   ["model"],
        "engineering":["model", "symbol"],

        // Inference
        "deduce":     ["symbol", "model", "deduce"],

        // Transform can output normalized data/symbol or feed models
        "transform":  ["data", "symbol", "model", "transform"],

        // Models typically feed deduce or transform
        "model":      ["deduce", "transform", "model"],

        // Documentation free-form (no enforcement here)
        "comment":    ["comment"],
    };

//The function which check validation for each pattern seperatedly and support complex pattern
function validatePattern() {
    const selectedCells = graph.getSelectionCells();
    if (selectedCells.length === 0) {
        alert("⚠️ No selection made! Please select a pattern before validation.");
        return;
    }

    const model = graph.getModel();

    // Updated logic for ignoring non-graphical nodes
    function isIgnorable(cell) {
        const ignoredNames = ["text", "conditions", "description", "note", "pre-conditions", "post-condition"];
        const ignoredStyles = ["swimlane", "group"];
        return (
            !cell.edge && (
                ignoredNames.includes((cell.name || "").toLowerCase()) ||
                ignoredNames.includes((cell.value || "").toLowerCase()) ||
                ignoredStyles.some(s => (cell.style || "").includes(s))
            )
        );
    }

    // Filter relevant nodes and edges
    const nodes = selectedCells.filter(cell => !cell.edge && !isIgnorable(cell));
    const edges = selectedCells.filter(cell => cell.edge && cell.source && cell.target);

    // Group nodes by their "name" attribute to treat duplicates as single logical nodes
    const nodesByName = {};
nodes.forEach(node => {
    const nodeName = node.name || "";
    if (!nodesByName[nodeName]) {
        nodesByName[nodeName] = [];
    }
    nodesByName[nodeName].push(node);
});

    // Extract edge names as [sourceName, targetName] - using "name" attribute only
    const edgeNameList = edges.map(edge => [
        edge.source.name || "",
        edge.target.name || ""
    ]);

    // Create a mapping from physical node ID to logical node name for tracking
    const nodeIdToLogicalName = {};
    Object.entries(nodesByName).forEach(([logicalName, physicalNodes]) => {
        physicalNodes.forEach(node => {
            nodeIdToLogicalName[node.id] = logicalName;
        });
    });

    const matchedPatterns = [];
    const matchedLogicalNodes = new Set(); // Track by logical name, not physical ID
    const matchedNodesByPattern = {};
    const usedEdgeIndices = new Set();

    allPatterns.forEach(pattern => {
        const required = [...pattern.edges];
        const tempEdges = edgeNameList.map((edge, i) => ({ edge, i }));

        let matchCount = 0;

        while (true) {
            const currentMatchIndices = [];
            const involvedLogicalNodes = new Set();
            let stillValid = true;

            for (const [from, to] of required) {
                const match = tempEdges.find(({ edge: [s, t], i }) => 
                    s === from && t === to && !usedEdgeIndices.has(i)
                );

                if (!match) {
                    stillValid = false;
                    break;
                }

                currentMatchIndices.push(match.i);
                // Track logical nodes (by name) instead of physical nodes (by ID)
                const sourceLogicalName = nodeIdToLogicalName[edges[match.i].source.id];
                const targetLogicalName = nodeIdToLogicalName[edges[match.i].target.id];
                if (sourceLogicalName) involvedLogicalNodes.add(sourceLogicalName);
                if (targetLogicalName) involvedLogicalNodes.add(targetLogicalName);
            }

            if (!stillValid) break;

            // Record the matched pattern instance
            matchedPatterns.push({ name: pattern.name });
            matchedNodesByPattern[pattern.name] = matchedNodesByPattern[pattern.name] || new Set();
            currentMatchIndices.forEach(i => usedEdgeIndices.add(i));
            
            // Add all logical nodes involved in this pattern
            involvedLogicalNodes.forEach(logicalName => {
                matchedLogicalNodes.add(logicalName);
                matchedNodesByPattern[pattern.name].add(logicalName);
            });

            matchCount++;
        }
    });

    // Clear previous tooltips
    nodes.forEach(n => delete n.tooltip);

    // Find unmatched logical nodes
    const unmatchedLogicalNodes = Object.keys(nodesByName).filter(
        logicalName => !matchedLogicalNodes.has(logicalName)
    );

    // Find isolated logical nodes (nodes with no connections)
    const isolatedLogicalNodes = Object.entries(nodesByName).filter(([logicalName, physicalNodes]) => {
        // Check if ANY physical instance of this logical node has connections
        const hasConnections = physicalNodes.some(node => 
            (model.getEdges(node) || []).length > 0
        );
        return !hasConnections;
    }).map(([logicalName]) => logicalName);

    // Annotate nodes with tooltips for disconnected/unmatched nodes
    nodes.forEach(node => {
        const logicalName = nodeIdToLogicalName[node.id];
        const incoming = model.getEdges(node, true, false) || [];
        const outgoing = model.getEdges(node, false, true) || [];

        if (incoming.length + outgoing.length === 0) {
            node.tooltip = "⚠️ Node is disconnected.";
        } else if (unmatchedLogicalNodes.includes(logicalName)) {
            node.tooltip = "⚠️ Node not part of any valid pattern.";
        }
    });

    // Build result summary based on logical nodes
    
    // Check for disconnected physical nodes (always check, regardless of pattern validity)
    const disconnectedNodes = nodes.filter(node => {
        const incoming = model.getEdges(node, true, false) || [];
        const outgoing = model.getEdges(node, false, true) || [];
        return incoming.length + outgoing.length === 0;
    });

    if (matchedPatterns.length > 0 && unmatchedLogicalNodes.length === 0 && isolatedLogicalNodes.length === 0 && disconnectedNodes.length === 0) {
        let summary = "✅ Valid pattern(s) detected:\n\n";
        for (const [pattern, logicalNodeSet] of Object.entries(matchedNodesByPattern)) {
            summary += `• ${pattern}\n`;
        }
        
        alert(summary);
    } else {
        let summary = "❌ Invalid pattern: Issues detected.\n\n";
        if (matchedPatterns.length > 0) {
            summary += "✅ Partial matches found:\n";
            for (const [pattern, logicalNodeSet] of Object.entries(matchedNodesByPattern)) {
                summary += `  • ${pattern} \n`;
            }
        }

        if (unmatchedLogicalNodes.length > 0) {
            summary += `\n⚠️ Unmatched logical nodes: ${unmatchedLogicalNodes.join(", ")}`;
        }

        if (isolatedLogicalNodes.length > 0) {
            summary += `\n⚠️ Isolated logical nodes: ${isolatedLogicalNodes.join(", ")}`;
        }

        if (disconnectedNodes.length > 0) {
            const disconnectedLabels = disconnectedNodes.map(node => 
                node.value || node.name || "Unnamed"
            );
            summary += `\n⚠️ Disconnected nodes: ${disconnectedLabels.join(", ")}`;
        }

        alert(summary);
    }
}

//If two node has same name and user connect them toghether, consider as one node.
    function mergeIdenticalNodes(edge) {
        let source = edge.source;
        let target = edge.target;
        if (!source || !target || source === target) return;
        if (source.value === target.value) {
            let model = graph.getModel();
            let inEdges = model.getEdges(target, true, false);
            let outEdges = model.getEdges(target, false, true);
            model.beginUpdate();
            try {
                inEdges.forEach(e => { if (e !== edge) e.target = source; });
                outEdges.forEach(e => { if (e !== edge) e.source = source; });
                model.remove(edge);
                model.remove(target);
            } finally {
                model.endUpdate();
            }
        }
    }
//Check to avoid wrong connections
    graph.addListener(mxEvent.CELL_CONNECTED, function(sender, evt) {
        let edge = evt.getProperty("edge");
        if (!edge || !edge.source || !edge.target) return;

        let source = edge.source.name;
        let target = edge.target.name;

        if (!validNext[source] || !validNext[source].includes(target)) {
            alert("❌ Invalid connection! Edge will be removed.");
            graph.getModel().remove(edge);
            return;
        }


        if (edge.source.name === edge.target.name) {
            mergeIdenticalNodes(edge);
        }
    });

    function addValidationButton() {
        const toolbar = ui.toolbar.container;
        const button = document.createElement("button");
        button.textContent = "Validate Pattern";
        button.style.marginLeft = "10px";
        button.style.padding = "5px 10px";
        button.style.border = "1px solid #000";
        button.style.background = "#4CAF50";
        button.style.color = "white";
        button.style.cursor = "pointer";
        button.style.fontWeight = "bold";
        button.onclick = validatePattern;
        toolbar.appendChild(button);
    }

    graph.removeCells = function(cells, includeEdges) {
        let model = this.getModel();
        model.beginUpdate();
        try {
            cells.forEach(cell => {
                if (!cell.edge) {
                    let connectedEdges = model.getEdges(cell, true, true);
                    connectedEdges.forEach(edge => model.remove(edge));
                    console.log(`🗑️ Deleted node "${cell.name}" with its edges`);
                }
            });
            mxGraph.prototype.removeCells.call(this, cells, includeEdges);
        } finally {
            model.endUpdate();
        }
    };

    addValidationButton();
    console.log("✅ Full Boxology Plugin Loaded.");
});
