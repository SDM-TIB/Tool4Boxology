import React, { useState } from 'react';
import * as go from 'gojs';
// Add MUI imports for alignment buttons
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalRightIcon from '@mui/icons-material/AlignHorizontalRight';
import AlignVerticalBottomIcon from '@mui/icons-material/AlignVerticalBottom';
import AlignVerticalCenterIcon from '@mui/icons-material/AlignVerticalCenter';
import AlignVerticalTopIcon from '@mui/icons-material/AlignVerticalTop';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import Grid3x3Icon from '@mui/icons-material/Grid3x3';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Define ToolbarProps type
type ToolbarProps = {
  diagram?: go.Diagram | null;
  onOpen: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAbout: () => void;
  onShowInstructions: () => void;          // <-- added
  onValidate: () => void;
  //onExportSVG: () => void;
  onExportPNG: () => void;
  onExportJPG: () => void;
  //onExportXML: () => void;
  onExportJSON: () => void;
  //onExportDrawio: () => void;
  onExportDOT: () => void;
  onOpenGraphviz: () => void;
  onCreateKG?: () => void;
  onUploadKG?: (files: FileList) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  diagram,
  onOpen,
  onSave,
  onUndo,
  onRedo,
  onAbout,
  onShowInstructions,          // <-- added
  onValidate,
  //onExportSVG,
  onExportPNG,
  onExportJPG,
  //onExportXML,
  onExportJSON,
  //onExportDrawio,
  onExportDOT,
  onOpenGraphviz,
  onCreateKG,
  onUploadKG
}) => {
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [showHelpMenu, setShowHelpMenu] = React.useState(false);  // <-- added
  const [showAlignOrganize, setShowAlignOrganize] = useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);
  const helpMenuRef = React.useRef<HTMLDivElement>(null);         // <-- added
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Close export menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target as Node)) {
        setShowHelpMenu(false);
      }
    };

    if (showExportMenu || showHelpMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu, showHelpMenu]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onUploadKG) {
      onUploadKG(files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Simple small button style for existing buttons
  const simpleButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    margin: '2px',
    border: '1px solid #110969ff',
    backgroundColor: '#f8f8f8',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'normal',
    color: '#333',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // MUI icon button style for alignment tools
  const iconButtonStyle: React.CSSProperties = {
    padding: '4px',
    border: '1px solid #ccc',
    backgroundColor: '#fff',
    borderRadius: 3,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '28px',
    minWidth: '28px',
    color: '#555',
    margin: '1px',
  };

  const iconButtonHoverStyle = {
    backgroundColor: '#f0f0f0',
    borderColor: '#999',
  };

  // Grid Snap functions
  const toggleGridLock = () => {
    if (!diagram) return;

    const isEnabled = diagram.toolManager.draggingTool.isGridSnapEnabled;
    diagram.toolManager.draggingTool.isGridSnapEnabled = !isEnabled;
    diagram.toolManager.resizingTool.isGridSnapEnabled = !isEnabled;

    const toggleBtn = document.getElementById('gridToggle');
    if (toggleBtn) {
      if (isEnabled) {
        toggleBtn.style.backgroundColor = '#fff';
        toggleBtn.style.borderColor = '#555';
        toggleBtn.style.color = '#555';
      } else {
        toggleBtn.style.backgroundColor = '#e3f2fd';
        toggleBtn.style.borderColor = '#1976d2';
        toggleBtn.style.color = '#1976d2';
      }
    }
  };

  // Alignment functions
  const alignNodes = (alignment: string) => {
    if (!diagram) return;
    
    const selectedNodes = diagram.selection.filter(part => part instanceof go.Node);
    
    if (selectedNodes.count < 2) {
      alert('Please select at least 2 nodes to align');
      return;
    }

    diagram.startTransaction('align nodes');
    
    try {
      const nodes = selectedNodes.toArray() as go.Node[];
      const bounds = nodes.map(node => node.actualBounds);
      
      switch (alignment) {
        case 'left':
          const leftX = Math.min(...bounds.map(b => b.x));
          nodes.forEach(node => node.move(new go.Point(leftX, node.position.y)));
          break;
          
        case 'right':
          const rightX = Math.max(...bounds.map(b => b.right));
          nodes.forEach(node => node.move(new go.Point(rightX - node.actualBounds.width, node.position.y)));
          break;
          
        case 'top':
          const topY = Math.min(...bounds.map(b => b.y));
          nodes.forEach(node => node.move(new go.Point(node.position.x, topY)));
          break;
          
        case 'bottom':
          const bottomY = Math.max(...bounds.map(b => b.bottom));
          nodes.forEach(node => node.move(new go.Point(node.position.x, bottomY - node.actualBounds.height)));
          break;
          
        case 'centerH':
          const centerY = bounds.reduce((sum, b) => sum + b.centerY, 0) / bounds.length;
          nodes.forEach(node => node.move(new go.Point(node.position.x, centerY - node.actualBounds.height / 2)));
          break;
          
        case 'centerV':
          const centerX = bounds.reduce((sum, b) => sum + b.centerX, 0) / bounds.length;
          nodes.forEach(node => node.move(new go.Point(centerX - node.actualBounds.width / 2, node.position.y)));
          break;
      }
    } catch (error) {
      console.error('Error aligning nodes:', error);
    }
    
    diagram.commitTransaction('align nodes');
  };

  const distributeNodes = (direction: 'horizontal' | 'vertical') => {
    if (!diagram) return;
    
    const selectedNodes = diagram.selection.filter(part => part instanceof go.Node);
    
    if (selectedNodes.count < 3) {
      alert('Please select at least 3 nodes to distribute');
      return;
    }

    diagram.startTransaction('distribute nodes');
    
    try {
      const nodes = selectedNodes.toArray() as go.Node[];
      
      if (direction === 'horizontal') {
        nodes.sort((a, b) => a.position.x - b.position.x);
        const first = nodes[0].position.x;
        const last = nodes[nodes.length - 1].position.x;
        const gap = (last - first) / (nodes.length - 1);
        
        nodes.forEach((node, index) => {
          node.move(new go.Point(first + gap * index, node.position.y));
        });
      } else {
        nodes.sort((a, b) => a.position.y - b.position.y);
        const first = nodes[0].position.y;
        const last = nodes[nodes.length - 1].position.y;
        const gap = (last - first) / (nodes.length - 1);
        
        nodes.forEach((node, index) => {
          node.move(new go.Point(node.position.x, first + gap * index));
        });
      }
    } catch (error) {
      console.error('Error distributing nodes:', error);
    }
    
    diagram.commitTransaction('distribute nodes');
  };

  const organizeHorizontally = () => {
    if (!diagram) return;
    
    const selectedNodes = diagram.selection.filter(part => part instanceof go.Node);
    
    if (selectedNodes.count < 2) {
      alert('Please select at least 2 nodes to organize horizontally');
      return;
    }

    diagram.startTransaction('organize horizontally');
    
    try {
      const nodes = selectedNodes.toArray() as go.Node[];
      nodes.sort((a, b) => a.position.x - b.position.x);
      
      let currentX = nodes[0].position.x;
      const baseY = nodes[0].position.y;
      
      nodes.forEach((node, index) => {
        node.move(new go.Point(currentX, baseY));
        if (index < nodes.length - 1) {
          currentX += node.actualBounds.width + 40;
        }
      });
    } catch (error) {
      console.error('Error organizing nodes horizontally:', error);
    }
    
    diagram.commitTransaction('organize horizontally');
  };

  const organizeVertically = () => {
    if (!diagram) return;
    
    const selectedNodes = diagram.selection.filter(part => part instanceof go.Node);
    
    if (selectedNodes.count < 2) {
      alert('Please select at least 2 nodes to organize vertically');
      return;
    }

    diagram.startTransaction('organize vertically');
    
    try {
      const nodes = selectedNodes.toArray() as go.Node[];
      nodes.sort((a, b) => a.position.y - b.position.y);
      
      const baseX = nodes[0].position.x;
      let currentY = nodes[0].position.y;
      
      nodes.forEach((node, index) => {
        node.move(new go.Point(baseX, currentY));
        if (index < nodes.length - 1) {
          currentY += node.actualBounds.height + 40;
        }
      });
    } catch (error) {
      console.error('Error organizing nodes vertically:', error);
    }
    
    diagram.commitTransaction('organize vertically');
  };


  const openSparqlEditor = () => {
    const query = `PREFIX t4b: <http://tool4boxology.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?boxology ?label
WHERE {
  ?boxology a t4b:Boxology ;
            rdfs:label ?label .
}
LIMIT 100`;
    navigator.clipboard?.writeText(query).catch(()=>{});
    alert('An example SPARQL query copied to clipboard. Paste it into Virtuoso.');
    window.open('http://localhost:8890/sparql', '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 8px',
      backgroundColor: '#f5f5f5',
      borderBottom: '1px solid #ddd',
      flexWrap: 'wrap',
      minHeight: '36px'
    }}>
      {/* HELP dropdown (replaces direct About button) */}
      <div ref={helpMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => {
            setShowHelpMenu(!showHelpMenu);
            setShowExportMenu(false);
          }}
          style={simpleButtonStyle}
          title="Help menu"
        >
          ❓ Help {showHelpMenu ? '▲' : '▼'}
        </button>
        {showHelpMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1200,
            backgroundColor: '#fff',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '190px',
            padding: '6px 0',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => {
                setShowHelpMenu(false);
                onAbout();
              }}
              style={helpItemStyle}
              onMouseOver={hoverOn}
              onMouseOut={hoverOff}
            >
              ℹ️ About
            </button>
            <button
              onClick={() => {
                setShowHelpMenu(false);
                onShowInstructions();
              }}
              style={helpItemStyle}
              onMouseOver={hoverOn}
              onMouseOut={hoverOff}
            >
              📘 How To Use?
            </button>
          </div>
        )}
      </div>

      {/* Open / Save */}
      <button onClick={onOpen} style={simpleButtonStyle}>📁 Open</button>
      <button onClick={onSave} style={simpleButtonStyle}>💾 Save</button>

      {/* Export Dropdown (unchanged) */}
      <div ref={exportMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => {
            setShowExportMenu(!showExportMenu);
            setShowHelpMenu(false);
          }}
          style={{
            ...simpleButtonStyle,
            backgroundColor: showExportMenu ? '#e9ecef' : 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          📤 Export {showExportMenu ? '▲' : '▼'}
        </button>
        {showExportMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1100,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '160px',
            padding: '4px 0'
          }}>
            <button
              onClick={() => {
                onExportJSON();
                setShowExportMenu(false);
              }}
              style={exportItemStyle}
              onMouseOver={hoverOn}
              onMouseOut={hoverOff}
            >
              📄 JSON
            </button>

            <button
              onClick={() => {
                onExportDOT();        // NEW
                setShowExportMenu(false);
              }}
              style={exportItemStyle}
              onMouseOver={hoverOn}
              onMouseOut={hoverOff}
            >
              🟦 Graphviz DOT
            </button>

            <button
              onClick={() => {
                onExportPNG();
                setShowExportMenu(false);
              }}
              style={exportItemStyle}
              onMouseOver={hoverOn}
              onMouseOut={hoverOff}
            >
              🗂️ PNG
            </button>
            
            <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
          </div>
        )}
      </div>
      
      {/* NEW: Open in Graphviz (Visual Editor) */}
      <button
        onClick={onOpenGraphviz}
        style={simpleButtonStyle}
        title="Open DOT in Graphviz Visual Editor"
      >
        🟦 Graphviz
      </button>

      <div style={{ width: '1px', height: '20px', background: '#ccc', margin: '0 4px' }} />

      <button onClick={onUndo} style={simpleButtonStyle}>🔄 Undo</button>
      <button onClick={onRedo} style={simpleButtonStyle}>🔃 Redo</button>
      <button
        onClick={onValidate}
        style= {{
          ...simpleButtonStyle,
          backgroundColor: '#060771',
          color: 'white',
          borderColor: '#060771'
        }}
        title="Validate selected pattern or entire diagram"
      >
        Check Validation!
      </button>
      
      {onCreateKG && (
        <button
          onClick={onCreateKG}
          style={{
            ...simpleButtonStyle,
            backgroundColor: '#BF124D',
            color: 'white',
            borderColor: '#BF124D'
          }}
          title="Create Knowledge Graph in Virtuoso from current pages"
        >
          🔗 Create KG
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Upload KG button */}
      {onUploadKG && (
        <button
          onClick={() => fileInputRef.current?.click()}
          style={simpleButtonStyle}
          title="Upload JSON files to create Knowledge Graph"
        >
          📤 Upload File to KG
        </button>
      )}

      {/* Simple button to open Virtuoso SPARQL endpoint */}
      <button
        onClick={openSparqlEditor}
        style={simpleButtonStyle}
        title="Open SPARQL editor (query copied to clipboard)"
      >
        🔍 SPARQL
      </button>
      

      {/* Separator */}
      <div style={{ width: '1px', height: '20px', backgroundColor: '#ccc', margin: '0 4px' }} />
      
      {/* Grid Snap */}
      <button id="gridToggle" onClick={() => toggleGridLock()} style={{ ...iconButtonStyle, backgroundColor: '#e3f2fd', borderColor: '#1976d2', color: '#1976d2' }} title="Toggle Grid"><Grid3x3Icon fontSize="small" /></button>

      {/* Collapsible Alignment & Organization Section */}
      <button
        onClick={() => setShowAlignOrganize(prev => !prev)}
        style={{
          ...simpleButtonStyle,
          backgroundColor: showAlignOrganize ? '#e3f2fd' : '#f8f8f8',
          fontWeight: 'bold'
        }}
        title="Show/hide alignment and organization tools"
      >
        {showAlignOrganize ? '▼' : '▶'} Arrange Nodes
      </button>

      {showAlignOrganize && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#f9f9f9',
          borderRadius: '6px',
          padding: '4px 8px',
          border: '1px solid #e0e0e0',
        }}>
          {/* Alignment Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#666', marginRight: '4px' }}>Align:</span>
            <button onClick={() => alignNodes('left')} style={iconButtonStyle} title="Align Left"><AlignHorizontalLeftIcon fontSize="small" /></button>
            <button onClick={() => alignNodes('centerV')} style={iconButtonStyle} title="Align Center Vertically"><AlignHorizontalCenterIcon fontSize="small" /></button>
            <button onClick={() => alignNodes('right')} style={iconButtonStyle} title="Align Right"><AlignHorizontalRightIcon fontSize="small" /></button>
            <button onClick={() => alignNodes('top')} style={iconButtonStyle} title="Align Top"><AlignVerticalTopIcon fontSize="small" /></button>
            <button onClick={() => alignNodes('centerH')} style={iconButtonStyle} title="Align Center Horizontally"><AlignVerticalCenterIcon fontSize="small" /></button>
            <button onClick={() => alignNodes('bottom')} style={iconButtonStyle} title="Align Bottom"><AlignVerticalBottomIcon fontSize="small" /></button>
          </div>
          {/* Distribution Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#666', marginRight: '4px' }}>Distribute:</span>
            <button onClick={() => distributeNodes('horizontal')} style={iconButtonStyle} title="Distribute Horizontal"><AlignHorizontalCenterIcon fontSize="small" /><span style={{ fontSize: '8px', marginLeft: '2px' }}>⟷</span></button>
            <button onClick={() => distributeNodes('vertical')} style={iconButtonStyle} title="Distribute Vertical"><AlignVerticalCenterIcon fontSize="small" /><span style={{ fontSize: '8px', marginLeft: '2px' }}>⟱</span></button>
          </div>
          {/* Organize Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#666', marginRight: '4px' }}>Organize:</span>
            <button onClick={organizeHorizontally} style={{ ...iconButtonStyle, backgroundColor: '#e3f2fd', borderColor: '#1976d2', color: '#1976d2' }} title="Organize Horizontally"><ViewColumnIcon fontSize="small" /></button>
            <button onClick={organizeVertically} style={{ ...iconButtonStyle, backgroundColor: '#e3f2fd', borderColor: '#1976d2', color: '#1976d2' }} title="Organize Vertically"><ViewStreamIcon fontSize="small" /></button>
          </div>
        </div>
      )}

      {/* ...other toolbar buttons... */}
    </div>
  );
};

