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
import { API_BASE } from '../../config';

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

interface Paper {
  id: string;
  label: string;
  paper_url: string;
  authors: string[];
  dataset_urls: string[];
  matchingCount: string;
}

  const PREFIXES = `PREFIX t4b: <http://tool4boxology.org/>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> 
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`;

  const DEFAULT_QUERY = `${PREFIXES}

  SELECT ?boxology ?label
  WHERE {
    ?boxology a t4b:Boxology ;
              rdfs:label ?label .
  }
  LIMIT 100`;

export default function AddonRightSidebar({ selectedData, diagramRef, pages, currentPageId, setPages, setCurrentPageId, isKgGenerated, showToast }: RightSidebarProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [evaluationsSearched, setEvaluationsSearched] = useState(false);
  const [evaluationsFound, setEvaluationsFound] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [userBoxologyLabel, setUserBoxologyLabel] = useState('');
  const [paperBoxologyLabel, setPaperBoxologyLabel] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);

  // Check how many objects are selected and detect links

  const processTypeQuery = `${PREFIXES}

  SELECT ?processType (COUNT(DISTINCT ?patternA) AS ?countInSystemA) (COUNT(DISTINCT ?patternB) AS ?countInSystemB) WHERE {
    {
      ?boxologyA rdfs:label "${userBoxologyLabel}" ;
                t4b:hasPattern ?patternA .
      ?patternA t4b:hasProcess ?processA .
      ?processA a ?processType .
    }
    UNION
    {
      ?boxologyB rdfs:label "${paperBoxologyLabel}" ;
                t4b:hasPattern ?patternB .
      ?patternB t4b:hasProcess ?processB .
      ?processB a ?processType .
    }
  }
  GROUP BY ?processType
  FILTER(?countInSystemA == ?countInSystemB)`

  const sharedPatternTypesQuery =  `${PREFIXES}

            SELECT ?otherBoxology ?otherLabel (COUNT(DISTINCT ?sharedType) AS ?sharedPatternTypes) WHERE {
              ?refBoxology rdfs:label "${userBoxologyLabel}" ;
                          t4b:hasPattern ?refPattern .
              ?refPattern t4b:hasProcess ?refProcess .
              ?refProcess a ?sharedType .

              ?otherBoxology t4b:hasPattern ?otherPattern ;
                            rdfs:label ?otherLabel .
              ?otherPattern t4b:hasProcess ?otherProcess .
              ?otherProcess a ?sharedType .

              FILTER(?otherBoxology != ?refBoxology)
            }
            GROUP BY ?otherBoxology ?otherLabel
            ORDER BY DESC(?sharedPatternTypes)`

  function shortenUri(uri: string): string {
    if (uri.startsWith('http://tool4boxology.org/')) return 't4b:' + uri.slice('http://tool4boxology.org/'.length);
    if (uri.startsWith('http://www.w3.org/2000/01/rdf-schema#')) return 'rdfs:' + uri.slice('http://www.w3.org/2000/01/rdf-schema#'.length);
    return uri;
  }

  function formatBindingValue(binding?: { type: string; value: string }): string {
    if (!binding) return '';
    return binding.type === 'uri' ? shortenUri(binding.value) : binding.value;
  }

  useEffect(() => {
    console.log("Active Section:", activeSection); 
  }, [activeSection]); 

  const runQuery = async (userBoxologyLabel: any, paperBoxologyLabel: string) => {
      setIsRunning(true);
      setError(null);
      console.log(userBoxologyLabel)
      try {
        const res = await fetch(`http://localhost:5000/sparql`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 
            `${PREFIXES}

            SELECT DISTINCT ?boxology ?otherLabel (SUM(?countInSystemA) AS ?sameCount) WHERE {
              {SELECT DISTINCT ?boxology ?otherLabel ?inputType ?outputType ?processType
                              (COUNT(DISTINCT ?pattern) AS ?countInSystemA) (COUNT(DISTINCT ?patternB) AS ?countInSystemB)
              WHERE {
                ?boxology rdfs:label ?otherLabel ;
                          t4b:hasPattern ?pattern .
                ?pattern rdf:type t4b:DesignPattern .

                OPTIONAL { ?pattern rdfs:label ?patternLabel }
                OPTIONAL {
                  ?pattern t4b:hasInput ?input .
                  OPTIONAL { ?input rdf:type ?inputType }
                }
                OPTIONAL {
                  ?pattern t4b:hasOutput ?output .
                  OPTIONAL { ?output rdf:type ?outputType }
                }
                OPTIONAL {
                  ?pattern t4b:hasProcess ?process .
                  OPTIONAL { ?process rdf:type ?processType }
                }
                #FILTER(?otherLabel != "${userBoxologyLabel}")

                OPTIONAL {
                  ?boxologyB rdfs:label "${userBoxologyLabel}" ;
                            t4b:hasPattern ?patternB .
                  ?patternB rdf:type t4b:DesignPattern .

                  OPTIONAL { ?patternB rdfs:label ?patternLabelB }
                  OPTIONAL {
                    ?patternB t4b:hasInput ?inputB .
                    OPTIONAL { ?inputB rdf:type ?inputType }
                  }
                  OPTIONAL {
                    ?patternB t4b:hasOutput ?outputB .
                    OPTIONAL { ?outputB rdf:type ?outputType }
                  }
                  OPTIONAL {
                    ?patternB t4b:hasProcess ?processB .
                    OPTIONAL { ?processB rdf:type ?processType }
                  }
                }
              }
              GROUP BY ?boxology ?otherLabel ?processType ?inputType ?outputType
              ORDER BY ?boxology ?otherLabel ?inputType ?outputType ?processType}

              FILTER(?countInSystemA = ?countInSystemB)
              }
              GROUP BY ?boxology ?otherLabel
              ORDER BY DESC(?sameCount)
            `
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Query failed (${res.status}): ${text || res.statusText}`);
        }
        const data = await res.json();
        setHasRun(true);
        setEvaluationsSearched(true);
  
        if (typeof data?.boolean === 'boolean') {
          console.log(['result'])//setColumns(['result']);
          console.log([{ result: String(data.boolean) }])//setRows([{ result: String(data.boolean) }]);
          return;
        }
  
        const vars: string[] = data?.head?.vars || [];
        console.log(data?.results?.bindings)
        const bindings: Record<string, { type: string; value: string }>[] = data?.results?.bindings || [];
        console.log(vars) // setColumns(vars);
        const unique = new Map<string, Paper>();
        //TODO: group bindings together
        for (const binding of bindings) {
          const id = binding.boxology?.value;
          if (!id) continue;
          
          unique.set(id, {
            id,
            label: binding.otherLabel?.value || id,
            matchingCount: binding.sameCount?.value || '0',
            paper_url: binding.paper_url?.value || '',
            authors: [],
            dataset_urls: [],
          });
        }
        setPapers(Array.from(unique.values()));
        console.log(papers)

      } catch (err: any) {
        setError(err?.message || 'Query failed. Is the backend / Virtuoso endpoint reachable?');
        setEvaluationsFound(false);
        setEvaluationsSearched(true);
        setHasRun(true);
      } finally {
        setIsRunning(false);
      }
    };

  const searchForEvaluations = () => {
    setEvaluationsSearched(true);
    setEvaluationsFound(true);
    setUserBoxologyLabel(diagramRef.current.model.label);
    //console.log(diagramRef.current);
    //console.log(diagramRef.current.model);
    //console.log(diagramRef.current.model.label);
    console.log(currentPageId);
    // Get current page
    const currentPage = pages.find((p) => p.id === currentPageId);
    console.log(currentPage.boxologyLabel)

    setPaperBoxologyLabel('Pain-Classification');
    //setQueryText(processTypeQuery);
    //console.log(queryText)
    runQuery(currentPage.boxologyLabel, 'Pain-Classification');

    //TODO: Run queries and display results
    /*python file with 
    query = "ASK WHERE { " + query + " .}"
		sparql.setReturnFormat(JSON)
		sparql.setQuery(query)
		results = sparql.query().convert()*/
  }

  const displayNoKgError = () => {
    showToast('No Knowledge Graph is available to search for linked Papers. Create the KG first.', 'warning');
  }

  const activePaperSection: any[] = [];

  /*setPaperButtons(
    
  ); */

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
      {!evaluationsSearched && !isKgGenerated && (
        <div style={{ marginBottom: 12, padding: 12, background: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 10}}>
            <span>No KG found!</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                No Knowledge Graph found! Please generate the KG before searching for linked papers.
            </span>
          </div>
          <button onClick={() => displayNoKgError()} style={getButtonStyle()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span>Search</span>
            </div>
          </button>
        </div>
      )}
      {!evaluationsSearched && isKgGenerated && (
        <div style={{ marginBottom: 12, padding: 12, background: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', fontSize: 14, fontWeight: 700, color: '#6b7280', marginBottom: 10}}>
            <span>KG ready!</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                Knowledge Graph is generated. You can now search for linked papers.
            </span>
          </div>
          <button onClick={() => searchForEvaluations()} style={getButtonStyle()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span>Search</span>
            </div>
          </button>
        </div>
      )}
      {(evaluationsSearched && evaluationsFound) && (
        <div style={{ marginBottom: 12, padding: 12, background: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, letterSpacing: 0.6 }}>
            LINKED PAPERS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {papers.map((paper) => {
              const isOpen = activeSection === paper.id;
              return(
              <React.Fragment key={paper.id}>
                <button onClick={() => setActiveSection(paper.id)} style={getMenuButtonStyle(isOpen)}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                    <span>Example Paper Title {paper.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: isOpen ? '#cbd5f5' : '#64748b' }}>
                      Example Paper Description {paper.label}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ marginBottom: 12, padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #eee' }}>
                    <strong style={{ display: 'block', marginBottom: 6, fontWeight: '600', fontSize: '14px', color: '#1b1b1bff' }}>Example Paper Titel {paper.label}</strong>
                    <p style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
                      {paper.description}
                    </p>
                    {papers.authors.map((author) => {
                      return(
                        <p style={{ fontSize: 12, color: '#555'}}>
                          <strong>Author:</strong> {author}
                        </p>
                      );
                    })}
                    <p style={{ fontSize: 12, color: '#555'}}>
                      <strong>Year:</strong> {paper.year}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a style={getButtonStyle()} href={paper.paper_url}>Link to Paper</a>
                    </div>
                    {papers.dataset_urls.map((dataset_url) => {
                      return(
                        <div style={{ display: 'flex', gap: 8 }}>
                          <a style={getButtonStyle()} href={dataset_url}>Link to Dataset</a>
                        </div>
                      );
                    })}
                  </div>
                )}
                </React.Fragment>
              );
            })}
            <>//Example begins here
              <button onClick={() => setActiveSection('paper1')} style={getMenuButtonStyle(activeSection === 'paper1')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                  <span>Example Paper Title 1</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: activeSection === 'paper1' ? '#cbd5f5' : '#64748b' }}>
                    Example Paper Description 1
                  </span>
                </div>
              </button>
              {(activeSection === 'paper1') && (
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
                  <span style={{ fontSize: 11, fontWeight: 500, color: activeSection === 'paper4' ? '#cbd5f5' : '#64748b' }}>
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
            </>//Example ends here
          </div>
        </div>
      )}
      {(evaluationsSearched && !evaluationsFound) && (
        <div style={{ marginBottom: 12, padding: 12, background: '#ff4f4f', borderRadius: 14, border: '1px solid #e5e7eb' }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', fontSize: 14, fontWeight: 700, color: '#7a0000', marginBottom: 10}}>
              <span>No Linked Papers found!</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#f5cbcb' }}>
                  It seems no similar Boxology has been evaluated in a paper in the database. 
                  This does not mean that no such paper exists.
              </span>
            </div>
            <button onClick={() => searchForEvaluations()} style={getButtonStyle()}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span>Search again</span>
              </div>
            </button>
          </div>
      )}
    </div>
  );
}