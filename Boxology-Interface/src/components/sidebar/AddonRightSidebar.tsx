import React, { useState, useEffect, useRef } from 'react';
import * as go from 'gojs';
import { v4 as uuidv4 } from 'uuid';
import ExCls from '../../Examples/Pain-Cls-Example.json';
import ExSeg from '../../Examples/MRI-seg-Example.json';
import InstructionDialog from '../dialogs/InstructionDialog';
import QueryExplorerDialog from '../dialogs/QueryExplorerDialog';
import WorkflowImg from '../../assets/WorkFlow.png';
import { generateMultiPageRMLExport } from '../../utils/exportHelpers';
import { shapes, shapeTypesMin } from '../../data/shape';
import { getButtonStyle, getMenuButtonStyle } from '../../styles/buttonStyles';
import { colors } from '../../styles/theme';

interface RightSidebarProps {
  selectedData: {
    key: string | number;
    name: string;
    label: string;
    color: string;
    stroke: string;
    shape: string;
    isSuperNode?: boolean;
  } | null;
  diagramRef: React.RefObject<go.Diagram | null>;
  pages: any[];
  currentPageId: string;
  setPages: (pages: any[]) => void;
  setCurrentPageId: (id: string) => void;
}

type ExportNode = {
  id: string;
  name?: string;
  label?: string;
  borderRadius?: string | number;
};

type ExportDesignPattern = {
  id: string;
  label: string;
  input?: ExportNode[];
  output?: ExportNode[];
  process?: ExportNode;
};

type ExportBoxology = {
  id: string;
  label: string;
  DesignPattern?: ExportDesignPattern[];
};

type ExportJSON = {
  metadata?: Record<string, any>;
  boxologies?: ExportBoxology[];
};

function inferRootType(name = '', label = ''): 'Data' | 'Symbol' | 'Model' | 'Actor' | 'Transform' | 'Train' | 'Deduce' | 'Engineer' {
  const value = `${name} ${label}`.toLowerCase();

  const lc = (s = '') => String(s).toLowerCase().trim();
  const nameLc = lc(name);
  const labelLc = lc(label);

  // 1) match against explicit shape definitions
  const explicit = shapes.find(s => lc(s.name) === nameLc || lc(s.label) === labelLc || nameLc.includes(lc(s.name)) || labelLc.includes(lc(s.name)));
  if (explicit) {
    const key = lc(explicit.name);
    if (key.includes('engineer')) return 'Engineer';
    if (key.includes('deduce') || key.includes('infer')) return 'Deduce';
    if (key.includes('train')) return 'Train';
    if (key.includes('transform') || key.includes('embed')) return 'Transform';
    if (key.includes('actor') || key.includes('human') || key.includes('robot')) return 'Actor';
    if (key.includes('symbol') || key.includes('label') || key.includes('trace')) return 'Symbol';
    if (key.includes('model') || key.includes('network') || key.includes('ontology')) return 'Model';
    if (key.includes('data')) return 'Data';
  }

  // 2) match against aliases defined in shapeTypesMin
  for (const tKey in shapeTypesMin) {
    const aliases = shapeTypesMin[tKey] || [];
    for (const a of aliases) {
      const al = lc(a);
      if (!al) continue;
      if (value.includes(al) || nameLc.includes(al) || labelLc.includes(al)) {
        const tk = lc(tKey);
        if (tk === 'symbol') return 'Symbol';
        if (tk === 'data') return 'Data';
        if (tk.startsWith('model')) return 'Model';
        if (tk === 'transform' || tk === 'embed') return 'Transform';
        if (tk === 'training' || tk === 'training') return 'Train';
        if (tk === 'deduce' || tk === 'induction') return 'Deduce';
        if (tk === 'actor') return 'Actor';
        if (tk === 'engineering' || tk === 'engineer') return 'Engineer';
      }
    }
  }

  // 3) fallback heuristics
  if (value.includes('engineer')) return 'Engineer';
  if (value.includes('deduce') || value.includes('infer')) return 'Deduce';
  if (value.includes('train') || value.includes('training')) return 'Train';
  if (value.includes('transform') || value.includes('embed')) return 'Transform';
  if (value.includes('actor') || value.includes('human') || value.includes('robot')) return 'Actor';
  if (value.includes('symbol') || value.includes('label') || value.includes('rule') || value.includes('trace')) return 'Symbol';
  if (value.includes('model') || value.includes('network') || value.includes('ontology')) return 'Model';
  return 'Data';
}