// Shared styles

const exportItemStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 14px',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  fontSize: '13px',
  color: '#333',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 0.2s',
};

const helpItemStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 14px',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  fontSize: '13px',
  color: '#333',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 0.2s',
};

const hoverOn = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = '#f5f7fa';
};
const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = 'transparent';
};

// Shared button style function for Toolbar
export function getToolbarButtonStyle(options?: {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  fontWeight?: number | string;
  fontSize?: number | string;
  padding?: string;
  margin?: string;
  borderRadius?: string | number;
  height?: string | number;
}): React.CSSProperties {
  return {
    padding: options?.padding ?? '4px 8px',
    margin: options?.margin ?? '2px',
    border: `1px solid ${options?.borderColor ?? '#110969ff'}`,
    backgroundColor: options?.backgroundColor ?? '#f8f8f8',
    borderRadius: options?.borderRadius ?? '3px',
    cursor: 'pointer',
    fontSize: options?.fontSize ?? '13px',
    fontWeight: options?.fontWeight ?? 'normal',
    color: options?.color ?? '#333',
    height: options?.height ?? '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

// Example usage:
// <button style={getToolbarButtonStyle({ backgroundColor: '#060771', color: 'white', borderColor: '#060771', fontWeight: 'bold' })}>Check Validation!</button>

export default Toolbar;

