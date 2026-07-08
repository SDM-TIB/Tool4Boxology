import React, { useState, useMemo } from 'react';
import { shapes } from '../data/shape';
import { elementaryPatterns, compositePatterns, type Pattern } from '../data/patterns';
import { kautzPatterns } from '../data/kautzPatterns';
import type { ShapeDefinition } from '../types';
import tibLogo from '../assets/TIB_Logo_EN.webp'; // adjust path if needed
import vuLogo from '../assets/VU-Logo.png';   // add this line
import { LineAxis, SpaOutlined } from '@mui/icons-material';

interface ShapeGroupMap {
  [group: string]: ShapeDefinition[];
}

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
      shape.group.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const grouped = groupShapesByCategory(filteredShapes);
  
  // Sort categories by defined order
  const sortedCategories = categoryOrder.filter(category => grouped[category]);

  const clearSearch = () => {
    setSearchTerm('');
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
          background: ' #a680ce',
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
            onChange={(e) => setSearchTerm(e.target.value)}
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
                  background: '#54ac67',
                  border: '1px solid #bbdefb',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#eaf2faff',
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
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.4px',
                  transition: 'all 0.2s ease',
                  userSelect: 'none',
                  background: shapesMenuCollapsed ? '#8680ce' : '#746eb3',
                  color: '#eaf2faff',
                  border: '1px solid #2f356f',
                  textTransform: 'uppercase',
                }}
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
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '13px',
                          fontWeight: '600',
                          transition: 'all 0.2s ease',
                          userSelect: 'none',
                         background: collapsedCategories.has(category) ? '#4f4b79' : '#8680ce',
                          color: '#eaf2faff',
                          border: '1px solid #bbdefb',
                        }}
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
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '8px',
              fontSize: '13px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              color: '#eaf2faff',
              background: patternsMenuCollapsed ? '#8680ce' : '#746eb3',
              border: '1px solid #2f356f',
              transition: 'all 0.2s ease'
            }}
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
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #bbdefb',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: '#eaf2faff',
                     background: patternsCollapsedState ? '#4f4b79' : '#8680ce',
                      transition: 'background 0.2s'
                    }}
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
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #bbdefb',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            userSelect: 'none',
                            color: '#eaf2faff',
                            background: elementaryPatternsCollapsedState ? '#85a2d8' : '#9abbf8',
                            transition: 'background 0.2s'
                          }}
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
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #bbdefb',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            userSelect: 'none',
                            color: '#eaf2faff',
                            background: compositePatternsCollapsedState ? '#85a2d8' : '#9abbf8',
                            transition: 'background 0.2s',
                            
                          }}
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
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #bbdefb',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: '#eaf2faff',
                      background: patternsCollapsedState ? '#4f4b79' : '#8680ce',
                      transition: 'background 0.2s'
                    }}
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
                    <div style={{
                      display: 'grid',
                      gap: '8px',
                      padding: '12px',
                      background: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      {kautzPatterns.map((pattern: Pattern) => (
                        <div
                          key={pattern.id}
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