function styleFromRootType(rootType: string): { shape: string; color: string; stroke: string; type: string; borderRadius?: string | number } {
  switch (rootType) {
    case 'Train':
      return { shape: 'RoundedRectangle', color: '#FFA07A', stroke: '#CD5C5C', type: 'Training', borderRadius: '45px' };
    case 'Deduce':
      return { shape: 'RoundedRectangle', color: '#ff81f7ff', stroke: '#4c003bff', type: 'Deduce', borderRadius: '45px' };
    case 'Transform':
      return { shape: 'RoundedRectangle', color: '#fbf2a2ff', stroke: '#B8A600', type: 'Transform', borderRadius: '45' };
    case 'Model':
      return { shape: 'Hexagon', color: '#f4ccf4ff', stroke: '#8B4F8B', type: 'Model' };
    case 'Symbol':
      return { shape: 'Rectangle', color: '#ccffccff', stroke: '#218721ff', type: 'Symbol' };
    case 'Actor':
      return { shape: 'Triangle', color: '#ffd6f6ff', stroke: '#a21caf', type: 'Actor' };
    case 'Engineer':
      return { shape: 'RoundedRectangle', color: '#e5e7eb', stroke: '#64748b', type: 'Engineer', borderRadius: '45' };
    default:
      return { shape: 'Rectangle', color: '#b7eaffff', stroke: '#1E5F8B', type: 'Data' };
  }
}

function nodeLoc(x: number, y: number): string {
  return `${x} ${y}`;
}

function convertExportBoxologyToPage(boxology: ExportBoxology) {
  const nodeMap = new Map<string, any>();
  const linkDataArray: any[] = [];
  let linkCounter = 1;

  const addNode = (rawNode: ExportNode | undefined, groupKey: string, x: number, y: number, isProcess = false) => {
    if (!rawNode?.id) return;

    const rootType = inferRootType(rawNode.name, rawNode.label);
    const visualType = isProcess ? inferRootType(rawNode.name, rawNode.label) : rootType;
    const style = styleFromRootType(visualType);

    const existing = nodeMap.get(rawNode.id);
    if (existing) {
      const shared = new Set<string>(existing.sharedGroups || []);
      if (existing.group && existing.group !== groupKey) shared.add(existing.group);
      shared.add(groupKey);
      existing.isShared = shared.size > 1;
      existing.sharedGroups = Array.from(shared);
      return;
    }

    nodeMap.set(rawNode.id, {
      key: rawNode.id,
      name: rawNode.name || rootType,
      label: rawNode.label || rawNode.name || rawNode.id,
      shape: style.shape,
      color: style.color,
      stroke: style.stroke,
      loc: nodeLoc(x, y),
      type: style.type,
      group: groupKey,
      isShared: false,
      sharedGroups: [groupKey],
    });
  };

  const addLink = (from?: string, to?: string) => {
    if (!from || !to) return;
    linkDataArray.push({ key: `link_export_${linkCounter++}`, from, to });
  };

  (boxology.DesignPattern || []).forEach((dp, index) => {
    const groupKey = dp.id;
    nodeMap.set(groupKey, { key: groupKey, isGroup: true, category: 'ClusterGroup', label: dp.label });

    const gridX = 220 + (index % 3) * 380;
    const gridY = 140 + Math.floor(index / 3) * 300;

    const processNode = dp.process;
    addNode(processNode, groupKey, gridX, gridY, true);

    (dp.input || []).forEach((inputNode, inputIndex) => {
      addNode(inputNode, groupKey, gridX - 180, gridY - 70 + inputIndex * 80, false);
      addLink(inputNode.id, processNode?.id);
    });

    (dp.output || []).forEach((outputNode, outputIndex) => {
      addNode(outputNode, groupKey, gridX + 190, gridY - 70 + outputIndex * 80, false);
      addLink(processNode?.id, outputNode.id);
    });
  });

  return {
    id: boxology.id,
    name: boxology.label,
    nodeDataArray: Array.from(nodeMap.values()),
    linkDataArray,
    boxologyId: boxology.id,
    boxologyLabel: boxology.label,
  };
}

