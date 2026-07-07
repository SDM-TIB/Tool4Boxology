import React, { useState, useEffect, useContext } from 'react';
import * as go from 'gojs';
import ExCls from '../Examples/Pain-Cls-Example.json';
import ExSeg from '../Examples/MRI-seg-Example.json';
import InstructionDialog from './InstructionDialog';  
import WorkflowImg from '../assets/WorkFlow.png';

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
  setPages: (pages: any[]) => void;
  setCurrentPageId: (id: string) => void;
}

// Simplified color presets
const colorPresets = [
  '#ccffcc', '#b7eaff', '#f4ccf4', '#f8ce92', 
  '#fbf2a2', '#ff81f7', '#FFA07A', '#f067ac',
  '#F5F5DC', '#FFE4B5', '#FFB6C1', '#90EE90'
];

const strokePresets = [
  '#218721', '#1E5F8B', '#8B4F8B', '#000000',
  '#B8A600', '#4c003b', '#CD5C5C', '#C1307A',
  '#A9A9A9', '#FF8C00', '#DC143C', '#228B22'
];

function getButtonStyle(options?: {
  background?: string;
  color?: string;
  fontWeight?: number | string;
  textAlign?: string;
  marginBottom?: number;
}): React.CSSProperties {
  return {
    padding: '6px',
    background: options?.background ?? '#6c72d9',
    color: options?.color ?? '#eaf2faff',
    borderRadius: 6,
    border: '1px solid #eee',
    fontWeight: options?.fontWeight ?? 600,
    textAlign: options?.textAlign ?? ('center' as any),
    marginBottom: options?.marginBottom ?? 0,
    fontFamily: 'Segoe UI, Arial, sans-serif',
    fontSize: 14,
    cursor: 'pointer'
  };
}

