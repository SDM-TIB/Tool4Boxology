import React, { useState, useMemo } from 'react';
import { shapes, shapeTypesTree, type ShapeTypeTree } from '../../data/shape';
import { elementaryPatterns, compositePatterns, type Pattern } from '../../data/patterns';
import { kautzPatterns } from '../../data/kautzPatterns';
import type { ShapeDefinition } from '../../types';
import tibLogo from '../../assets/TIB_Logo_EN.webp'; // adjust path if needed
import vuLogo from '../../assets/VU-Logo.png';   // add this line
import { LineAxis, SpaOutlined } from '@mui/icons-material';
import { colors } from '../../styles/theme';
import { getSectionHeaderStyle } from '../../styles/buttonStyles';

interface ShapeGroupMap {
  [group: string]: ShapeDefinition[];
}

// The six Generic Kautz boxology categories. Each Kautz pattern belongs to exactly
// one, encoded today by its pattern id (all category-1 patterns share id 'symbolic>neuro',
// etc.). New patterns can instead set an explicit `category` field on the pattern.
const kautzCategories: { num: number; label: string }[] = [
  { num: 1, label: 'Symbolic → Neuro' },
  { num: 2, label: 'Neuro → Symbolic' },
  { num: 3, label: 'Neuro + Symbolic' },
  { num: 4, label: 'Neuro: Symbolic → Neuro' },
  { num: 5, label: 'Neuro {Symbolic}' },
  { num: 6, label: 'Neuro [Symbolic]' },
];

const kautzIdToCategory: Record<string, number> = {
  'symbolic>neuro': 1,
  'neuro>symbolic': 2,
  'neuro+symbolic': 3,
  'neuro:symbolic>neuro': 4,
  'neuro {symbolic}': 5,
  'Neuro [Symbolic]': 6,
};

// Resolve a Kautz pattern's category: explicit field first, then id-based fallback.
function getKautzCategory(pattern: Pattern): number {
  return pattern.category ?? kautzIdToCategory[pattern.id] ?? 0;
}

// Flatten e.g. shapeTypesTree.Data = { Number, Dataset, Tensor, Text, Image, ... }
// into a lowercase name list, so searching a subtype (e.g. "Image") also finds
// the shape that owns it (e.g. "Data").
function flattenTypeNames(node: ShapeTypeTree | null | undefined): string[] {
  if (!node) return [];
  return Object.keys(node).flatMap(key => [key, ...flattenTypeNames(node[key])]);
}

const shapeSubtypeIndex: Record<string, string[]> = Object.fromEntries(
  Object.entries(shapeTypesTree).map(([rootName, subtree]) => [
    rootName.toLowerCase(),
    flattenTypeNames(subtree).map(name => name.toLowerCase()),
  ])
);

function groupShapesByCategory(shapes: ShapeDefinition[]): ShapeGroupMap {
  return shapes.reduce((acc, shape) => {
    acc[shape.group] = acc[shape.group] || [];
    acc[shape.group].push(shape);
    return acc;
  }, {} as ShapeGroupMap);
}

// Define category order and icons for existing shapes
const categoryOrder = [
  'Data & Information',
  'Actors & Entities', 
  'AI & Models',
  'Processes & Actions',
  //'Documentation'
];


export interface LeftSidebarProps {
  containers: string[];
  customContainerShapes: { [key: string]: any[] };
  onAddContainer: (containerName: string) => void;
}