function looksLikeExportJSON(data: any): data is ExportJSON {
  return !!data && typeof data === 'object' && Array.isArray(data.boxologies);
}

function escapeTurtleLiteral(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function exportJsonToTurtle(exportData: any): string {
  const triples = new Set<string>();
  const boxologies = Array.isArray(exportData?.boxologies) ? exportData.boxologies : [];

  const uri = (id: string) => `<http://tool4boxology.org/${id}>`;
  const typeUri = (name: string) => `<http://tool4boxology.org/${name}>`;

  for (const boxology of boxologies) {
    const b = uri(boxology.id);
    triples.add(`${b} rdf:type t4b:Boxology .`);
    triples.add(`${b} rdfs:label "${escapeTurtleLiteral(boxology.label || boxology.id)}" .`);

    for (const dp of boxology.DesignPattern || []) {
      const p = uri(dp.id);
      triples.add(`${b} t4b:hasPattern ${p} .`);
      triples.add(`${p} rdf:type t4b:DesignPattern .`);
      triples.add(`${p} rdfs:label "${escapeTurtleLiteral(dp.label || dp.id)}" .`);

      const process = dp.process;
      if (process?.id) {
        const proc = uri(process.id);
        triples.add(`${p} t4b:hasProcess ${proc} .`);
        triples.add(`${proc} rdfs:label "${escapeTurtleLiteral(process.label || process.id)}" .`);
        triples.add(`${proc} rdf:type ${typeUri(process.name || 'Process')} .`);
      }

      for (const input of dp.input || []) {
        if (!input?.id) continue;
        const i = uri(input.id);
        triples.add(`${p} t4b:hasInput ${i} .`);
        triples.add(`${i} rdfs:label "${escapeTurtleLiteral(input.label || input.id)}" .`);
        triples.add(`${i} rdf:type ${typeUri(input.name || 'Artifact')} .`);
        if (process?.id) triples.add(`${i} t4b:inputRoleParticipatesInProcess ${uri(process.id)} .`);
      }

      for (const output of dp.output || []) {
        if (!output?.id) continue;
        const o = uri(output.id);
        triples.add(`${p} t4b:hasOutput ${o} .`);
        triples.add(`${o} rdfs:label "${escapeTurtleLiteral(output.label || output.id)}" .`);
        triples.add(`${o} rdf:type ${typeUri(output.name || 'Artifact')} .`);
        if (process?.id) triples.add(`${uri(process.id)} t4b:outputRoleParticipatesInProcess ${o} .`);
      }
    }
  }

  const header = [
    '@prefix t4b: <http://tool4boxology.org/> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    ''
  ].join('\n');

  return `${header}${Array.from(triples).join('\n')}\n`;
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Perform an automatic layout on a GoJS diagram. Clears explicit `loc` properties
// so the layout algorithm can position nodes. Use 'layered' for tidy flow layouts
// or 'force' for organic layouts.
//function autoLayoutDiagram(diagram: go.Diagram | null, layoutType: 'layered' | 'force' = 'layered') {
  //if (!diagram) return;

// try {
//   const model = diagram.model as any;

//   // Clear explicit locations so the layout can reposition nodes
//   if (model && Array.isArray(model.nodeDataArray)) {
//     model.startTransaction && model.startTransaction('clear-locs');
//     for (const d of model.nodeDataArray) {
//       if (d && d.loc) {
//         // use setDataProperty when available so GoJS updates bindings
//         if (model.setDataProperty) model.setDataProperty(d, 'loc', undefined);
//         else d.loc = undefined;
//       }
//     }
//     model.commitTransaction && model.commitTransaction('clear-locs');
//   }

//   // Choose and run layout
//   diagram.startTransaction && diagram.startTransaction('auto-layout');
//   if (layoutType === 'layered') {
//     diagram.layout = new go.LayeredDigraphLayout({ direction: 0, layerSpacing: 50, columnSpacing: 100, setsPortSpots: false });
//   } else {
//     diagram.layout = new go.ForceDirectedLayout({ defaultSpringLength: 80, defaultElectricalCharge: 100 });
//   }
//   // force synchronous relayout
//   diagram.layoutDiagram && diagram.layoutDiagram(true);
//   diagram.commitTransaction && diagram.commitTransaction('auto-layout');
// } catch (e) {
//   // don't block the UI if layout fails
//   // eslint-disable-next-line no-console
//   console.warn('autoLayoutDiagram failed', e);
// }
// }
// ###
export default function AddonRightSidebar({ selectedData, diagramRef, pages, currentPageId, setPages, setCurrentPageId }: RightSidebarProps) {
  const [activeSection, setActiveSection] = useState<'paper1' | 'paper2' | 'paper3' | 'paper4' | 'paper5'>('paper1');
  const [localLabel, setLocalLabel] = useState('');
  const [localColor, setLocalColor] = useState('#ffffff');
  const [localStroke, setLocalStroke] = useState('#000000');
  const [localShape, setLocalShape] = useState('Rectangle');
  const [isLinkSelected, setIsLinkSelected] = useState(false);
  const [linkRouting, setLinkRouting] = useState<'straight' | 'curve'>('straight');
  const [selectedCount, setSelectedCount] = useState(0);
  const [showInstruction, setShowInstruction] = useState(false);
  const [showQueryExplorer, setShowQueryExplorer] = useState(false);
  const [mathSearch, setMathSearch] = useState('');
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const [conversionStatus, setConversionStatus] = useState<string>('');
  const [kgExportStatus, setKgExportStatus] = useState<string>('');
  const exportUploadRef = useRef<HTMLInputElement | null>(null);

  // Check how many objects are selected and detect links
  useEffect(() => {
    const diagram = diagramRef.current;
    if (!diagram) return;
    
    const handleSelectionChanged = () => {
      const count = diagram.selection.count;
      setSelectedCount(count);
      
      let linkSelected = false;
      diagram.selection.each((part) => {
        if (part instanceof go.Link) {
          linkSelected = true;
          const curve = part.curve;
          if (curve === go.Curve.Bezier) {
            setLinkRouting('curve');
          } else {
            setLinkRouting('straight');
          }
        }
      });
      setIsLinkSelected(linkSelected);
    };
    
    // Call immediately to check current selection state (important for UI sync)
    handleSelectionChanged();
    
    // Add listener for future selection changes
    diagram.addDiagramListener('ChangedSelection', handleSelectionChanged);
    
    return () => {
      diagram.removeDiagramListener('ChangedSelection', handleSelectionChanged);
    };
  }, [diagramRef, activeSection]);

  useEffect(() => {
    if (selectedData && selectedCount === 1 && !isLinkSelected) {
      setLocalLabel(selectedData.label || '');
      setLocalColor(selectedData.color || '#ffffff');
      setLocalStroke(selectedData.stroke || '#000000');
      setLocalShape(selectedData.shape || 'Rectangle');
    }
  }, [selectedData, selectedCount, isLinkSelected]);

  const loadExample = (example: any) => {
    if (!diagramRef.current) return;
    try {
      const nodeDataArray = example.nodeDataArray || [];
      const linkDataArray = example.linkDataArray || [];
      const modelData = example.modelData || {};
      const boxologyId = modelData.boxologyId || modelData.id || `boxology_${Math.random().toString(36).slice(2, 10)}`;
      const boxologyLabel = modelData.boxologyLabel || modelData.label || 'Diagram';

      const newPage = {
        id: uuidv4(),
        name: boxologyLabel,
        nodeDataArray,
        linkDataArray,
        boxologyId,
        boxologyLabel,
      };

      // Add the example as a new tab alongside the existing ones, syncing the
      // outgoing tab's live (unsynced) edits first so they aren't lost.
      const liveDiagramForSync = diagramRef.current;
      const withSyncedCurrent = liveDiagramForSync
        ? pages.map((p: any) => {
            if (p.id !== currentPageId) return p;
            const liveModel = liveDiagramForSync.model as go.GraphLinksModel;
            return { ...p, nodeDataArray: liveModel.nodeDataArray, linkDataArray: liveModel.linkDataArray || [] };
          })
        : pages;
      setPages([...withSyncedCurrent, newPage]);
      setCurrentPageId(newPage.id);

      const diagram = diagramRef.current;
      diagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);

      try {
        if (!diagram.model.modelData) (diagram.model as any).modelData = {};
        diagram.model.setDataProperty(diagram.model.modelData, 'boxologyId', boxologyId);
        diagram.model.setDataProperty(diagram.model.modelData, 'boxologyLabel', boxologyLabel);
      } catch {
        const m = diagram.model as any;
        if (!m.modelData) m.modelData = {};
        m.modelData.boxologyId = boxologyId;
        m.modelData.boxologyLabel = boxologyLabel;
      }
      // run automatic layout to arrange nodes after loading
      // autoLayoutDiagram(diagram, 'layered');
    } catch (err) {
      console.error('Failed to load example', err);
    }
  };

  const handleSidebarChange = (field: string, value: string) => {
    if (!selectedData || !diagramRef.current || selectedCount !== 1) return;
    
    try {
      const diagram = diagramRef.current;
      const model = diagram.model;
      
      model.startTransaction('update property');
      
      const nodeData = model.findNodeDataForKey(selectedData.key);
      if (nodeData) {
        model.setDataProperty(nodeData, field, value);
      }
      
      model.commitTransaction('update property');
    } catch (error) {
      console.error('Error updating property:', error);
    }
  };

  const handleColorChange = (color: string) => {
    setLocalColor(color);
    handleSidebarChange('color', color);
  };

  const handleStrokeChange = (stroke: string) => {
    setLocalStroke(stroke);
    handleSidebarChange('stroke', stroke);
  };

  const handleLinkStyleChange = (style: 'straight' | 'curve') => {
    if (!diagramRef.current) return;
    
    const diagram = diagramRef.current;
    diagram.startTransaction('change link style');
    
    diagram.selection.each((part) => {
      if (part instanceof go.Link) {
        if (style === 'curve') {
          part.curve = go.Curve.Bezier;
          part.routing = go.Link.Orthogonal;
        } else {
          part.routing = go.Link.Orthogonal;
          part.corner = 5;
          part.curve = go.Curve.JumpOver;
        }
      }
    });
    
    diagram.commitTransaction('change link style');
    setLinkRouting(style);
  };

  const handleUploadExportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!looksLikeExportJSON(parsed)) {
        setConversionStatus('Invalid file: expected export JSON with boxologies[]');
        return;
      }

      const convertedPages = (parsed.boxologies || []).map(convertExportBoxologyToPage).filter(Boolean);
      if (!convertedPages.length) {
        setConversionStatus('No boxologies found in export JSON');
        return;
      }

      setPages(convertedPages as any[]);
      setCurrentPageId(convertedPages[0].id);

      if (diagramRef.current) {
        diagramRef.current.model = new go.GraphLinksModel(convertedPages[0].nodeDataArray, convertedPages[0].linkDataArray);
        const loadedModel = diagramRef.current.model as go.GraphLinksModel;
        if (!loadedModel.modelData) (loadedModel as any).modelData = {};
        loadedModel.setDataProperty(loadedModel.modelData, 'boxologyId', convertedPages[0].boxologyId);
        loadedModel.setDataProperty(loadedModel.modelData, 'boxologyLabel', convertedPages[0].boxologyLabel);
        // Run automatic layout so uploaded diagrams are organized
        // autoLayoutDiagram(diagramRef.current, 'layered');
      }

      setConversionStatus(`Loaded ${convertedPages.length} converted page(s) from ${file.name}`);
    } catch (err: any) {
      console.error('Failed to convert export JSON:', err);
      setConversionStatus(`Conversion failed: ${err?.message || 'Unknown error'}`);
    } finally {
      event.target.value = '';
    }
  };

  const buildKgExportPayload = () => {
    if (!diagramRef.current) throw new Error('No diagram available');

    const model = diagramRef.current.model as go.GraphLinksModel;
    const currentPageNodes = model.nodeDataArray.map((n: any) => ({ ...n, type: n.type ?? n.name }));
    const currentPageLinks = (model.linkDataArray || []).map((l: any) => ({ ...l }));

    const updatedPages = pages.map((p: any) =>
      p.id === currentPageId
        ? { ...p, nodeDataArray: currentPageNodes, linkDataArray: currentPageLinks }
        : p
    );
    setPages(updatedPages);

    const rmlData = generateMultiPageRMLExport(updatedPages);
    const userId = window.localStorage.getItem('userId') || (() => {
      const id = `user_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem('userId', id);
      return id;
    })();
    const exportId = Math.random().toString(36).slice(2, 10);

    return {
      metadata: {
        exportId,
        userId,
        exportDate: new Date().toISOString(),
      },
      ...rmlData,
    };
  };

  const handleSidebarJsonExport = () => {
    try {
      const payload = buildKgExportPayload();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadTextFile(JSON.stringify(payload, null, 2), `boxology_export_${timestamp}.json`, 'application/json');
      setKgExportStatus('JSON export generated successfully.');
    } catch (err: any) {
      setKgExportStatus(`JSON export failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleSidebarTurtleExport = () => {
    try {
      const payload = buildKgExportPayload();
      const ttl = exportJsonToTurtle(payload);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadTextFile(ttl, `boxology_kg_${timestamp}.ttl`, 'text/turtle');
      setKgExportStatus('RDF Turtle export generated successfully.');
    } catch (err: any) {
      setKgExportStatus(`Turtle export failed: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <div
      style={{
        width: 300,
        background: '#f9f9f9',
        padding: 12,
        overflowY: 'auto',
        height: '100%',
        borderLeft: '1px solid #ddd',
        fontSize: '13px'
      }}
    >
      <div style={{ marginBottom: 12, padding: 12, background: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, letterSpacing: 0.6 }}>
          EVALUATIONS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => setActiveSection('paper1')} style={getMenuButtonStyle(activeSection === 'paper1')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span>Example Paper Title 1</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: activeSection === 'paper1' ? '#cbd5f5' : '#64748b' }}>
                Example Paper Description 1
              </span>
            </div>
          </button>
          <button onClick={() => setActiveSection('paper2')} style={getMenuButtonStyle(activeSection === 'paper2')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span>Example Paper Title 2</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: activeSection === 'paper2' ? '#cbd5f5' : '#64748b' }}>
                Example Paper Description 2
              </span>
            </div>
          </button>
          <button onClick={() => setActiveSection('paper3')} style={getMenuButtonStyle(activeSection === 'paper3')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span>Example Paper Title 3</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: activeSection === 'paper3' ? '#cbd5f5' : '#64748b' }}>
                Example Paper Description 3
              </span>
            </div>
          </button>
          <button onClick={() => setActiveSection('paper4')} style={getMenuButtonStyle(activeSection === 'paper4')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span>Example Paper Title 4</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: activeSection === 'style' ? '#cbd5f5' : '#64748b' }}>
                Example Paper Description 4
              </span>
            </div>
          </button>
          <button onClick={() => setActiveSection('paper5')} style={getMenuButtonStyle(activeSection === 'paper5')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
              <span>Example Paper Title 5</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: activeSection === 'paper5' ? '#cbd5f5' : '#64748b' }}>
                Example Paper Description 5
              </span>
            </div>
          </button>
        </div>
      </div>

      {activeSection === 'paper1' && (
        <div style={{ marginBottom: 12, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #eee' }}>
          <strong style={{ display: 'block', marginBottom: 6, fontWeight: '600', fontSize: '14px', color: '#1b1b1bff' }}>Example Paper Titel 1</strong>
          <p style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
            Here information about the paper will be displayed, such as:
          </p>
          <p style={{ fontSize: 12, color: '#555'}}>
            <strong>Authors: </strong>Author Name
          </p>
          <p style={{ fontSize: 12, color: '#555'}}>
            <strong>Year: </strong>2016
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={getButtonStyle()}>Link to Paper</button>
            <button style={getButtonStyle()}>Link to Dataset</button>
          </div>
        </div>
      )}

    </div>
  );
}