export default function RightSidebar({ selectedData, diagramRef, setPages, setCurrentPageId }: RightSidebarProps) {
  const [localLabel, setLocalLabel] = useState('');
  const [localColor, setLocalColor] = useState('#ffffff');
  const [localStroke, setLocalStroke] = useState('#000000');
  const [localShape, setLocalShape] = useState('Rectangle');
  const [selectedCount, setSelectedCount] = useState(0);
  const [queryText, setQueryText] = useState('');
  const [showInstruction, setShowInstruction] = useState(false); // New state for instruction dialog

  const videoUrl = 'https://www.youtube.com/watch?v=yr8KNgPh-Vw'; 

  const queryExamples = [
    {
      id: 'q1',
      title: 'Find Output nodes',
      query: `PREFIX t4b: <http://tool4boxology.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT * WHERE {
  ?pattern t4b:hasOutput ?OutPut .
  ?OutPut rdfs:label ?OutputLabel .
}`
    },
    {
      id: 'q2',
      title: 'List Boxologies and Pattern Counts',
      query: `PREFIX t4b: <http://tool4boxology.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT (COUNT(DISTINCT ?pattern) AS ?PatternCount) ?boxology ?BoxologyLabel
WHERE {
  ?boxology a t4b:Boxology ;
            rdfs:label ?BoxologyLabel ;
            t4b:hasPattern ?pattern.
}`
    }
  ];

  // Check how many objects are selected
  useEffect(() => {
    if (diagramRef.current) {
      const diagram = diagramRef.current;
      setSelectedCount(diagram.selection.count);
      
      const handleSelectionChanged = () => {
        setSelectedCount(diagram.selection.count);
      };
      
      diagram.addDiagramListener('ChangedSelection', handleSelectionChanged);
      
      return () => {
        diagram.removeDiagramListener('ChangedSelection', handleSelectionChanged);
      };
    }
  }, [diagramRef]);

  // Sync local state when selectedData changes
  useEffect(() => {
    if (selectedData && selectedCount === 1) {
      setLocalLabel(selectedData.label || '');
      setLocalColor(selectedData.color || '#ffffff');
      setLocalStroke(selectedData.stroke || '#000000');
      setLocalShape(selectedData.shape || 'Rectangle');
    }
  }, [selectedData, selectedCount]);

  // Helper: load example JSON into diagram
  const loadExample = (example: any) => {
    if (!diagramRef.current) return;
    try {
      const nodeDataArray = example.nodeDataArray || [];
      const linkDataArray = example.linkDataArray || [];
      const modelData = example.modelData || {};
      const boxologyId = modelData.boxologyId || modelData.id || `boxology_${Math.random().toString(36).slice(2, 10)}`;
      const boxologyLabel = modelData.boxologyLabel || modelData.label || 'Diagram';

      const newPage = {
        id: boxologyId,
        name: boxologyLabel,
        nodeDataArray,
        linkDataArray,
        boxologyId,
        boxologyLabel,
      };

      setPages([newPage]);
      setCurrentPageId(boxologyId);

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
    } catch (err) {
      console.error('Failed to load example', err);
    }
  };

  const openInstructionDialog = () => {
    window.open(WorkflowImg, '_blank');
  };
  const closeInstructionDialog = () => setShowInstruction(false);
  const openVideoLink = () => {
    window.open(videoUrl, '_blank');
  };

  const sendToQuerySection = async (q: string) => {
    setQueryText(q);
  };

  const sendQueryToVirtuoso = () => {
    // Replace with your Virtuoso endpoint and query parameter
    const endpoint = 'http://localhost:8890/sparql'; // Change to your Virtuoso endpoint
    const encodedQuery = encodeURIComponent(queryText);
    const url = `${endpoint}?query=${encodedQuery}&format=HTML`;
    window.open(url, '_blank');
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

  const handleLabelChange = (label: string) => {
    setLocalLabel(label);
    handleSidebarChange('label', label);
  };

  const handleColorChange = (color: string) => {
    setLocalColor(color);
    handleSidebarChange('color', color);
  };

  const handleStrokeChange = (stroke: string) => {
    setLocalStroke(stroke);
    handleSidebarChange('stroke', stroke);
  };

  const handleShapeChange = (shape: string) => {
    setLocalShape(shape);
    handleSidebarChange('shape', shape);
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
      <div style={{ marginBottom: 12, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #eee',minWidth: 260 }}>
        <strong style={{ display: 'block', marginBottom: 6, fontWeight: '600', fontSize: '14px',color: '#1b1b1bff' }}>How to use Tool4Boxology</strong>
        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <button onClick={openInstructionDialog} style={getButtonStyle()}>Diagraming</button>
          <button onClick={openVideoLink} style={getButtonStyle()}>Tutorial Video</button>
        </div>
        <strong style={{ display: 'block', marginBottom: 6, fontWeight: '600', fontSize: '14px',color: '#1b1b1bff' }}>Boxology example</strong>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button onClick={() => loadExample(ExCls)} style={getButtonStyle()}>Pain Classification</button>
          <button onClick={() => loadExample(ExSeg)} style={getButtonStyle()}>MRI Segmentation</button>
        </div>
        <strong style={{ display: 'block', marginBottom: 6, fontWeight: '600', fontSize: '14px',color: '#1b1b1bff' }}>Query example</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queryExamples.map(q => (
            <button
              key={q.id}
              onClick={() => sendToQuerySection(q.query)}
              style={getButtonStyle({ textAlign: 'left', marginBottom: 4 })}
            >
              {q.title}
            </button>
          ))}
        </div>

        {/* New: SPARQL Query section */}
        <strong style={{ display: 'block', marginBottom: 6, fontWeight: '600', fontSize: '14px',color: '#1b1b1bff' }}>SPARQL Query</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            placeholder="Write your SPARQL query here..."
            style={{
              width: '90%',
              minHeight: 200,
              fontSize: 13,
              padding: 6,
              border: '1px solid #ccc',
              borderRadius: 4,
              resize: 'vertical'
            }}
            onKeyDown={e => {
              if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                const target = e.target as HTMLTextAreaElement;
                target.select();
              }
            }}
          />
          <button
            onClick={sendQueryToVirtuoso}
            style={getButtonStyle()}
          >
            Run Query!
          </button>
        </div>
      </div>
      {!selectedData ? (
        <p style={{ color: '#666', fontSize: '13px' }}>Select an object to edit properties</p>
      ) : (
        <>
          {/* REMOVE THIS ENTIRE LABEL SECTION */}
          {/* 
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: 4, color: '#555' }}>
              Label:
            </label>
            <input
              type="text"
              value={localLabel}
              onChange={(e) => {
                setLocalLabel(e.target.value);
                handleSidebarChange('label', e.target.value);
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            />
          </div>
          */}

          {/* Keep the rest: Color section */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: 8, color: '#555' }}>
              Fill Color:
            </label>
            {/* Color presets */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 4,
              marginBottom: 8
            }}>
              {colorPresets.map((color, index) => (
                <div
                  key={index}
                  onClick={() => handleColorChange(color)}
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: color,
                    border: localColor === color ? '2px solid #000' : '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
            {/* Custom color input */}
            <input
              type="color"
              value={localColor}
              onChange={(e) => handleColorChange(e.target.value)}
              style={{ 
                width: '100%', 
                height: '32px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Keep: Stroke Color section */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: 8, color: '#555' }}>
              Stroke Color:
            </label>
            {/* Stroke presets */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 4,
              marginBottom: 8
            }}>
              {strokePresets.map((stroke, index) => (
                <div
                  key={index}
                  onClick={() => handleStrokeChange(stroke)}
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: stroke,
                    border: localStroke === stroke ? '2px solid #fff' : '1px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: localStroke === stroke ? '0 0 0 1px #000' : 'none'
                  }}
                />
              ))}
            </div>
            {/* Custom stroke input */}
            <input
              type="color"
              value={localStroke}
              onChange={(e) => handleStrokeChange(e.target.value)}
              style={{ 
                width: '100%', 
                height: '32px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            />
          </div>
        </>
      )}
      <InstructionDialog open={showInstruction} onClose={() => setShowInstruction(false)} />
    </div>
  );
}