export default function LeftSidebar({ 
  containers, 
  onAddContainer, 
  customContainerShapes,
}: LeftSidebarProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [shapesMenuCollapsed, setShapesMenuCollapsed] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(categoryOrder) // All categories collapsed initially
  );
  const [patternsMenuCollapsed, setPatternsMenuCollapsed] = useState(true);
  const [patternsCollapsedState, setPatternsCollapsed] = useState(true);
  const [elementaryPatternsCollapsedState, setElementaryPatternsCollapsed] = useState(true);
  const [compositePatternsCollapsedState, setCompositePatternsCollapsed] = useState(true);
  const [kautzCollapsedState, setKautzCollapsed] = useState(true);
  const [kautzCategoriesCollapsed, setKautzCategoriesCollapsed] = useState<Set<number>>(
    new Set(kautzCategories.map((c) => c.num)) // all Kautz categories collapsed initially
  );
  const toggleKautzCategory = (num: number) => {
    setKautzCategoriesCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  // Group Kautz patterns by their category (1-6) for the sub-menu.
  const kautzByCategory = useMemo(() => {
    const map = new Map<number, Pattern[]>();
    for (const pattern of kautzPatterns) {
      const cat = getKautzCategory(pattern);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(pattern);
    }
    return map;
  }, []);

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  // Filter shapes based on search term
  const filteredShapes = useMemo(() => {
    if (!searchTerm.trim()) return shapes;

    const term = searchTerm.toLowerCase();
    return shapes.filter(shape =>
      shape.name.toLowerCase().includes(term) ||
      shape.label.toLowerCase().includes(term) ||
      (shapeSubtypeIndex[shape.name.toLowerCase()] || []).some(subtype => subtype.includes(term))
    );
  }, [searchTerm]);

  const grouped = groupShapesByCategory(filteredShapes);
  
  // Sort categories by defined order
  const sortedCategories = categoryOrder.filter(category => grouped[category]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  const handleSearchChange = (value: string) => {
    if (/^https?:\/\/api\.[^\s]+\/?$/i.test(value.trim())) {
      setSearchTerm('');
      return;
    }
    setSearchTerm(value);
  };

  const renderShape = (shape: ShapeDefinition) => {
    return (
      <div
        key={shape.name}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/gojs-shape', JSON.stringify(shape));
          e.dataTransfer.effectAllowed = 'copy';
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px',
          border: '1px solid #e0e0e0',
          borderRadius: '6px',
          background: '#fafafa',
          cursor: 'grab',
          minWidth: '70px',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#f0f0f0';
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#fafafa';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        title={shape.label}
      >
        <div style={{
          width: '32px',
          height: '20px',
          background: shape.color,
          border: `1px solid ${shape.stroke}`,
          borderRadius: shape.shape === 'RoundedRectangle' ? '8px' : 
                     shape.shape === 'Ellipse' ? '50%' : 
                     shape.shape === 'Diamond' ? '2px' :
                     shape.shape === 'Triangle' ? '0' : '2px',
          clipPath: shape.shape === 'Triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' :
                   shape.shape === 'Diamond' ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' :
                   shape.shape === 'Hexagon' ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' : 'none',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} />
        <div style={{
          fontSize: '10px',
          fontWeight: '500',
          textAlign: 'center',
          color: '#333',
          lineHeight: '1.2'
        }}>
          {shape.label}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #dee2e6',
        boxShadow: 'inset -1px 0 3px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: colors.surface.header,
          color: '#fff',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          borderBottom: '1px solid #dee2e6',
        }}
      >
        <span style={{ 
          fontWeight: '600', 
          fontSize: '14px',
          letterSpacing: '0.5px'
        }}>
          Shape Library
        </span>
      </div>

      {/* Search Bar */}
      <div style={{
        padding: '12px 16px',
        background: '#fff',
        borderBottom: '1px solid #dee2e6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ position: 'relative', paddingLeft: '20px' }}>
          <input
            type="text"
            placeholder="Search shapes..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            name="boxology-shape-search"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%',
              padding: '8px 12px 8px 1px',
              border: '1px solid #ddd',
              borderRadius: '20px',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              background: '#f8f9fa'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#667eea';
              e.target.style.background = '#fff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#ddd';
              e.target.style.background = '#f8f9fa';
            }}
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                color: '#999',
                padding: '2px'
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
          <div style={{
            position: 'absolute',
            left: '0px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#999',
            fontSize: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            userSelect: 'none'
          }}>
            🔍
          </div>
        </div>
        {searchTerm && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#666',
            textAlign: 'center'
          }}>
            {filteredShapes.length} shape(s) found
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px',
        }}
      >
        {/* Static Shape Groups */}
        <div style={{ marginBottom: '16px' }}>
          {searchTerm ? (
            // Show all results in a single group when searching
            filteredShapes.length > 0 ? (
              <div style={{ marginBottom: '8px' }}>
                <div style={{
                  padding: '8px 12px',
                  background: colors.semantic.info.main,
                  border: '1px solid #bbdefb',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.text.onPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🔍  Search Results ({filteredShapes.length})
                </div>
                <div style={{ 
                  padding: '12px', 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  background: '#fff',
                  borderRadius: '6px',
                  border: '1px solid #e0e0e0'
                }}>
                  {filteredShapes.map((shape) => renderShape(shape))}
                </div>
              </div>
            ) : (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#999',
                fontStyle: 'italic'
              }}>
                No shapes found matching "{searchTerm}"
              </div>
            )
          ) : (
            // Show organized categories under the Shapes parent menu when not searching
            <div style={{ marginBottom: '8px' }}>
              <div
                onClick={() => setShapesMenuCollapsed((prev) => !prev)}
                style={getSectionHeaderStyle(shapesMenuCollapsed, 'top')}
              >
                <span>Shapes</span>
                <span style={{
                  transform: shapesMenuCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                  transition: 'transform 0.2s ease',
                  fontSize: '12px'
                }}>
                  ▶
                </span>
              </div>

              {!shapesMenuCollapsed && (
                <div style={{ marginTop: '8px' }}>
                  {sortedCategories.map((category) => (
                    <div key={category} style={{ marginBottom: '8px' }}>
                      <div
                        onClick={() => toggleCategory(category)}
                        style={getSectionHeaderStyle(collapsedCategories.has(category), 'category')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{category}</span>
                        </div>
                        <span style={{
                          transform: collapsedCategories.has(category) ? 'rotate(0deg)' : 'rotate(90deg)',
                          transition: 'transform 0.2s ease',
                          fontSize: '12px'
                        }}>
                          ▶
                        </span>
                      </div>

                      {!collapsedCategories.has(category) && (
                        <div style={{
                          padding: '12px',
                          background: '#fff',
                          border: '1px solid #e0e0e0',
                          borderTop: 'none',
                          borderBottomLeftRadius: '8px',
                          borderBottomRightRadius: '8px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                          {grouped[category].map((shape) => renderShape(shape))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Patterns Parent Menu */}
        {(elementaryPatterns.length > 0 || compositePatterns.length > 0 || kautzPatterns.length > 0) && (
        <div style={{ marginBottom: '16px' }}>
          <div
            onClick={() => setPatternsMenuCollapsed((prev) => !prev)}
            style={{ ...getSectionHeaderStyle(patternsMenuCollapsed, 'top'), marginBottom: '8px' }}
          >
            <span>Patterns</span>
            <span style={{
              transform: patternsMenuCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.2s ease',
              fontSize: '12px'
            }}>
              ▶
            </span>
          </div>

          {!patternsMenuCollapsed && (
            <div style={{ marginTop: '8px' }}>
              {/* Bekkum Patterns Section */}
              {(elementaryPatterns.length > 0 || compositePatterns.length > 0) && (
                <div style={{ marginBottom: '8px' }}>
                  <div
                    onClick={() => setPatternsCollapsed((prev) => !prev)}
                    style={{ ...getSectionHeaderStyle(patternsCollapsedState, 'category'), textTransform: 'uppercase', letterSpacing: '0.5px', gap: '8px' }}
                  >
                    <span>Bekkum Patterns</span>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '14px',
                      transform: patternsCollapsedState ? 'rotate(0deg)' : 'rotate(90deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▶
                    </span>
                  </div>
                  {!patternsCollapsedState && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <div
                          onClick={() => setElementaryPatternsCollapsed((prev) => !prev)}
                          style={{ ...getSectionHeaderStyle(elementaryPatternsCollapsedState, 'sub'), textTransform: 'uppercase', letterSpacing: '0.5px', gap: '8px' }}
                        >
                          <span>Elementary Patterns</span>
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: '14px',
                            transform: elementaryPatternsCollapsedState ? 'rotate(0deg)' : 'rotate(90deg)',
                            transition: 'transform 0.2s'
                          }}>
                            ▶
                          </span>
                        </div>
                        {!elementaryPatternsCollapsedState && (
                          <div style={{
                            display: 'grid',
                            gap: '8px',
                            padding: '12px',
                            background: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            {elementaryPatterns.map((pattern: Pattern) => (
                              <div
                                key={pattern.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/pattern', JSON.stringify(pattern));
                                }}
                                style={{
                                  display: 'relative',
                                  cursor: 'pointer',
                                  border: '1px solid #000B58',
                                  borderRadius: '6px',
                                  padding: '8px',
                                  background: '#C2E2FA',
                                  color: 'navyblue',
                                  fontWeight: '500',
                                  textAlign: 'center',
                                  width: '230px',
                                  minHeight: '30px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = '#AEDEFC';
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(20, 7, 74, 0.3)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = '#C2E2FA';
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                title={pattern.description || pattern.name}
                              >
                                <div style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  maxWidth: '100px',
                                  textOverflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  color: '#000B58'
                                }}>
                                  {pattern.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <div
                          onClick={() => setCompositePatternsCollapsed((prev) => !prev)}
                          style={{ ...getSectionHeaderStyle(compositePatternsCollapsedState, 'sub'), textTransform: 'uppercase', letterSpacing: '0.5px', gap: '8px' }}
                        >
                          <span>Composite Patterns</span>
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: '14px',
                            transform: compositePatternsCollapsedState ? 'rotate(0deg)' : 'rotate(90deg)',
                            transition: 'transform 0.2s'
                          }}>
                            ▶
                          </span>
                        </div>
                        {!compositePatternsCollapsedState && (
                          <div style={{
                            display: 'grid',
                            gap: '8px',
                            padding: '12px',
                            background: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            {compositePatterns.map((pattern: Pattern) => (
                              <div
                                key={pattern.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/pattern', JSON.stringify(pattern));
                                }}
                                style={{
                                  display: 'relative',
                                  cursor: 'pointer',
                                  border: '1px solid #0F4C75',
                                  borderRadius: '6px',
                                  padding: '8px',
                                  background: '#DDEBFA',
                                  fontWeight: '500',
                                  textAlign: 'center',
                                  width: '230px',
                                  minHeight: '30px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = '#C3E4FA';
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(15, 76, 117, 0.3)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = '#DDEBFA';
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                title={pattern.description || pattern.name}
                              >
                                <div style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  maxWidth: '100px',
                                  textOverflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  color: '#000B58'
                                }}>
                                  {pattern.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Kautz Model Section */}
              {kautzPatterns.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div
                    onClick={() => setKautzCollapsed((prev) => !prev)}
                    style={{ ...getSectionHeaderStyle(kautzCollapsedState, 'category'), textTransform: 'uppercase', letterSpacing: '0.5px', gap: '8px' }}
                  >
                    <span>Kautz model</span>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '14px',
                      transform: kautzCollapsedState ? 'rotate(0deg)' : 'rotate(90deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▶
                    </span>
                  </div>
                  {!kautzCollapsedState && (
                    <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                      {kautzCategories.map((cat) => {
                        const patterns = kautzByCategory.get(cat.num) || [];
                        if (patterns.length === 0) return null;
                        const collapsed = kautzCategoriesCollapsed.has(cat.num);
                        return (
                          <div key={cat.num}>
                            <div
                              onClick={() => toggleKautzCategory(cat.num)}
                              style={{ ...getSectionHeaderStyle(collapsed, 'sub'), gap: '8px' }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: 'rgba(255,255,255,0.85)',
                                  color: '#0F4C75',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  flex: 'none'
                                }}>
                                  {cat.num}
                                </span>
                                <span>{cat.label}</span>
                                <span style={{ fontSize: '11px', opacity: 0.75, fontWeight: 500 }}>
                                  ({patterns.length})
                                </span>
                              </span>
                              <span style={{
                                marginLeft: 'auto',
                                fontSize: '14px',
                                transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                                transition: 'transform 0.2s'
                              }}>
                                ▶
                              </span>
                            </div>
                            {!collapsed && (
                              <div style={{
                                display: 'grid',
                                gap: '8px',
                                padding: '12px',
                                background: '#fff',
                                border: '1px solid #e0e0e0',
                                borderRadius: '6px',
                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                              }}>
                                {patterns.map((pattern: Pattern, i) => (
                                  <div
                                    key={`${cat.num}-${pattern.id}-${i}`}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/pattern', JSON.stringify(pattern));
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      border: '1px solid #0F4C75',
                                      borderRadius: '6px',
                                      padding: '8px',
                                      background: '#D6ECFA',
                                      fontWeight: '500',
                                      textAlign: 'center',
                                      width: '230px',
                                      minHeight: '30px',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.background = '#C3E4FA';
                                      e.currentTarget.style.transform = 'scale(1.05)';
                                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(15, 76, 117, 0.3)';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.background = '#D6ECFA';
                                      e.currentTarget.style.transform = 'scale(1)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    title={pattern.description || pattern.name}
                                  >
                                    <div style={{
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      textAlign: 'center',
                                      color: '#0F4C75'
                                    }}>
                                      {pattern.name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        background: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        fontSize: '11px',
        color: '#6c757d',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
      <button
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'right',
              height: '35px'
            }}
            title="TIB Website"
            onClick={() => window.open('https://www.tib.eu/', '_blank')}
          >
            <img src={tibLogo} alt="TIB Logo" style={{ height: 'auto', width: 'auto' }} />
          </button>
        <div style={{ display: 'flex' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              right: '10px',
              //padding: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              height: '32px'
            }}
            title="VU Amsterdam Website"
            onClick={() => window.open('https://vu.nl/', '_blank')}
          >
            <img src={vuLogo} alt="VU Logo" style={{ height: '32px', width: 'auto' }} />
          </button>

        </div>
      </div>
    </div>
  );
}
