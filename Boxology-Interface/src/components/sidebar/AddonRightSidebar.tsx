import React, { useEffect, useRef, useState } from 'react';
import type * as go from 'gojs';
import { getButtonStyle, getMenuButtonStyle } from '../../styles/buttonStyles';

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
  isKgGenerated: boolean;
  showToast: (message: string, type: 'warning') => void;
}

interface Paper {
  id: string;
  label: string;
  matchingCount: string;
  authors: string[];
  dataset_urls: string[];
  paper_url: string;
  description: string;
  year: string;
}
interface Binding {
  type: string;
  value: string;
}

// Only render web links. The current query does not select publication metadata.
function safeUrl(value?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

const PREFIXES = `PREFIX t4b: <http://tool4boxology.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

// JSON string escapes also protect quotes, backslashes and newlines in SPARQL literals.
function escapeLiteral(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

// Preserve the original count-based pattern comparison.
// This score describes matching type combinations, not complete graph equivalence.
function buildQuery(label: string): string {
  return `${PREFIXES}

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
                FILTER(?otherLabel != "${escapeLiteral(label)}")

                OPTIONAL {
                  ?boxologyB rdfs:label "${escapeLiteral(label)}" ;
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
            `;
}

export default function AddonRightSidebar({
  diagramRef, pages, currentPageId, isKgGenerated, showToast,
}: RightSidebarProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const currentPage = pages.find((page) => page.id === currentPageId);
  const pageLabel = currentPage?.boxologyLabel;

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setActiveSection(null);
    setPapers([]);
    setIsRunning(false);
    setHasSearched(false);
    setError(null);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [currentPageId, pageLabel, isKgGenerated]);

  const searchForEvaluations = async () => {
    if (!isKgGenerated) {
      showToast('No Knowledge Graph is available. Create the KG first.', 'warning');
      return;
    }
    const label = pageLabel || diagramRef.current?.model.modelData?.boxologyLabel;
    if (typeof label !== 'string' || !label.trim()) {
      setError('No Boxology label is available for the current page.');
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsRunning(true);
    setError(null);
    setHasSearched(false);
    setPapers([]);
    setActiveSection(null);
    try {
      const response = await fetch('/detrusty/sparql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/sparql-results+json, application/json',
        },
        signal: controller.signal,
        body: new URLSearchParams({ query: buildQuery(label) }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Query failed (${response.status}): ${detail || response.statusText}`);
      }
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('DeTrusty returned a non-JSON response. Check the Vite proxy and /sparql route.');
      }
      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }
      if (!Array.isArray(data?.results?.bindings)) {
        throw new Error('The endpoint did not return SPARQL SELECT results.');
      }
      if (requestRef.current !== controller) return;
      const bindings = data.results.bindings as Record<string, Binding>[];
      const unique = new Map<string, Paper>();
      for (const binding of bindings) {
        const id = binding.boxology?.value;
        if (!id) continue;
        unique.set(id, {
          id,
          label: binding.otherLabel?.value || id,
          matchingCount: binding.sameCount?.value || '0',
          authors: Array.from(new Set([...(unique.get(id)?.authors || []), ...(binding.author?.value ? [binding.author.value] : [])])),
          dataset_urls: Array.from(new Set([...(unique.get(id)?.dataset_urls || []), ...(safeUrl(binding.dataset_url?.value) ? [safeUrl(binding.dataset_url?.value)] : [])])),
          paper_url: safeUrl(binding.paper_url?.value) || unique.get(id)?.paper_url || '',
          description: binding.description?.value || unique.get(id)?.description || '',
          year: binding.year?.value || unique.get(id)?.year || '',
        });
      }
      setPapers(Array.from(unique.values()));
      setHasSearched(true);
    } catch (cause: unknown) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setError(cause instanceof Error ? cause.message : 'Failed to query the knowledge graph.');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsRunning(false);
      }
    }
  };

  return (
    <div style={{ width: 300, background: '#f9f9f9', padding: 12,
      overflowY: 'auto', height: '100%', borderLeft: '1px solid #ddd', fontSize: 13 }}>
      <div style={{ padding: 12, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
        <strong style={{ display: 'block', marginBottom: 10, color: '#6b7280' }}>
          LINKED PAPERS / BOXOLOGIES
        </strong>
        {!isKgGenerated && <p>Generate the Knowledge Graph before searching for linked papers.</p>}
        {isKgGenerated && !hasSearched && !isRunning && !error && (
          <p>The Knowledge Graph is ready. Search for matching Boxologies.</p>
        )}
        {error && <p role="alert" style={{ color: '#b91c1c', overflowWrap: 'anywhere' }}>{error}</p>}
        {isRunning && <p role="status">Searching for matching Boxologies…</p>}
        {hasSearched && papers.length === 0 && (
          <p>No matching Boxologies were found in the database. This does not mean that no relevant paper exists.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {papers.map((paper) => {
            const isOpen = activeSection === paper.id;
            return (
              <div key={paper.id}>
                <button type="button" aria-expanded={isOpen}
                  onClick={() => setActiveSection(isOpen ? null : paper.id)}
                  style={getMenuButtonStyle(isOpen)}>
                  {paper.label}
                </button>
                {isOpen && (
                  <div style={{ padding: 8, marginTop: 6, border: '1px solid #eee', borderRadius: 6 }}>
                    <strong>{paper.label}</strong>
                    <p>Matching count: {paper.matchingCount}</p>
                    <p style={{ overflowWrap: 'anywhere' }}>Boxology: {paper.id}</p>
                    {paper.description && <p>{paper.description}</p>}
                    {paper.authors.map((author) => <p key={author}>Author: {author}</p>)}
                    {paper.year && <p>Year: {paper.year}</p>}
                    {paper.paper_url && <p><a href={paper.paper_url} target="_blank" rel="noopener noreferrer">Open paper</a></p>}
                    {paper.dataset_urls.map((url) => (
                      <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">Open dataset</a></p>
                    ))}
                    {!paper.paper_url && <p>Publication metadata is not returned by the current query.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" disabled={isRunning} onClick={() => void searchForEvaluations()}
          style={{ ...getButtonStyle(), marginTop: 10 }}>
          {isRunning ? 'Searching…' : hasSearched || error ? 'Search again' : 'Search'}
        </button>
      </div>
    </div>
  );
}
