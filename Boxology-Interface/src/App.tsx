import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import Toolbar from './components/Toolbar';
import LeftSidebar from './components/LeftSidebar';
import GoDiagram from './GoDiagram';
import { saveWithPicker } from './utils/fs-save';
import * as go from 'gojs';
import RightSidebar from './components/RightSidebar';
import ContextMenu from './ContextMenu';
import { validateGoJSDiagram, validateElementaryOnlyDiagram } from './plugin/GoJSBoxologyValidation';
import { v4 as uuidv4 } from 'uuid';
import type { ValidationResult } from './utils/validation';
import { elementaryPatterns } from './data/patterns';
import { modelToDOT } from './utils/dot';
import { parseDOTToModel } from './utils/dotImport';
import { buildPagesFromModel } from './utils/pageBuilder';
import { openInGraphviz } from './utils/openInGraphviz';
import { generateMultiPageRMLExport, generateStableIdFromData, normalizeModelData } from './utils/exportHelpers';
import { API_BASE } from './config';
import InstructionDialog from './components/InstructionDialog';
import LoadingBox from './components/LoadingBox';


function App() {
  const diagramRef = useRef<go.Diagram | null>(null);
  const [containers, setContainers] = useState<string[]>(['General', 'Annotation']);
  const [customContainerShapes, setCustomContainerShapes] = useState<{ [key: string]: any[] }>({});
  const [selectedData, setSelectedData] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [customGroups, setCustomGroups] = useState<{ [key: string]: any[] }>({});
  const [kgJson, setKgJson] = useState<any>(null); // <-- Add this line


  // Page management for GoJS diagrams
    type PageData = {
      id: string;
      name: string;
      nodeDataArray: any[];
      linkDataArray: any[];
      // optional stable identifiers/labels used by Boxology exports/imports
      boxologyId?: string;
      boxologyLabel?: string;
    };

  const [pages, setPages] = useState<PageData[]>(
    [
      {
        id: uuidv4(),
        name: "Diagram",
        nodeDataArray: [],
        linkDataArray: [],
      },
    ]
  );

  // sanitize a filename for Windows/posix
  const sanitizeFilename = (name: string) =>
    name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().replace(/\s+/g, '_').slice(0, 120);

  // allow renaming a page (double-click tab)
  const handleRenamePage = (pageId: string) => {
    const p = pages.find(pp => pp.id === pageId);
    if (!p) return;
    const newName = prompt('Enter new page name:', p.name);
    if (!newName) return;
    setPages(prev => prev.map(pg => pg.id === pageId ? { ...pg, name: newName.trim() } : pg));
  };

  const [currentPageId, setCurrentPageId] = useState(pages[0].id);

  // Update current page data
  const updateCurrentPage = (nodeDataArray: any[], linkDataArray: any[]) => {
    setPages(pages.map(p => {
      if (p.id === currentPageId) {
        return { ...p, nodeDataArray, linkDataArray };
      }
      return p;
    }));
  };

  // Add new page function
  const handleAddNewPage = () => {
    // Save current diagram before switching
    if (diagramRef.current && currentPageId) {
      const model = diagramRef.current.model as go.GraphLinksModel;
      updateCurrentPage(model.nodeDataArray, model.linkDataArray);
    }

    const newPage: PageData = {
      id: uuidv4(),
      name: `Diagram ${pages.length + 1}`,
      nodeDataArray: [],
      linkDataArray: [],
    };
    
    setPages(prev => [...prev, newPage]);
    setCurrentPageId(newPage.id);
  };

  // Switch to different page
  const handlePageSwitch = (pageId: string) => {
    // Save current diagram data before switching
    if (diagramRef.current && currentPageId) {
      const model = diagramRef.current.model as go.GraphLinksModel;
      updateCurrentPage(model.nodeDataArray, model.linkDataArray);
    }
    
    setCurrentPageId(pageId);
  };

  // Close page
  const handleClosePage = (pageId: string) => {
    if (pages.length === 1) return; // Can't close last page
    
    setPages(prev => prev.filter(page => page.id !== pageId));
    
    // If closing current page, switch to first remaining page
    if (currentPageId === pageId) {
      const remainingPages = pages.filter(page => page.id !== pageId);
      setCurrentPageId(remainingPages[0].id);
    }
  };

  // Get current page
  const currentPage = pages.find((p) => p.id === currentPageId);

  // Load diagram data when page changes
  useEffect(() => {
    if (diagramRef.current && currentPage) {
      const diagram = diagramRef.current;
      diagram.model = new go.GraphLinksModel(
        currentPage.nodeDataArray,
        currentPage.linkDataArray
      );
    }
  }, [currentPageId, currentPage]);

  // Initialize elementary patterns in custom groups
  useEffect(() => {
    const patternsGroup = elementaryPatterns.map(pattern => ({
      id: pattern.id,
      name: pattern.name,
      description: pattern.description,
      type: 'pattern',
      pattern: pattern
    }));
    
    setCustomGroups(prev => ({
      ...prev,
      'Elementary Patterns': patternsGroup
    }));
  }, []); // Only run once on mount

  // Consolidated container management
  const handleAddContainer = (containerName: string) => {
    if (containerName && !containers.includes(containerName)) {
      setContainers(prev => [...prev, containerName]);
      alert(`Container "${containerName}" added!`);
    } else if (containerName) {
      alert('Container already exists!');
    }
  };

  // Consolidated custom group management
  const handleCustomGroupAction = (action: 'create' | 'save', groupName?: string) => {
    if (action === 'create') {
      const name = prompt('Enter a name for your new group:');
      if (!name) return;
      if (customGroups[name]) {
        alert('A group with this name already exists.');
        return;
      }
      setCustomGroups(prev => ({ ...prev, [name]: [] }));
      return;
    } else if (action === 'save' && groupName) {
      handleSaveToCustomGroup(groupName);
    }
  };

  // Consolidated save to custom group function
  const handleSaveToCustomGroup = (groupName: string) => {
    if (!diagramRef.current) {
      alert('No diagram available');
      return;
    }

    const diagram = diagramRef.current;
    const selectedNodes = diagram.selection.toArray();
    let dataToSave;

    let shapeName = prompt('Enter a name for this shape:', `Custom Shape ${Date.now()}`);
    if (!shapeName) shapeName = `Custom Shape ${Date.now()}`;

    if (selectedNodes.length > 0) {
      // Save selected nodes and their connections
      const selectedKeys = selectedNodes.map(node => node.key);
      const nodeData = selectedNodes.map(node => diagram.model.copyNodeData(node.data));
      const links = Array.from(diagram.links).filter(link => 
        selectedKeys.includes(link.fromNode?.key) && selectedKeys.includes(link.toNode?.key)
      );
      const linkData = links.map(link => ({ ...link.data }));

      dataToSave = {
        nodeDataArray: nodeData,
        linkDataArray: linkData,
        name: shapeName,
        type: 'selection',
        thumbnail: null as string | null
      };
    } else {
      // Save entire diagram
      const model = diagram.model;
      const boxology = JSON.parse(model.toJson());
      dataToSave = {
        nodeDataArray: model.nodeDataArray.map(node => model.copyNodeData(node)),
        linkDataArray: boxology.linkDataArray || [],
        name: shapeName,
        type: 'diagram',
        thumbnail: null as string | null
      };
    }

    // Generate thumbnail
    try {
      const img = diagram.makeImageData({
        scale: 0.3,
        background: 'white',
        parts: selectedNodes.length > 0 ? selectedNodes : undefined,
        type: 'image/png'
      });
      if (typeof img === 'string') {
        dataToSave.thumbnail = img;
      } else if (img instanceof HTMLImageElement) {
        dataToSave.thumbnail = img.src;
      } else {
        dataToSave.thumbnail = null;
      }
    } catch (error) {
      console.warn('Could not generate thumbnail:', error);
    }

    setCustomGroups(prev => ({
      ...prev,
      [groupName]: [...(prev[groupName] || []), dataToSave]
    }));

    alert(`${selectedNodes.length > 0 ? 'Selection' : 'Diagram'} saved as custom shape in "${groupName}" group!`);
  };

  // Unified export/save helper: try picker, else download
  const isUserCancelledError = (err: any) =>
    err?.name === 'AbortError' || err?.canceled === true || /aborted|cancel/i.test(String(err?.message));

  const saveOrDownload = async (blob: Blob, filename: string, mime: string): Promise<boolean> => {
    try {
      await saveWithPicker(blob, filename, mime);
      return true;
    } catch (err) {
      // If the user canceled the picker, do not save
      if (isUserCancelledError(err)) return false;
      // On other errors (e.g., unsupported), fallback to classic download
      try {
        downloadFile(blob, filename);
        return true;
      } catch {
        return false;
      }
    }
  };

  const buildKgExportData = () => {
    if (!diagramRef.current) {
      throw new Error('No diagram available');
    }

    const model = diagramRef.current.model as go.GraphLinksModel;
    const currentPageNodes = model.nodeDataArray.map((n: any) => ({ ...n, type: n.type ?? n.name }));
    const currentPageLinks = (model.linkDataArray || []).map((l: any) => ({ ...l }));

    const updatedPages = pages.map(p =>
      p.id === currentPageId
        ? { ...p, nodeDataArray: currentPageNodes, linkDataArray: currentPageLinks }
        : p
    );

    const rmlData = generateMultiPageRMLExport(updatedPages);
    const userId = window.localStorage.getItem('userId') || (() => {
      const id = `user_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem('userId', id);
      return id;
    })();
    const exportUUID = uuidv4().replace(/-/g, '').slice(0, 8);

    return {
      exportData: {
        metadata: {
          exportId: exportUUID,
          userId,
          exportDate: new Date().toISOString(),
        },
        ...rmlData,
      },
      updatedPages,
      userId,
      exportUUID,
    };
  };

  // Consolidated file operations
  const handleFileOperation = async (operation: 'save' | 'open') => {
    if (operation === 'save') {
      if (!diagramRef.current) {
        alert('No diagram available');
        return;
      }
      const model = diagramRef.current.model as go.GraphLinksModel;

      // Normalize all keys before saving
      const { nodeDataArray, linkDataArray } = normalizeModelData(
        (model.nodeDataArray as any[]) || [],
        model.linkDataArray || []
      );

      // Update the model with normalized data
      diagramRef.current.model = go.Model.fromJson(JSON.stringify({
        class: "GraphLinksModel",
        nodeDataArray,
        linkDataArray,
        modelData: model.modelData
      }));

      // ensure model.modelData exists
      const updatedModel = diagramRef.current.model as go.GraphLinksModel;
      if (!updatedModel.modelData) (updatedModel as any).modelData = {};

      // ensure current page persisted boxology id/label and store into model.modelData
      const page = pages.find(p => p.id === currentPageId);

      const id = page?.boxologyId ?? page?.id ?? generateStableIdFromData(nodeDataArray, linkDataArray);
      const label = page?.boxologyLabel ?? page?.name ?? 'Diagram';

      // persist on model.modelData using GoJS setter
      try {
        updatedModel.setDataProperty(updatedModel.modelData, 'boxologyId', id);
        updatedModel.setDataProperty(updatedModel.modelData, 'boxologyLabel', label);
      } catch {
        (updatedModel as any).modelData.boxologyId = id;
        (updatedModel as any).modelData.boxologyLabel = label;
      }

      // persist into pages state with normalized data
      setPages(prev => prev.map(pg => 
        pg.id === currentPageId 
          ? { ...pg, nodeDataArray, linkDataArray, boxologyId: id, boxologyLabel: label } 
          : pg
      ));

      const modelBoxology = updatedModel.toJson();

      const pageName = pages.find(p => p.id === currentPageId)?.name || 'diagram';
      const safe = sanitizeFilename(pageName) || 'diagram';
      const date = new Date().toISOString().slice(0, 10);
      const filename = `${safe}_${date}.boxology`;

      const blob = new Blob([modelBoxology], { type: 'application/boxology' });
      const saved = await saveOrDownload(blob, filename, 'application/boxology');
      if (saved) alert('Diagram saved!');
      return;
    }

    // OPEN
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.boxology,application/boxology,application/json,text/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const name = file.name.toLowerCase();

      // 1) Parse to our canonical hierarchical model
      let model: any | null = null;
      try {
        if (name.endsWith('.boxology') || name.endsWith('.json')) {
          model = JSON.parse(text);

        } else {
          alert('Unsupported format. Use .boxology.');
          return;
        }
      } catch (e) {
        console.error('Import parse error:', e);
        alert('Failed to parse file.');
        return;
      }

      // Normalize node names/types to capitalized form
const capitalize = (str: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

// Normalize node names/types to capitalized form
if (model && model.nodeDataArray) {
  model.nodeDataArray = model.nodeDataArray.map((node: any) => ({
    ...node,
    name: capitalize(node.name),
    type: capitalize(node.type),
  }));
}

      // Build pages
      try {
        const { pages: newPages } = buildPagesFromModel(model, file.name.replace(/\.[^.]+$/, ''));

        // Extract boxologyId/boxologyLabel from model.modelData if present
        const savedBoxologyId = model.modelData?.boxologyId;
        const savedBoxologyLabel = model.modelData?.boxologyLabel;

        // Ensure every page has a boxologyId/boxologyLabel
        const ensuredPages = newPages.map(pg => {
          // Priority: saved id from modelData > existing page.boxologyId > deterministic hash
          const id = savedBoxologyId ?? (pg as any).boxologyId ?? pg.id ?? generateStableIdFromData(pg.nodeDataArray, pg.linkDataArray);
          // Priority: saved label from modelData > existing page.boxologyLabel > page name
          const label = savedBoxologyLabel ?? (pg as any).boxologyLabel ?? pg.name ?? `Diagram`;
          return { ...pg, boxologyId: id, boxologyLabel: label };
        });

        setPages(ensuredPages);
        setCurrentPageId(ensuredPages[0].id);

        // Load the first page into the diagram
        const pg = ensuredPages[0];
        if (diagramRef.current) {
          diagramRef.current.model = new go.GraphLinksModel(pg.nodeDataArray, pg.linkDataArray);
          // Restore boxologyId/boxologyLabel into model.modelData
          try {
            const loadedModel = diagramRef.current.model as go.GraphLinksModel;
            if (!loadedModel.modelData) (loadedModel as any).modelData = {};
            loadedModel.setDataProperty(loadedModel.modelData, 'boxologyId', pg.boxologyId);
            loadedModel.setDataProperty(loadedModel.modelData, 'boxologyLabel', pg.boxologyLabel);
          } catch { 
            // fallback
            const m = diagramRef.current.model as any;
            if (!m.modelData) m.modelData = {};
            m.modelData.boxologyId = pg.boxologyId;
            m.modelData.boxologyLabel = pg.boxologyLabel;
          }
        }
      } catch (e) {
        console.error('Page build error:', e);
        alert('Import succeeded but page reconstruction failed.');
      }
    };
    input.click();
  };

// Add validation function to check if all nodes belong to exactly one cluster
const validateNodeClustering = (): { valid: boolean; errors: string[] } => {
  if (!diagramRef.current) return { valid: false, errors: ['No diagram available'] };
  
  const diagram = diagramRef.current;
  const model = diagram.model as go.GraphLinksModel;
  const nodes = model.nodeDataArray;
  
  const errors: string[] = [];
  
  // Get all group nodes (clusters)
  const groups = nodes.filter((n: any) => n.isGroup);
  
  // Check each non-group node
  for (const node of nodes) {
    if (node.isGroup) continue; // Skip cluster nodes themselves
    
    const isShared = node.isShared && node.sharedGroups && node.sharedGroups.length > 0;
    
    // Check if node has a group assignment OR is shared
    if (!node.group && !isShared) {
      const nodeLabel = node.label || node.text || node.name || node.key;
      errors.push(`Node "${nodeLabel}" does not belong to any cluster.`);
      continue;
    }
    
    // If node has regular group, verify it exists
    if (node.group) {
      const groupExists = groups.some((g: any) => g.key === node.group);
      if (!groupExists) {
        const nodeLabel = node.label || node.text || node.name || node.key;
        errors.push(`Node "${nodeLabel}" belongs to a non-existent cluster.`);
      }
    }
    
    // If node is shared, verify all sharedGroups exist
    if (isShared) {
      for (const sharedGroupKey of node.sharedGroups) {
        const groupExists = groups.some((g: any) => g.key === sharedGroupKey);
        if (!groupExists) {
          const nodeLabel = node.label || node.text || node.name || node.key;
          errors.push(`Node "${nodeLabel}" references non-existent cluster: ${sharedGroupKey}`);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

  const handleExport = async (kind: 'png' | 'jpg' | 'json' | 'dot') => {
    // Validate clustering before export
    const validation = validateNodeClustering();
    if (!validation.valid) {
      alert(
        'Cannot export: All nodes must belong to exactly one cluster.\n\n' +
        'Issues found:\n' +
        validation.errors.join('\n')
      );
      return;
    }

    if (!diagramRef.current) {
      alert('No diagram to export');
      return;
    }

    const diagram = diagramRef.current;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    switch (kind) {

      case 'png':
      case 'jpg': {
        // Use helper to export the full document bounds (not the viewport)
        await exportFullDiagramImage(kind, 2, 20);
        break;
      }


      case 'json': {
        // Elementary-pattern validation before exporting JSON
        const elemResult = validateElementaryOnlyDiagram(diagram);
        if (!elemResult.valid) {
          alert('Cannot export: diagram failed elementary pattern validation.\n\n' + elemResult.summary);
          return;
        }

        const { exportData, updatedPages, userId, exportUUID } = buildKgExportData();
        setPages(updatedPages);

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        await saveOrDownload(blob, `boxology_${userId}_${timestamp}_${exportUUID}.json`, 'application/json');
        break;
      }

      case 'dot': {
        const data = {
          nodeDataArray: diagram.model.nodeDataArray,
          linkDataArray: (diagram.model as go.GraphLinksModel).linkDataArray || [],
        };
        const dot = modelToDOT(data, { graphLabel: 'Boxology' });
        const blob = new Blob([dot], { type: 'text/vnd.graphviz;charset=utf-8' });
        await saveOrDownload(blob, `diagram_${timestamp}.dot`, 'text/vnd.graphviz');
        break;
      }
    }
  };

  // Helper function to convert GoJS data to Draw.io XML format
  const convertToDrawioXML = (data: any): string => {
    const nodes = data.nodeDataArray || [];
    const links = data.linkDataArray || [];
    
    let mxCells = '';
    let cellId = 2; // Start from 2 (0 and 1 are reserved)
    
    // Convert nodes
    nodes.forEach((node: any) => {
      const x = node.loc ? parseFloat(node.loc.split(' ')[0]) : 0;
      const y = node.loc ? parseFloat(node.loc.split(' ')[1]) : 0;
      const width = 120;
      const height = 80;
      
      // Determine shape style based on GoJS shape
      let style = 'rounded=0;whiteSpace=wrap;html=1;';
      if (node.shape === 'RoundedRectangle') {
        style = 'rounded=1;whiteSpace=wrap;html=1;';
      } else if (node.shape === 'Ellipse') {
        style = 'ellipse;whiteSpace=wrap;html=1;';
      } else if (node.shape === 'Diamond') {
        style = 'rhombus;whiteSpace=wrap;html=1;';
      } else if (node.shape === 'Triangle') {
        style = 'triangle;whiteSpace=wrap;html=1;';
      } else if (node.shape === 'Hexagon') {
        style = 'hexagon;whiteSpace=wrap;html=1;';
      }
      
      // Add fill color if available
      if (node.color) {
        style += `fillColor=${node.color};`;
      }
      if (node.stroke) {
        style += `strokeColor=${node.stroke};`;
      }
      
      mxCells += `
        <mxCell id="${cellId}" value="${node.text || node.label || ''}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
        </mxCell>`;
      
      // Store node ID mapping for links
      node._drawioId = cellId;
      cellId++;
    });
    
    // Convert links
    links.forEach((link: any) => {
      const fromNode = nodes.find((n: any) => n.key === link.from);
      const toNode = nodes.find((n: any) => n.key === link.to);
      
      if (fromNode && toNode) {
        mxCells += `
          <mxCell id="${cellId}" value="${link.text || ''}" style="endArrow=classic;html=1;" edge="1" parent="1" source="${fromNode._drawioId}" target="${toNode._drawioId}">
            <mxGeometry relative="1" as="geometry"/>
          </mxCell>`;
        cellId++;
      }
    });
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="GoJS Diagram Editor" version="24.7.17" etag="exported">
  <diagram name="Diagram" id="diagram">
    <mxGraphModel dx="1422" dy="754" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${mxCells}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  };

  // Helper functions for downloads
  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export full diagram (entire document bounds) at given scale and kind
  async function exportFullDiagramImage(kind: 'png' | 'jpg', scale = 2, pad = 20) {
    if (!diagramRef.current) {
      alert('No diagram to export');
      return;
    }
    const diagram = diagramRef.current;
    const bounds = diagram.documentBounds;
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      alert('Diagram is empty or has no bounds to export.');
      return;
    }

    const imgType = kind === 'png' ? 'image/png' : 'image/jpeg';

    // Calculate target size (scaled) and include padding
    const targetW = Math.ceil(bounds.width * scale) + pad * 2;
    const targetH = Math.ceil(bounds.height * scale) + pad * 2;

    const rawImg = diagram.makeImageData({
      background: 'white',
      scale,
      type: imgType,
      maxSize: new go.Size(targetW, targetH)
    });

    const toImageElement = async (srcOrEl: string | HTMLImageElement | ImageData | null): Promise<HTMLImageElement> => {
      if (!srcOrEl) throw new Error('No image returned from GoJS');
      if (srcOrEl instanceof HTMLImageElement) return srcOrEl;
      if (typeof srcOrEl === 'string') {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
          img.src = srcOrEl;
        });
      }
      const canvas = document.createElement('canvas');
      canvas.width = srcOrEl.width;
      canvas.height = srcOrEl.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context for ImageData conversion');
      ctx.putImageData(srcOrEl, 0, 0);
      const dataUrl = canvas.toDataURL(imgType);
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = dataUrl;
      });
    };

    try {
      const imgEl = await toImageElement(rawImg);

      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth + pad * 2;
      canvas.height = imgEl.naturalHeight + pad * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) { alert('Failed to create canvas context'); return; }
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgEl, pad, pad);

      await new Promise<void>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            await saveOrDownload(blob, `diagram_${ts}.${kind}`, imgType);
          } else {
            alert('Failed to generate image blob');
          }
          resolve();
        }, imgType);
      });
    } catch (err) {
      console.error('Full diagram export error:', err);
      alert('Failed to export full diagram image.');
    }
  }

  // Diagram operations
  const handleDiagramOperation = (operation: 'undo' | 'redo' | 'validate') => {
    if (!diagramRef.current) return;

    switch (operation) {
      case 'undo':
        diagramRef.current.undoManager?.undo();
        break;
      case 'redo':
        diagramRef.current.undoManager?.redo();
        break;
      case 'validate':
        const result = validateGoJSDiagram(diagramRef.current);
        alert(result);
        break;
    }
  };

  // Context menu handler
  const handleContextMenuAction = (action: string, target?: string) => {
    setContextMenu(null);
  
    switch (action) {
      case 'create_group':
        handleCustomGroupAction('create');
        break;
      case 'save_to_group':
        if (target) {
          handleCustomGroupAction('save', target);
          return;
        }
        break;
      case 'cluster_group':
        handleClusterSelectedNodes();
        break;
      case 'uncluster_group':
        handleUnclusterGroup();
        break;
      default:
        if (target) {
          console.log('Adding to group:', target);
        }
    }
  };

  // About modal state
  const [showAbout, setShowAbout] = useState(false);

  const handleAbout = () => {
    setShowAbout(true);
  };

  // Instructions modal state + handler
  const [showInstructions, setShowInstructions] = useState(false); // add state

  const handleShowInstructions = () => setShowInstructions(true);  // open
  const handleCloseInstructions = () => setShowInstructions(false); // close

  // If you still auto‑show on first visit, uncomment:
  useEffect(() => {
     if (localStorage.getItem('hasSeenInstructions') !== 'true') {
       setShowInstructions(true);
       localStorage.setItem('hasSeenInstructions', 'true');
     }
   }, []);
   
  // Copy email function
  const copyEmailToClipboard = () => {
  const email = 'mahsa.forghani.tehrani@stud.uni-hannover.de';
  navigator.clipboard.writeText(email).then(() => {
    alert('Email copied to clipboard!');
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = email;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Email copied to clipboard!');
  });
};

  // Prevent Ctrl+A from selecting all page elements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+A (or Cmd+A on Mac) from selecting all page elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        
        // Optional: If you want Ctrl+A to work within the diagram only
        if (diagramRef.current && document.activeElement === diagramRef.current.div) {
          // Let GoJS handle Ctrl+A for selecting all diagram elements
          return;
        }
        
        // Prevent default browser "select all" behavior
        return false;
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Collapse state for sidebars
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('leftCollapsed') === 'true';
  });
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('rightCollapsed') === 'true';
  });

  // 💾 PERSIST STATE ON CHANGE
  useEffect(() => {
    localStorage.setItem('leftCollapsed', String(leftCollapsed));
  }, [leftCollapsed]);

  useEffect(() => {
    localStorage.setItem('rightCollapsed', String(rightCollapsed));
  }, [rightCollapsed]);

  // ⌨️ KEYBOARD SHORTCUTS: Ctrl+Alt+[ for left, Ctrl+Alt+] for right
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key === '[') {
        e.preventDefault();
        setLeftCollapsed(v => !v);
      }
      if (e.ctrlKey && e.altKey && e.key === ']') {
        e.preventDefault();
        setRightCollapsed(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 📏 SIDEBAR WIDTHS for clean JSX
  const LEFT_W = leftCollapsed ? 44 : 300;   // 44px rail when collapsed
  const RIGHT_W = rightCollapsed ? 44 : 280; // 44px rail when collapsed

  // 🔄 OPTIONAL: Nudge diagram layout when sidebars change
  useEffect(() => {
    if (diagramRef.current) {
      diagramRef.current.requestUpdate(); // gentle layout refresh
    }
  }, [leftCollapsed, rightCollapsed]);

  const processNodeNames = [
    "Train", "Engineer", "Deduce", "Induce", "Transform", "Embed"
  ];

  // Validate process nodes in a selection
  function hasMultipleProcessNodes(selectedNodes: go.Node[]) {
    const processNodes = selectedNodes.filter(
      n =>
        processNodeNames.includes(n.data.name) ||
        processNodeNames.includes(n.data.type)
    );
    return processNodes.length > 1;
  }

  // Detect which nodes should be shared based on cluster connectivity
  const detectAndUpdateSharedNodes = () => {
    if (!diagramRef.current) return;
    
    const diagram = diagramRef.current;
    const model = diagram.model as go.GraphLinksModel;
    const nodes = model.nodeDataArray;
    const links = model.linkDataArray;

    diagram.startTransaction('update shared nodes');

    // For each non-process, non-group node
    for (const node of nodes) {
      if (node.isGroup) continue; // Skip groups
      
      const isProcessNode = processNodeNames.includes(node.name) || processNodeNames.includes(node.type);
      if (isProcessNode) continue; // Process nodes cannot be shared
      
      // Find all incoming and outgoing links
      const connectedLinks = links.filter((l: any) => l.from === node.key || l.to === node.key);
      if (connectedLinks.length === 0) continue;

      // Get clusters of connected nodes
      const connectedClusters = new Set<string>();
      for (const link of connectedLinks) {
        const otherKey = link.from === node.key ? link.to : link.from;
        const otherNode = nodes.find((n: any) => n.key === otherKey);
        if (otherNode && otherNode.group && !otherNode.isGroup) {
          connectedClusters.add(otherNode.group);
        }
      }

      // If node connects multiple clusters OR belongs to a cluster but has external connections
      const nodeCluster = node.group;
      const isShared = connectedClusters.size > 1 || (nodeCluster && connectedClusters.size > 0 && !connectedClusters.has(nodeCluster));

      if (isShared) {
        // Mark as shared and extract from cluster
        model.setDataProperty(node, 'isShared', true);
        
        // Collect all clusters this node belongs to
        const allClusters = new Set<string>();
        if (nodeCluster) allClusters.add(nodeCluster);
        connectedClusters.forEach(c => allClusters.add(c));
        
        model.setDataProperty(node, 'sharedGroups', Array.from(allClusters));
        
        // Extract from primary group visually by setting to null
        model.setDataProperty(node, 'group', null);
      } else {
        // Remove shared status
        model.setDataProperty(node, 'isShared', false);
        model.setDataProperty(node, 'sharedGroups', []);
      }
    }

    diagram.commitTransaction('update shared nodes');
  };

  // Cluster currently selected nodes into a gray labeled group
  const handleClusterSelectedNodes = () => {
    if (!diagramRef.current) {
      alert('No diagram available');
      return;
    }
    const diagram = diagramRef.current;

    // Collect selected non-group nodes
    const selectedNodes: go.Node[] = [];
    diagram.selection.each(part => {
      if (part instanceof go.Node && !part.data.isGroup) selectedNodes.push(part);
    });

    if (selectedNodes.length === 0) {
      alert('Select one or more nodes to cluster.');
      return;
    }

    // 🚨 ADD VALIDATION HERE
    if (hasMultipleProcessNodes(selectedNodes)) {
      alert('❌ Error: A cluster cannot contain more than one process node.');
      return;
    }

    const defaultLabel = 'Cluster';
    const label = prompt('Cluster label:', defaultLabel) || defaultLabel;

    diagram.startTransaction('cluster group');
    const key = `group_${Date.now()}`;

    const groupData: any = {
      key,
      isGroup: true,
      category: 'ClusterGroup',
      label
    };
    (diagram.model as go.GraphLinksModel).addNodeData(groupData);

    // Assign selected nodes to this group
    selectedNodes.forEach(n => {
      (diagram.model as go.GraphLinksModel).setDataProperty(n.data, 'group', key);
    });

    diagram.commitTransaction('cluster group');
    
    // Auto-detect and update shared nodes
    setTimeout(() => detectAndUpdateSharedNodes(), 100);
  };

  const handleUnclusterGroup = () => {
    if (!diagramRef.current) {
      alert('No diagram available');
      return;
    }

    const diagram = diagramRef.current;
    const selectedPart = diagram.selection.first();

    if (!(selectedPart instanceof go.Group)) {
      alert('Please select a cluster group to uncluster.');
      return;
    }

    diagram.startTransaction('uncluster_group');

    const members: go.Node[] = [];
    selectedPart.memberParts.each(part => {
      if (part instanceof go.Node) {
        members.push(part);
      }
    });

    const model = diagram.model as go.GraphLinksModel;
    members.forEach(member => {
      model.setDataProperty(member.data, 'group', undefined);
    });

    model.removeNodeData(selectedPart.data);

    diagram.commitTransaction('uncluster_group');
    
    // Auto-detect and update shared nodes
    setTimeout(() => detectAndUpdateSharedNodes(), 100);

    alert(`✅ Cluster unclustered! ${members.length} node(s) released.`);
  };

  const [isCreatingKG, setIsCreatingKG] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(''); // Add this state

  const handleCreateKG = async () => {
    const validation = validateNodeClustering();
    if (!validation.valid) {
      setLoadingMessage(`Validation failed:\n\n${validation.errors.join('\n')}`);
      setIsCreatingKG(true);
      setTimeout(() => setIsCreatingKG(false), 2500);
      return;
    }
    if (!diagramRef.current) {
      setLoadingMessage('Diagram not ready.');
      setIsCreatingKG(true);
      setTimeout(() => setIsCreatingKG(false), 2000);
      return;
    }

    setLoadingMessage('Creating Knowledge Graph...');
    setIsCreatingKG(true);

    const { exportData, updatedPages, userId, exportUUID } = buildKgExportData();
    setPages(updatedPages);

    setKgJson(exportData); // <-- Add this line to store the latest KG

    try {
      const res = await fetch(`${API_BASE}/api/kg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData)
      });
      if (!res.ok) throw new Error(`Backend error ${res.status}: ${await res.text()}`);

      const kgResult = await res.json().catch(() => null);
      const rdfText = typeof kgResult?.rdf === 'string' ? kgResult.rdf : '';
      if (rdfText) {
        const rdfMime = typeof kgResult?.rdf_format === 'string' ? kgResult.rdf_format : 'application/n-triples';
        const ntBlob = new Blob([rdfText], { type: `${rdfMime};charset=utf-8` });
        const ntStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await saveOrDownload(ntBlob, `boxology_${userId}_${ntStamp}_${exportUUID}.nt`, rdfMime);
      }

      setLoadingMessage('KG created successfully.');
      setTimeout(() => setIsCreatingKG(false), 2000);
    } catch (err: any) {
      setLoadingMessage(`Failed to create KG:\n${err?.message ?? err}`);
      setTimeout(() => setIsCreatingKG(false), 2500);
    }
  };

  const handleUploadKG = async (files: FileList) => {
    setLoadingMessage('Uploading Knowledge Graph...');
    setIsCreatingKG(true);
    try {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        if (!file.name.endsWith('.json')) {
          setLoadingMessage(`Skipping ${file.name}: only JSON files are supported`);
          await new Promise(res => setTimeout(res, 1500));
          continue;
        }

        const text = await file.text();
        const data = JSON.parse(text);

        setLoadingMessage(`Uploading ${file.name}...`);
        const res = await fetch(`${API_BASE}/api/kg`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Backend error ${res.status}: ${await res.text()}`);
        setLoadingMessage(`KG created from ${file.name}`);
        await new Promise(res => setTimeout(res, 1200));
      }

      setLoadingMessage(`Successfully created KG from ${fileArray.length} file(s)`);
      setTimeout(() => setIsCreatingKG(false), 2000);
    } catch (err: any) {
      setLoadingMessage(`Failed to upload KG:\n${err?.message ?? err}`);
      setTimeout(() => setIsCreatingKG(false), 2500);
    }
  };

  const handleOpenGraphvizEditor = () => {
    const dot = (() => {
      if (!diagramRef.current) return '';
      const data = JSON.parse(diagramRef.current.model.toJson());
      return modelToDOT(data, { graphLabel: 'Boxology' });
    })();
    if (!dot) {
      alert('No DOT available.');
      return;
    }
    openInGraphviz(dot, 'dot');
  };

  const handleOpenKGViewer = () => {
    try {
      const { exportData } = buildKgExportData();
      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(`/src/components/kg_viewer.html?blob=${encodeURIComponent(url)}`, '_blank');
    } catch (error: any) {
      alert(error?.message || 'No Knowledge Graph is available to view. Create the KG first.');
    }
  };

  return (
    <div className="app" style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Toolbar
        diagram={diagramRef.current}
        onOpen={() => handleFileOperation('open')}
        onSave={() => handleFileOperation('save')}
        onUndo={() => handleDiagramOperation('undo')}
        onRedo={() => handleDiagramOperation('redo')}
        onAbout={handleAbout}
        onShowInstructions={handleShowInstructions}
        onValidate={() => handleDiagramOperation('validate')}
        onExportPNG={() => handleExport('png')}
        onExportJPG={() => handleExport('jpg')}
        onExportJSON={() => handleExport('json')}
        onExportDOT={() => handleExport('dot')}
        onOpenGraphviz={handleOpenGraphvizEditor}
        onCreateKG={handleCreateKG}
        onUploadKG={handleUploadKG}
        onOpenKGViewer={handleOpenKGViewer}
        kgJson={kgJson} // <-- Pass the KG JSON to the Toolbar
      />

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '10px',
        borderBottom: '1px solid #ddd',
        backgroundColor: '#f8f9fa',
        alignItems: 'center'
      }}>
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => handlePageSwitch(page.id)}
            onDoubleClick={(e) => { e.stopPropagation(); handleRenamePage(page.id); }}
            title='Double Click to Rename It'
            style={{
              backgroundColor: page.id === currentPageId ? '#E3E3E3' : '#e0e0e0',
              color: page.id === currentPageId ? '#110969ff' : '#000',
              border: '1px solid #b6b3b3ff',
              boxShadow: page.id === currentPageId ? '0 2px 6px rgba(0,0,0,0.2)' : 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: page.id === currentPageId ? '600' : '400',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '100px',
              maxWidth: '200px'
            }}
          >
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }}>
              {page.name}
            </span>
            {pages.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleClosePage(page.id);
                }}
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  padding: '0 4px',
                  borderRadius: '2px',
                  opacity: 0.7,
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.opacity = '1'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.opacity = '0.7'}
              >
                ×
              </span>
            )}
          </button>
        ))}
        
        {/* Replace the Add Page button with a Home Page button */}
        <button
          onClick={() => { window.location.href = '/home/index.html'; }}
          style={{
            backgroundColor: '#E3E3E3',
            color: '#000',
            border: '1px solid #b6b3b3ff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            marginLeft: 'auto',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#bedaeeff'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#E3E3E3'}
          title="Go to Home Page"
        >
          Home Page
        </button>
      </div>

      {/* Main Content */}
      <div className="main" style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0, height: '100%', width: '100%' }}>
        {/* 🎯 COLLAPSIBLE LEFT SIDEBAR */}
        <div
          className="sidebar sidebar--left"
          style={{
            width: LEFT_W,
            minWidth: leftCollapsed ? 44 : 180,
            maxWidth: leftCollapsed ? 44 : 400,
            background: '#f9f9f9',
            borderRight: '1px solid #ddd',
            height: '100%',
            overflow: 'hidden',           // important to hide content when collapsing
            position: 'relative',
            boxShadow: '0 0 5px rgba(0,0,0,0.1)',
            transition: 'width 180ms ease' // smooth animation
          }}
        >
          {/* Collapse toggle button */}
          <button
            aria-label={leftCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
            title={leftCollapsed ? 'Expand Shapes Panel (Ctrl+Alt+[)' : 'Collapse Shapes Panel (Ctrl+Alt+['}
            onClick={() => setLeftCollapsed(v => !v)}
            className="collapse-btn collapse-btn--right"
          >
            {leftCollapsed ? '›' : '‹'}
          </button>

          {/* Rail label when collapsed */}
          {leftCollapsed ? (
            <div className="sidebar-rail">
              <div className="rail-title">Shapes</div>
              <div className="rail-icons">
                <div 
                  className="rail-icon" 
                  title="Click to expand"
                  onClick={() => setLeftCollapsed(false)}
                >
                  <span role="img" aria-label="expand">🔲</span>
                </div>
                <div 
                  className="rail-icon" 
                  title="Click to expand"
                  onClick={() => setLeftCollapsed(false)}
                >
                  <span role="img" aria-label="expand">📁</span>
                </div>
              </div>
            </div>
          ) : (
            <LeftSidebar
              containers={containers}
              customContainerShapes={customContainerShapes}
              onAddContainer={handleAddContainer}
            />
          )}
        </div>

        {/* Diagram Area */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', height: '100%', display: 'flex' }}>
          <GoDiagram
            diagramRef={diagramRef}
            setSelectedData={setSelectedData}
            setContextMenu={setContextMenu}
            containers={containers}
            customGroups={customGroups}
          />
          <ContextMenu 
            contextMenu={contextMenu}
            onAction={handleContextMenuAction}
            selectedData={selectedData}
          />
        </div>

        {/* 🎯 COLLAPSIBLE RIGHT SIDEBAR */}
        <div
          className="sidebar sidebar--right"
          style={{
            width: RIGHT_W,
            minWidth: rightCollapsed ? 44 : 200,
            maxWidth: rightCollapsed ? 44 : 340,
            background: '#f9f9f9',
            borderLeft: '1px solid #ddd',
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
            transition: 'width 180ms ease'
          }}
        >
          {/* Collapse toggle button */}
          <button
            aria-label={rightCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}
            title={rightCollapsed ? 'Expand Properties Panel (Ctrl+Alt+])' : 'Collapse Properties Panel (Ctrl+Alt+])'}
            onClick={() => setRightCollapsed(v => !v)}
            className="collapse-btn collapse-btn--left"
          >
            {rightCollapsed ? '‹' : '›'}
          </button>

          {rightCollapsed ? (
            <div className="sidebar-rail">
              <div className="rail-title">Props</div>
              <div className="rail-icons">
                <div 
                  className="rail-icon" 
                  title="Click to expand"
                  onClick={() => setRightCollapsed(false)}
                >
                  ⚙️
                </div>
              </div>
            </div>
          ) : (
            <RightSidebar
              selectedData={selectedData}
              diagramRef={diagramRef}
              pages={pages}
              currentPageId={currentPageId}
              setPages={setPages}
              setCurrentPageId={setCurrentPageId}
            />
          )}
        </div>
        
      </div>

      {/* About modal */}
      {showAbout && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setShowAbout(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '25px',
                paddingBottom: '15px',
                borderBottom: '2px solid #e3f2fd'
              }}
            >
              <h2 style={{ 
                margin: 0, 
                color: '#1976d2', 
                fontSize: '24px',
                fontWeight: '600'
              }}>
                About Tool4Boxology
              </h2>
              <button
                onClick={() => setShowAbout(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '5px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ lineHeight: '1.6', color: '#333' }}>
              {/* Development Status Notice */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  backgroundColor: '#fff3cd',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid #ffeaa7',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#856404' }}>
                      Active Development Notice
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
                      This interface is under <strong>active development</strong>. New features and visual enhancements are being added frequently. 
                      Check our GitHub repository regularly for the latest updates and improvements.
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Description */}
              <div style={{ marginBottom: '25px' }}>
                <div style={{
                  backgroundColor: '#e3f2fd',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  border: '1px solid #bbdefb'
                }}>
                  <h3 style={{ 
                    margin: '0 0 15px 0', 
                    color: '#1976d2',
                    fontSize: '18px'
                  }}>
                    🤖 Hybrid AI System Design Tool
                  </h3>
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    This web application assists you in creating <strong>Hybrid AI systems</strong> and 
                    validates them against established design patterns. Design, visualize, and validate 
                    your AI architecture with confidence.
                  </p>
                </div>
              </div>

              {/* GitHub Section - Updated with development notice */}
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ 
                  color: '#1976d2', 
                  margin: '0 0 10px 0',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📚 Documentation & Latest Updates
                </h4>
                <p style={{ margin: '0 0 10px 0' }}>
                  For detailed documentation, installation guides, source code, and <strong>the latest updates</strong>:
                </p>
                <a
                  href="https://github.com/SDM-TIB/Tool4Boxology.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#333',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: '500',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#555';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#333';
                  }}
                >
                  🔗 Visit GitHub Repository
                </a>
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '12px', 
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  💡 Tip: Star the repository to get notified about new releases!
                </div>
              </div>

              {/* Contact Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ 
                  color: '#1976d2', 
                  margin: '0 0 15px 0',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  💬 Need Help or Have Suggestions?
                </h4>
                <p style={{ margin: '0 0 15px 0' }}>
                  If you need assistance or have recommendations for improvements, 
                  feel free to reach out:
                </p>
                
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#666', 
                      marginBottom: '5px' 
                    }}>
                      Contact Email:
                    </div>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '500',
                      color: '#333',
                      fontFamily: 'Monaco, Consolas, monospace'
                    }}>
                      mahsa.forghani.tehrani@stud.uni-hannover.de
                    </div>
                  </div>
                  <button
                    onClick={copyEmailToClipboard}
                    style={{
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.currentTarget.style.backgroundColor = '#45a049';
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.currentTarget.style.backgroundColor = '#4caf50';
                    }}
                    title="Copy email to clipboard"
                  >
                    📋 Copy Email
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                borderTop: '1px solid #eee',
                paddingTop: '20px',
                textAlign: 'center',
                color: '#666',
                fontSize: '12px'
              }}>
                <p style={{ margin: 0 }}>
                  Developed at TIB - SDM GROUP • Powered by GoJS
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instruction Dialog */}
      <InstructionDialog
        open={showInstructions}
        onClose={handleCloseInstructions}
      />

      {isCreatingKG && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <LoadingBox message={loadingMessage} />
        </div>
      )}
    </div>
  );
}

export default App;
function modelToXML(data: { nodeDataArray: go.ObjectData[]; linkDataArray: go.ObjectData[]; }): string {
  // Simple XML serialization for demonstration; customize as needed
  const nodeXml = data.nodeDataArray.map(node =>
    `<node${Object.entries(node).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('')}/>`
  ).join('\n    ');
  const linkXml = data.linkDataArray.map(link =>
    `<link${Object.entries(link).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('')}/>`
  ).join('\n    ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<diagram>
  <nodes>
    ${nodeXml}
  </nodes>
  <links>
    ${linkXml}
  </links>
</diagram>`;
}

