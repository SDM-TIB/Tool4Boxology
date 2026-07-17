import React, { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import * as go from 'gojs';
import { setupDiagramValidation, validateGoJSDiagram } from './plugin/GoJSBoxologyValidation';
import { mapShapeToGoJSFigure } from './utils/shapeMapping';
import { shapeTypesTree , shapes } from './data/shape';

interface ContextMenuPosition {
  x: number;
  y: number;

}

interface GoDiagramProps {
  diagramRef: React.RefObject<go.Diagram | null>;
  setSelectedData: Dispatch<SetStateAction<any>>;
  setContextMenu: Dispatch<SetStateAction<ContextMenuPosition | null>>;
  containers: string[];
  customGroups: Record<string, any[]>;
}

const getRoundedRectParameter = (nodeName: string) => {
  const shapeDef = shapes.find((s) => s.name.toLowerCase() === nodeName.toLowerCase());
  if (!shapeDef?.borderRadius) return 15;
  const parsed = parseFloat(shapeDef.borderRadius);
  return Number.isFinite(parsed) ? parsed : 15;
};

// Helper: Recursively build menu
function buildTypeMenu(
  diagram: go.Diagram,
  node: go.Node,
  typeTree: Record<string, any> | null,
  container: HTMLElement,
  level: number = 0
) {
  if (!typeTree) return;
  Object.entries(typeTree).forEach(([type, subTree]) => {
    const option = document.createElement("div");
    option.textContent = type;
    option.style.padding = "8px 12px";
    option.style.cursor = "pointer";
    option.style.fontSize = "12px";
    option.style.color = "black";
    option.style.marginLeft = `${level * 16}px`;
    option.style.position = "relative";
    option.style.background = type === node.data.type ? "#e0f2fe" : "white";
    option.style.fontWeight = type === node.data.type ? "600" : "normal";

    // If has subtypes, show arrow and submenu
    if (subTree && Object.keys(subTree).length > 0) {
      const arrow = document.createElement("span");
      arrow.textContent = "▶";
      arrow.style.float = "right";
      arrow.style.fontSize = "10px";
      option.appendChild(arrow);

      let submenu: HTMLElement | null = null;
      option.onmouseenter = () => {
        if (!submenu) {
          submenu = document.createElement("div");
          submenu.style.position = "absolute";
          submenu.style.left = "100%";
          submenu.style.top = "0";
          submenu.style.background = "white";
          submenu.style.border = "1px solid #d1d5db";
          submenu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
          submenu.style.minWidth = "120px";
          submenu.style.zIndex = "10001";
          buildTypeMenu(diagram, node, subTree, submenu, level + 1);
          option.appendChild(submenu);
        }
        if (submenu) submenu.style.display = "block";
      };
      option.onmouseleave = () => {
        if (submenu) submenu.style.display = "none";
      };
    }

    // Click: set type and close all menus
    option.onclick = (event) => {
      event.stopPropagation();
      diagram.model.startTransaction("change type");
      diagram.model.set(node.data, "type", type);
      diagram.model.commitTransaction("change type");
      let el: HTMLElement | null = container;
      while (el && el.parentElement) {
        el.remove();
        el = el.parentElement;
      }
    };

    container.appendChild(option);
  });
}

function showTypeSelector(e: go.InputEvent, node: go.Node) {
  const diagram = node.diagram;
  if (!diagram) return;

  // Use node.data.type or node.data.name to get the correct subtree
  const rootType = node.data.name; // or whatever property is your root type, e.g. "model"
  let typeTree: Record<string, any> | null = shapeTypesTree[rootType] || null;
  if (!typeTree) return; // fallback to full tree if not found

  // Positioning
  const diagramDiv = diagram.div;
  if (!diagramDiv) return;
  const diagramRect = diagramDiv.getBoundingClientRect();
  const viewPoint = diagram.transformDocToView(node.location);
  const screenX = diagramRect.left + viewPoint.x + window.scrollX;
  const screenY = diagramRect.top + viewPoint.y + window.scrollY - 40;

  // Main container
  const dropdownContainer = document.createElement("div");
  dropdownContainer.style.position = "absolute";
  dropdownContainer.style.left = screenX + "px";
  dropdownContainer.style.top = screenY + "px";
  dropdownContainer.style.zIndex = "10000";
  dropdownContainer.style.backgroundColor = "white";
  dropdownContainer.style.border = "1px solid #d1d5db";
  dropdownContainer.style.borderRadius = "4px";
  dropdownContainer.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
  dropdownContainer.style.minWidth = "120px";
  dropdownContainer.style.overflow = "visible";
  dropdownContainer.style.fontFamily = "system-ui, -apple-system, sans-serif";

  buildTypeMenu(diagram, node, typeTree, dropdownContainer);

  // Close on click outside or escape
  const closeHandler = (event: MouseEvent | KeyboardEvent) => {
    if (
      event instanceof MouseEvent &&
      !dropdownContainer.contains(event.target as Node)
    ) {
      dropdownContainer.remove();
      document.removeEventListener("click", closeHandler);
      document.removeEventListener("keydown", closeHandler);
    }
    if (
      event instanceof KeyboardEvent &&
      event.key === "Escape"
    ) {
      dropdownContainer.remove();
      document.removeEventListener("click", closeHandler);
      document.removeEventListener("keydown", closeHandler);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", closeHandler);
    document.addEventListener("keydown", closeHandler);
  }, 0);

  document.body.appendChild(dropdownContainer);
}

const GoDiagram: React.FC<GoDiagramProps> = ({
  diagramRef,
  setSelectedData,
  setContextMenu,
  containers,
  customGroups,
}) => {
  const diagramDivRef = useRef<HTMLDivElement>(null);

  const handleSidebarChange = (field: string, value: string) => {
    if (!diagramRef.current || !setSelectedData) return;

    const model = diagramRef.current.model;
    model.startTransaction('update');
    const selectedNode = diagramRef.current.selection.first();
    if (selectedNode instanceof go.Node) {
      const nodeData = selectedNode.data;
      model.setDataProperty(nodeData, field, value);
    }
    model.commitTransaction('update');
  };

  // REMOVED: Effect to update type badge visibility - badges are now always visible

  useEffect(() => {
    if (!diagramRef.current) return;
    
    const diagram = diagramRef.current;
    
    // Update all nodes to show/hide type badges
    diagram.nodes.each((node) => {
      const typeBadge = node.findObject('TYPE_BADGE');
      if (typeBadge) {
        typeBadge.visible = true;
      }
    });
    
  }, [diagramRef]);

  useEffect(() => {
    if (!diagramDivRef.current) return;
    const $ = go.GraphObject.make;

    if (diagramRef.current) {
      diagramRef.current.div = null;
      diagramRef.current.clear();
      diagramRef.current = null;
    }

    // Define custom figures for GoJS
    go.Shape.defineFigureGenerator("CustomHexagon", function(shape, w, h) {
      let param1 = shape ? shape.parameter1 : NaN;
      if (isNaN(param1)) param1 = 1;
      
      const geo = new go.Geometry();
      const fig = new go.PathFigure(0, h * 0.5, true);
      
      fig.add(new go.PathSegment(go.PathSegment.Line, w * 0.25, 0));
      fig.add(new go.PathSegment(go.PathSegment.Line, w * 0.75, 0));
      fig.add(new go.PathSegment(go.PathSegment.Line, w, h * 0.5));
      fig.add(new go.PathSegment(go.PathSegment.Line, w * 0.75, h));
      fig.add(new go.PathSegment(go.PathSegment.Line, w * 0.25, h));
      fig.add(new go.PathSegment(go.PathSegment.Line, 0, h * 0.5).close());
      
      geo.add(fig);
      return geo;
    });

    const diagram = $(go.Diagram, diagramDivRef.current, {
      'undoManager.isEnabled': true,
      allowDrop: true,
      padding: new go.Margin(40),               // << -- add space around content
      initialContentAlignment: go.Spot.TopLeft, // keep content origin at top-left
      'animationManager.isEnabled': false,  // 🔧 ADD: Disable animations
      grid: $(
        go.Panel,
        'Grid',
        { gridCellSize: new go.Size(20, 20) },
        $(go.Shape, 'LineH', { stroke: '#eee' }),
        $(go.Shape, 'LineV', { stroke: '#eee' })
      ),
    });

    diagram.commandHandler.archetypeGroupData = {
      isGroup: true,
      category: 'ClusterGroup',
      name: 'cluster',
      label: 'Cluster',
      color: '#e9ecef',
      stroke: '#adb5bd',
      strokeWidth: 1.5,
      parameter1: 6
    };

    // 🔧 ADD: Configure tools with custom cursors
    diagram.toolManager.draggingTool.isGridSnapEnabled = false;
    diagram.toolManager.draggingTool.delay = 0;
    
    // 🔧 ADD: Custom cursor for linking tool
    diagram.toolManager.linkingTool.isEnabled = true;
    // Removed invalid property: portTargetingTool.cursorHot
    
    diagram.toolManager.relinkingTool.isEnabled = true;

    // UPDATED: Node template - shape as port with cursor differentiation
    diagram.nodeTemplate = $(
      go.Node,
      'Spot',
      {
        locationSpot: go.Spot.Center,
        selectable: true,
        movable: true,
        resizable: true,
        resizeObjectName: 'SHAPE',
        // 🔧 REMOVED: cursor from node level - let shape handle it
        contextClick: (e, obj) => {
          const node = obj.part;
          if (node instanceof go.Node) {
            setSelectedData(node.data);
            const mouseEvent = e.event as MouseEvent;
            setContextMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY });
          }
        },
        // 🔧 ADD: Dynamic cursor based on mouse position
        mouseEnter: (e, obj) => {
          const node = obj as go.Node;
          node.cursor = 'move';  // Default to move
        },
        mouseDragEnter: (e, obj) => {
          const node = obj as go.Node;
          // Check if we're dragging from a port (starting a link)
          if (e.diagram?.currentTool.name === 'Linking') {
            node.cursor = 'pointer';
          } else {
            node.cursor = 'move';
          }
        }
      },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      $(
        go.Panel,
        'Auto',
        {
          name: 'BODY'
        },
        // 🔧 UPDATED: Main shape IS the port - no separate port areas needed
        $(
          go.Shape,
          {
            name: 'SHAPE',
            strokeWidth: 1,
            stroke: '#999',
            portId: '',  // Empty string = default port
            fromLinkable: true,
            toLinkable: true,
            fromSpot: go.Spot.AllSides,
            toSpot: go.Spot.AllSides,
            cursor: 'move',  // Default cursor
            minSize: new go.Size(100, 60),
            maxSize: new go.Size(300, 300),
            // 🔧 ADD: Mouse handlers to change cursor dynamically
            mouseEnter: (e, shape) => {
              const sh = shape as go.Shape;
              const diagram = sh.part?.diagram;
              if (!diagram) return;
              
              // Get mouse position relative to shape
              const shapeCenter = sh.getDocumentPoint(go.Spot.Center);
              const mousePoint = diagram.lastInput.documentPoint;
              const bounds = sh.actualBounds;
              
              // Calculate if mouse is near edge (within 15px of boundary)
              const distFromCenterX = Math.abs(mousePoint.x - shapeCenter.x);
              const distFromCenterY = Math.abs(mousePoint.y - shapeCenter.y);
              const isNearHorizontalEdge = distFromCenterX > (bounds.width / 2) - 15;
              const isNearVerticalEdge = distFromCenterY > (bounds.height / 2) - 15;
              
              if (isNearHorizontalEdge || isNearVerticalEdge) {
                sh.cursor = 'pointer';  // Near edge = link cursor
              } else {
                sh.cursor = 'move';     // Center = move cursor
              }
            },
            mouseLeave: (e, shape) => {
              (shape as go.Shape).cursor = 'move';
            }
          },
          new go.Binding('fill', 'color'),
          new go.Binding('stroke', 'stroke'),
          new go.Binding('strokeDashArray', 'isShared', (isShared) =>
            isShared ? [4, 3] : null
          ),
          new go.Binding('figure', 'shape', (shapeType) => {
            const figure = mapShapeToGoJSFigure(shapeType);
            return figure;
          }),
          new go.Binding('fromSpot', 'shape', (shapeType) =>
            shapeType === 'Triangle' || shapeType === 'TriangleDown' ? go.Spot.None : go.Spot.AllSides
          ),
          new go.Binding('toSpot', 'shape', (shapeType) =>
            shapeType === 'Triangle' || shapeType === 'TriangleDown' ? go.Spot.None : go.Spot.AllSides
          ),
          new go.Binding('width', 'width', (w) => typeof w === 'number' ? w : NaN).makeTwoWay(),
          new go.Binding('height', 'height', (h) => typeof h === 'number' ? h : NaN).makeTwoWay(),
          new go.Binding('strokeWidth', 'strokeWidth'),
          new go.Binding('parameter1', 'parameter1')
        ),
      
        // Label (centered) - UPDATED: Make editable
        $(
          go.TextBlock,
          {
            alignment: go.Spot.Center,
            margin: 8,
            font: 'bold 12px sans-serif',
            stroke: '#333',
            editable: true,
            textAlign: 'center',
            wrap: go.TextBlock.WrapFit,
            overflow: go.TextBlock.OverflowClip,
            maxSize: new go.Size(240, NaN),
            textEditor: null
          },
          new go.Binding('text', 'label').makeTwoWay()
        )
      ),
      
      // 🔧 REMOVED: All separate port lines (TOP_PORT, BOTTOM_PORT, LEFT_PORT, RIGHT_PORT)
      
      // Type selector - Always visible
      $(go.Panel, 'Auto',
        {
          name: 'TYPE_BADGE',
          alignment: go.Spot.Top,
          alignmentFocus: go.Spot.Bottom,
          margin: new go.Margin(-8, 0, 0, 0),
          cursor: 'pointer',
          visible: true  // CHANGED: Always visible
        },
        $(go.Shape, 'RoundedRectangle',
          {
            fill: 'white',
            stroke: '#d1d5db',
            strokeWidth: 1,
            parameter1: 10
          }
        ),
        $(go.Panel, 'Horizontal',
          { margin: new go.Margin(3, 8, 3, 8) },
          // Small colored dot indicator
          $(go.Shape, 'Circle',
            {
              width: 5,
              height: 5,
              stroke: null,
              margin: new go.Margin(0, 4, 0, 0)
            },
            new go.Binding('fill', 'type', (type) => {
              if (!type || type === 'No Type') return '#9ca3af';
              return '#3b82f6';
            })
          ),
          // Type text
          $(go.TextBlock,
            {
              font: '9px system-ui, -apple-system, sans-serif',
              stroke: '#6b7280'
            },
            new go.Binding('text', 'type', (type) => type || 'No Type'),
            new go.Binding('stroke', 'type', (type) => {
              if (!type || type === 'No Type') return '#9ca3af';
              return '#3b82f6';
            })
          ),
          // Dropdown arrow
          $(go.Shape, 'TriangleDown',
            {
              width: 5,
              height: 3,
              fill: '#9ca3af',
              stroke: null,
              margin: new go.Margin(0, 0, 0, 3)
            }
          )
        ),
        {
          click: (e, obj) => {
            const node = obj.part as go.Node;
            showTypeSelector(e, node);
          }
        }
      )
    );

    diagram.linkTemplate = $(
      
      go.Link,
      // 🔧 CHANGED: Use Orthogonal instead of AvoidsNodes (much faster)
      {routing: go.Routing.AvoidsNodes,
          curve: go.Curve.JumpOver,
          corner: 5,
          toShortLength: 4,
          reshapable: true,
          resegmentable: true},
      { routing: go.Link.Orthogonal, corner: 5, selectable: true },
      $(go.Shape, { strokeWidth: 2, stroke: "#555" }),
      $(go.Shape, { toArrow: "Triangle", fill: "#555", stroke: null })
    );

    diagram.groupTemplateMap.add('ClusterGroup',
      $(go.Group, 'Auto',
        {
          isSubGraphExpanded: true,
          layerName: 'Background',
          selectable: true,
          movable: true,
          cursor: 'move',
          handlesDragDropForMembers: true,
          computesBoundsAfterDrag: true,
          computesBoundsIncludingLinks: true,
          fromLinkable: false,
          toLinkable: false,
          minSize: new go.Size(120, 60),
          resizable: true,
          // 🔧 ADD: Prevent default context menu for clusters
          contextClick: (e, obj) => {
            const group = obj.part;
            if (group instanceof go.Group) {
              setSelectedData({
                key: group.data.key,
                label: group.data.label || '',
                isCluster: true
              });
              const mouseEvent = e.event as MouseEvent;
              setContextMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY });
            }
            e.handled = true;  // Prevent browser context menu
          }
        },
        // The Shape that will resize to fit the inner Panel (label + placeholder)
        $(go.Shape, 'RoundedRectangle', {
            name: 'CLUSTER_SHAPE',
            fill: '#e9ecef',
            stroke: '#adb5bd',
            strokeWidth: 1.5,
            parameter1: 6
          },
          new go.Binding('fill', 'color').makeTwoWay(),
          new go.Binding('stroke', 'stroke').makeTwoWay(),
          new go.Binding('strokeWidth', 'strokeWidth').makeTwoWay(),
          new go.Binding('parameter1', 'parameter1').makeTwoWay()
        ),
        // Put label and placeholder into a Vertical panel so the Shape's bounds include both
        $(go.Panel, 'Vertical',
          { defaultStretch: go.GraphObject.Horizontal },
          $(go.TextBlock,
            {
              name: 'G_LABEL',
              margin: new go.Margin(6, 8, 0, 8),
              editable: true,
              font: 'bold 12px sans-serif',
              stroke: '#333',
              background: null,
              maxSize: new go.Size(200, NaN), // constrain width so long labels wrap
              wrap: go.TextBlock.WrapFit,
              overflow: go.TextBlock.OverflowEllipsis,
              alignment: go.Spot.TopLeft
            },
            new go.Binding('text', 'label').makeTwoWay()
          ),
          $(go.Placeholder, { padding: 12 })
        )
      )
    );

    diagram.addDiagramListener('ChangedSelection', () => {
      const node = diagram.selection.first();
      if (node instanceof go.Group) {
        const data = node.data;
        setSelectedData({
          key: data.key,
          label: data.label || '',
          isCluster: true
        });
      } else if (node instanceof go.Node) {
        const data = node.data;
        setSelectedData({
          key: data.key,
          label: data.label || '',
          color: data.color || '#ffffff',
          stroke: data.stroke || '#999999',
          shape: data.shape || 'Rectangle',
          isCluster: false
        });
      } else {
        setSelectedData(null);
      }
    });

    diagram.addDiagramListener('ObjectDoubleClicked', (e) => {
      const node = e.subject.part;
      if (node instanceof go.Group) {
        const data = node.data;
        setSelectedData({
          key: data.key,
          label: data.label || '',
          isCluster: true
        });
      } else if (node instanceof go.Node) {
        const data = node.data;
        setSelectedData({
          key: data.key,
          label: data.label || '',
          color: data.color || '#ffffff',
          stroke: data.stroke || '#999999',
          shape: data.shape || 'Rectangle',
          isCluster: false
        });
      }
    });

    diagram.addDiagramListener('ExternalObjectsDropped', (e) => {
      const droppedParts = e.subject;
      droppedParts.each((part: go.Part) => {
        if (part instanceof go.Node && !part.data.isGroup) {
          const nodeData = part.data;
          
          // 🔧 FIX: Set default type to the shape's name if not already set
          if (!nodeData.type && nodeData.name) {
            diagram.model.setDataProperty(nodeData, 'type', nodeData.name);
          }
          
          // Update label to include type
          const currentLabel = nodeData.label || nodeData.text || nodeData.name || 'Node';
          const displayLabel = currentLabel.charAt(0).toUpperCase() + currentLabel.slice(1);
          diagram.model.setDataProperty(nodeData, 'label', displayLabel);
          diagram.model.setDataProperty(nodeData, 'text', displayLabel);
        }
      });
    });

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const shapeData = e.dataTransfer?.getData('application/gojs-shape');
      const patternData = e.dataTransfer?.getData('application/pattern');
      
      if (!diagramRef.current) return;
      
      const diagram = diagramRef.current;
      const diagramDiv = diagram.div;
      if (!diagramDiv) return;
      
      const rect = diagramDiv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const point = diagram.transformViewToDoc(new go.Point(x, y));
      
      if (patternData) {
        const pattern = JSON.parse(patternData);
        const patternNodes: any[] = Array.isArray(pattern.nodes) ? pattern.nodes : [];

        // Pattern templates store absolute coordinates (~150-800px). Normalize them to
        // the pattern's own top-left so it drops under the cursor instead of hundreds of
        // pixels away, then relocate to open space if it would land on existing content.
        const xs = patternNodes.map((n) => (typeof n.x === 'number' ? n.x : 0));
        const ys = patternNodes.map((n) => (typeof n.y === 'number' ? n.y : 0));
        const minX = xs.length ? Math.min(...xs) : 0;
        const minY = ys.length ? Math.min(...ys) : 0;
        const spanX = (xs.length ? Math.max(...xs) : 0) - minX;
        const spanY = (ys.length ? Math.max(...ys) : 0) - minY;

        const NODE_W = 150;
        const NODE_H = 90;
        const GAP = 50;
        const patternW = spanX + NODE_W;
        const patternH = spanY + NODE_H;

        // Bounds of existing (non-group) content, for overlap detection.
        const existingRects: go.Rect[] = [];
        diagram.nodes.each((n) => {
          if (n.data?.isGroup) return;
          const b = n.actualBounds;
          if (b && b.isReal() && b.width > 0) existingRects.push(b.copy());
        });

        const wouldOverlap = (ax: number, ay: number) => {
          const r = new go.Rect(ax, ay, patternW, patternH);
          return existingRects.some((er) => r.intersectsRect(er.copy().inflate(GAP, GAP)));
        };

        const snap = (v: number) => Math.round(v / 10) * 10;

        // Honor a deliberate drop onto empty canvas so patterns can still be placed by
        // hand. Otherwise pack the pattern into the next free cell of a tidy left-to-right,
        // top-to-bottom grid (draw.io layout guidance: consistent row/column gaps, snapped
        // to the 10px grid) so repeated drops form a compact block, not a messy stack.
        let anchorX = snap(point.x);
        let anchorY = snap(point.y);

        if (wouldOverlap(anchorX, anchorY) && existingRects.length > 0) {
          let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
          existingRects.forEach((r) => {
            left = Math.min(left, r.x); top = Math.min(top, r.y);
            right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
          });

          const colStep = snap(patternW + GAP);
          const rowStep = snap(patternH + GAP);
          // Wrap a row once it grows past the existing content width (min 3 columns) so
          // patterns flow into a block rather than one long row or column.
          const maxRowRight = left + Math.max(right - left, colStep * 3);

          let placed = false;
          for (let row = 0; row < 500 && !placed; row++) {
            for (let col = 0; col < 500; col++) {
              const ax = snap(left + col * colStep);
              const ay = snap(top + row * rowStep);
              if (col > 0 && ax + patternW > maxRowRight) break; // wrap to next row
              if (!wouldOverlap(ax, ay)) { anchorX = ax; anchorY = ay; placed = true; break; }
            }
          }
          if (!placed) { anchorX = snap(left); anchorY = snap(bottom + GAP); }
        }

        diagram.startTransaction('drop pattern');

        const clusterKeyMap = new Map<string, string>();
        const nodeKeyMap = new Map<string, string>();

        // Create cluster group nodes first, then map pattern cluster ids to concrete GoJS keys.
        (pattern.clusters || []).forEach((cluster: any) => {
          const groupKey = `group_${Date.now()}_${cluster.id}`;
          clusterKeyMap.set(cluster.id, groupKey);

          const groupData: any = {
            key: groupKey,
            isGroup: true,
            category: cluster.category || 'ClusterGroup',
            label: cluster.label
          };

          (diagram.model as go.GraphLinksModel).addNodeData(groupData);
        });
        
        pattern.nodes.forEach((node: any) => {
          const newKey = `node_${Date.now()}${node.id}`;
          nodeKeyMap.set(node.id, newKey);
          
          const nodeData: any = {
            key: newKey,
            name: node.name,
            label: node.label,
            shape: node.shape,
            color: node.color,
            stroke: node.stroke,
            loc: go.Point.stringify(new go.Point(anchorX + ((node.x ?? 0) - minX), anchorY + ((node.y ?? 0) - minY))),
            type: node.type || node.name  // 🔧 FIX: Use pattern's type or default to name
          };

          if (node.group && clusterKeyMap.has(node.group)) {
            nodeData.group = clusterKeyMap.get(node.group);
          }

          if (Array.isArray(node.sharedGroups) && node.sharedGroups.length > 0) {
            const mappedSharedGroups = node.sharedGroups
              .map((groupId: string) => clusterKeyMap.get(groupId))
              .filter((groupKey: string | undefined): groupKey is string => Boolean(groupKey));

            if (mappedSharedGroups.length > 0) {
              nodeData.isShared = true;
              nodeData.sharedGroups = mappedSharedGroups;
              nodeData.group = undefined;
            }
          }

          if (typeof node.parameter1 === 'number') {
            nodeData.parameter1 = node.parameter1;
          } else if (node.shape === 'RoundedRectangle') {
            nodeData.parameter1 = getRoundedRectParameter(node.name);
          }

          (diagram.model as go.GraphLinksModel).addNodeData(nodeData);
        });
        
        pattern.links.forEach((link: any) => {
          const fromKey = nodeKeyMap.get(link.from);
          const toKey = nodeKeyMap.get(link.to);
          
          if (fromKey && toKey) {
            const linkData = {
              key: `link_${Date.now()}_${link.from}_${link.to}`,
              from: fromKey,
              to: toKey
            };
            
            (diagram.model as go.GraphLinksModel).addLinkData(linkData);
          }
        });
        
        diagram.commitTransaction('drop pattern');
        return;
      }
      
      if (shapeData) {
        const shape = JSON.parse(shapeData);
        
        const nodeData: any = {
          key: `node_${Date.now()}`,
          name: shape.name,
          label: shape.label,
          shape: shape.shape,
          color: shape.color,
          stroke: shape.stroke,
          loc: go.Point.stringify(point),
          type: shape.name,  // 🔧 FIX: Set default type to shape name
          ...(shape.width && { width: shape.width }),
          ...(shape.height && { height: shape.height }),
        };

        if (shape.shape === 'RoundedRectangle') {
          nodeData.parameter1 = getRoundedRectParameter(shape.name);
          shape.height = shape.height || 60;

        }
        
        if (shape.shape === 'Hexagon') {
          nodeData.parameter1 = 1;
        }
        
        diagram.startTransaction("add node");
        diagram.model.addNodeData(nodeData);
        diagram.commitTransaction("add node");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();  // 🔧 ADD: Stop propagation
      return false;
    };

    const diagramDiv = diagram.div;
    if (diagramDiv) {
      diagramDiv.addEventListener('dragover', handleDragOver);
      diagramDiv.addEventListener('drop', handleDrop);
      diagramDiv.addEventListener('contextmenu', handleContextMenu);
    }

    diagramRef.current = diagram;
    setupDiagramValidation(diagram);

    return () => {
      if (diagramDiv) {
        diagramDiv.removeEventListener('dragover', handleDragOver);
        diagramDiv.removeEventListener('drop', handleDrop);
        diagramDiv.removeEventListener('contextmenu', handleContextMenu);
      }
      if (diagramRef.current) {
        diagramRef.current.div = null;
        diagramRef.current = null;
      }
    };
  }, [diagramRef, setSelectedData, setContextMenu, containers, customGroups]);

  const handleValidate = () => {
    if (!diagramRef.current) {
      alert('❌ Diagram not ready for validation.');
      return;
    }

    const diagram = diagramRef.current;
    const selection = diagram.selection;
    
    if (selection.count === 0) {
      const validateAll = confirm('No shapes selected.\n\nDo you want to:\n• OK: Validate entire diagram\n• Cancel: Select shapes first');
      
      if (validateAll) {
        diagram.nodes.each(node => diagram.select(node));
        diagram.links.each(link => diagram.select(link));
        validateGoJSDiagram(diagram);
        diagram.clearSelection();
      } else {
        alert('Please select the pattern you want to validate and try again.');
      }
    } else {
      validateGoJSDiagram(diagram);
    }
  };

  // ADD: Handle custom group drops
  useEffect(() => {
    const diagramDiv = diagramRef.current?.div;
    if (!diagramDiv) return;

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData('application/custom-group-shape');
      if (data) {
        const { group, shapeId } = JSON.parse(data);
        const shape = customGroups[group]?.find((s: any) => s.id === shapeId);
        if (shape && diagramRef.current) {
          const diagram = diagramRef.current;
          const diagramDiv = diagram.div;
          if (!diagramDiv) return;

          const rect = diagramDiv.getBoundingClientRect();
          const pt = diagram.transformViewToDoc(
            new go.Point(e.clientX - rect.left, e.clientY - rect.top)
          );

          diagram.startTransaction('drop custom group shape');

          const minLoc = shape.nodeDataArray.reduce(
            (min: { x: number; y: number }, n: any) => {
              const [x, y] = (n.loc || "0 0").split(' ').map(Number);
              return {
                x: Math.min(min.x, x),
                y: Math.min(min.y, y)
              };
            },
            { x: Infinity, y: Infinity }
          );
          const offsetX = pt.x - minLoc.x;
          const offsetY = pt.y - minLoc.y;

          const keyMap: Record<string, string> = {};
          const newNodes = shape.nodeDataArray.map((n: any) => {
            const newKey = `node_${Date.now()}${Math.floor(Math.random() * 1000000)}`;
            keyMap[n.key] = newKey;
            const [x, y] = (n.loc || "0 0").split(' ').map(Number);
            return {
              ...n,
              key: newKey,
              loc: `${x + offsetX} ${y + offsetY}`,
              type: n.type || n.name  // 🔧 FIX: Preserve type or default to name
            };
          });

          newNodes.forEach((n: any) => diagram.model.addNodeData(n));

          const newLinks = shape.linkDataArray.map((l: any) => ({
            ...l,
            from: keyMap[l.from],
            to: keyMap[l.to]
          }));
          newLinks.forEach((l: any) => (diagram.model as go.GraphLinksModel).addLinkData(l));

          diagram.commitTransaction('drop custom group shape');
        }
      }
    };

    diagramDiv.addEventListener('dragover', e => e.preventDefault());
    diagramDiv.addEventListener('drop', handleDrop);

    return () => {
      diagramDiv.removeEventListener('dragover', e => e.preventDefault());
      diagramDiv.removeEventListener('drop', handleDrop);
    };
  }, [diagramRef, customGroups]);

  // Render the diagram container
  return (
    <div
      ref={diagramDivRef}
      style={{
        flex: 1,
        position: 'relative',
        height: '100%',
        width: '100%',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        overflowX: 'visible',
        overflowY: 'visible',
      }}
    />
  );
};

// ADD: Export the component as default
export default GoDiagram;
