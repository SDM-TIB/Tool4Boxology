import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { API_BASE } from '../../config';

interface QueryExplorerDialogProps {
  open: boolean;
  onClose: () => void;
}

interface QueryItem {
  id: string;
  title: string;
  description: string;
  query: string;
  customizable?: boolean;
}

interface QueryGroup {
  id: string;
  title: string;
  items: QueryItem[];
}

interface QueryCategory {
  id: string;
  title: string;
  description: string;
  items?: QueryItem[];
  groups?: QueryGroup[];
}

const PREFIXES = `PREFIX t4b: <http://tool4boxology.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>`;

const DEFAULT_QUERY = `${PREFIXES}

SELECT ?boxology ?label
WHERE {
  ?boxology a t4b:Boxology ;
            rdfs:label ?label .
}
LIMIT 100`;

// One input -> one process -> one output
function singlePatternQuery(inputType: string, processType: string, outputType: string) {
  return `${PREFIXES}

SELECT ?pattern ?label ?input ?process ?output WHERE {
  ?pattern t4b:hasInput ?input ;
           t4b:hasProcess ?process ;
           t4b:hasOutput ?output ;
           rdfs:label ?label .
  ?input   a t4b:${inputType} .
  ?process a t4b:${processType} .
  ?output  a t4b:${outputType} .
}
LIMIT 100`;
}

// Two distinct inputs -> one process -> one output
function dualPatternQuery(input1Type: string, input2Type: string, processType: string, outputType: string) {
  return `${PREFIXES}

SELECT ?pattern ?label ?input1 ?input2 ?process ?output WHERE {
  ?pattern t4b:hasInput ?input1 , ?input2 ;
           t4b:hasProcess ?process ;
           t4b:hasOutput ?output ;
           rdfs:label ?label .
  ?input1  a t4b:${input1Type} .
  ?input2  a t4b:${input2Type} .
  ?process a t4b:${processType} .
  ?output  a t4b:${outputType} .
  FILTER(?input1 != ?input2)
}
LIMIT 100`;
}

const queryCategories: QueryCategory[] = [
  {
    id: 'explore',
    title: 'Explore the Graph',
    description: 'General-purpose queries to get an overview of everything stored in the knowledge graph.',
    items: [
      {
        id: 'list-boxologies',
        title: 'List all Boxologies',
        description: 'Every system (Boxology) stored in the graph, with its label.',
        query: DEFAULT_QUERY,
      },
      {
        id: 'boxology-pattern-counts',
        title: 'List Boxologies and pattern counts',
        description: 'Systems ranked by how many design patterns they contain.',
        query: `${PREFIXES}

SELECT (COUNT(DISTINCT ?pattern) AS ?patternCount) ?boxology ?boxologyLabel
WHERE {
  ?boxology a t4b:Boxology ;
            rdfs:label ?boxologyLabel ;
            t4b:hasPattern ?pattern .
}
GROUP BY ?boxology ?boxologyLabel
ORDER BY DESC(?patternCount)`,
      },
      {
        id: 'list-patterns',
        title: 'List all Design Patterns',
        description: 'Every design pattern in the graph, across all systems.',
        query: `${PREFIXES}

SELECT ?pattern ?label WHERE {
  ?pattern a t4b:DesignPattern ;
           rdfs:label ?label .
}
LIMIT 100`,
      },
      {
        id: 'list-component-types',
        title: 'List all component types used',
        description: 'The distinct component types (e.g. Data, Symbol, Model, Train...) present in the graph.',
        query: `PREFIX t4b: <http://tool4boxology.org/>

SELECT DISTINCT ?type WHERE {
  ?component a t4b:Component ;
             a ?type .
  FILTER(?type != t4b:Component)
}`,
      },
    ],
  },
  {
    id: 'elementary',
    title: 'Find Elementary Patterns',
    description: 'Find the basic building blocks of a Boxology: a single operation with its inputs and output.',
    groups: [
      {
        id: 'train',
        title: 'Train a Model',
        items: [
          { id: 'train-from-data', title: 'Train Model from Data', description: 'A model trained from raw/numeric data.', query: singlePatternQuery('Data', 'Train', 'Model') },
          { id: 'train-from-symbol', title: 'Train Model from Symbol', description: 'A model trained from symbolic data.', query: singlePatternQuery('Symbol', 'Train', 'Model') },
          { id: 'generate-model-from-data', title: 'Generate Model from Model + Data', description: 'An existing model refined/generated using data.', query: dualPatternQuery('Model', 'Data', 'Train', 'Model') },
          { id: 'generate-model-from-symbol', title: 'Generate Model from Model + Symbol', description: 'An existing model refined/generated using symbols.', query: dualPatternQuery('Model', 'Symbol', 'Train', 'Model') },
        ],
      },
      {
        id: 'transform',
        title: 'Transform',
        items: [
          { id: 'transform-symbol-data', title: 'Transform Symbol to Data', description: '', query: singlePatternQuery('Symbol', 'Transform', 'Data') },
          { id: 'transform-data-data', title: 'Transform Data to Data', description: '', query: singlePatternQuery('Data', 'Transform', 'Data') },
          { id: 'transform-data-symbol', title: 'Transform Data to Symbol', description: '', query: singlePatternQuery('Data', 'Transform', 'Symbol') },
          { id: 'transform-symbol-symbol', title: 'Transform Symbol to Symbol', description: '', query: singlePatternQuery('Symbol', 'Transform', 'Symbol') },
          { id: 'transform-model-model', title: 'Transform Model to Model', description: '', query: singlePatternQuery('Model', 'Transform', 'Model') },
          { id: 'transform-data-model-data', title: 'Transform Data + Model to Data', description: '', query: dualPatternQuery('Data', 'Model', 'Transform', 'Data') },
        ],
      },
      {
        id: 'engineer',
        title: 'Engineer',
        items: [
          { id: 'engineer-model', title: 'Actor Engineers a Model', description: '', query: singlePatternQuery('Actor', 'Engineer', 'Model') },
          { id: 'engineer-symbol', title: 'Actor Engineers a Symbol', description: '', query: singlePatternQuery('Actor', 'Engineer', 'Symbol') },
          { id: 'engineer-data', title: 'Actor Engineers Data', description: '', query: singlePatternQuery('Actor', 'Engineer', 'Data') },
        ],
      },
      {
        id: 'infer',
        title: 'Infer',
        items: [
          { id: 'infer-symbol-from-symbol', title: 'Infer Symbol from Symbol + Model', description: '', query: dualPatternQuery('Symbol', 'Model', 'Deduce', 'Symbol') },
          { id: 'infer-symbol-from-data', title: 'Infer Symbol from Data + Model', description: '', query: dualPatternQuery('Data', 'Model', 'Deduce', 'Symbol') },
          { id: 'infer-model-from-symbol', title: 'Infer Model from Symbol + Model', description: '', query: dualPatternQuery('Symbol', 'Model', 'Deduce', 'Model') },
          { id: 'infer-model-from-data', title: 'Infer Model from Data + Model', description: '', query: dualPatternQuery('Data', 'Model', 'Deduce', 'Model') },
          { id: 'infer-data-from-data', title: 'Infer Data from Data + Model', description: '', query: dualPatternQuery('Data', 'Model', 'Deduce', 'Data') },
          { id: 'infer-data-from-symbol', title: 'Infer Data from Symbol + Model', description: '', query: dualPatternQuery('Symbol', 'Model', 'Deduce', 'Data') },
        ],
      },
    ],
  },
  {
    id: 'kautz',
    title: 'Find Kautz Patterns',
    description: 'Find the six generic Kautz neuro-symbolic integration patterns (chains of two operations).',
    groups: [
      {
        id: 'kautz-variants',
        title: 'Find Kautz pattern',
        items: [
          {
            id: 'kautz-symbolic-to-neuro',
            title: 'Symbolic > Neuro (guided training then inference)',
            description: 'A model is trained using symbolic/data guidance, then a neural network uses it to infer an output.',
            query: `${PREFIXES}

SELECT ?boxology ?boxologyLabel ?trainPattern ?trainLabel ?deducePattern ?deduceLabel WHERE {
  ?boxology a t4b:Boxology ;
            rdfs:label ?boxologyLabel ;
            t4b:hasPattern ?trainPattern , ?deducePattern .

  ?trainPattern t4b:hasProcess ?train ;
                t4b:hasOutput  ?embedding ;
                rdfs:label ?trainLabel .
  ?train a t4b:Train .

  ?deducePattern t4b:hasProcess ?deduce ;
                 t4b:hasInput  ?embedding ;
                 rdfs:label ?deduceLabel .
  ?deduce a t4b:Deduce .

  FILTER(?trainPattern != ?deducePattern)
}
LIMIT 100`,
          },
          {
            id: 'kautz-neuro-to-symbolic',
            title: 'Neuro > Symbolic (a neural model produces a symbolic/data output)',
            description: 'A neural network is combined with an input to deduce a symbolic or data output.',
            query: `${PREFIXES}

SELECT ?pattern ?label ?input1 ?input2 ?output WHERE {
  ?pattern t4b:hasInput ?input1 , ?input2 ;
           t4b:hasProcess ?deduce ;
           t4b:hasOutput ?output ;
           rdfs:label ?label .
  ?deduce a t4b:Deduce .
  ?input2 a t4b:NeuralModel .
  FILTER(?input1 != ?input2)
}
LIMIT 100`,
          },
          {
            id: 'kautz-symbolic-guided-training',
            title: 'Symbolic-guided Neuro Training',
            description: 'Symbolic rules/annotations are deduced first, then used to train a neural model.',
            query: `${PREFIXES}

SELECT ?boxology ?boxologyLabel ?deducePattern ?deduceLabel ?trainPattern ?trainLabel WHERE {
  ?boxology a t4b:Boxology ;
            rdfs:label ?boxologyLabel ;
            t4b:hasPattern ?deducePattern , ?trainPattern .

  ?deducePattern t4b:hasProcess ?deduce ;
                 t4b:hasOutput  ?annotated ;
                 rdfs:label ?deduceLabel .
  ?deduce a t4b:Deduce .

  ?trainPattern t4b:hasProcess ?train ;
                t4b:hasInput  ?annotated ;
                rdfs:label ?trainLabel .
  ?train a t4b:Train .

  FILTER(?deducePattern != ?trainPattern)
}
LIMIT 100`,
          },
        ],
      },
    ],
  },
  {
    id: 'type-label',
    title: 'Find by Type & Label',
    description: 'Look up patterns by the type and label of one of their components. Edit the placeholders before running.',
    items: [
      {
        id: 'find-by-output',
        title: 'Find pattern by output type and label',
        description: 'Example: output type "Model", output label "id-model".',
        customizable: true,
        query: `${PREFIXES}

SELECT ?pattern ?label ?output WHERE {
  ?pattern t4b:hasOutput ?output ;
           rdfs:label ?label .
  ?output a t4b:REPLACE_WITH_OUTPUT_TYPE ;
          rdfs:label "REPLACE_WITH_OUTPUT_LABEL" .
}
LIMIT 100`,
      },
      {
        id: 'find-by-input',
        title: 'Find pattern by input type and label',
        description: 'Example: input type "Data", input label "id-data".',
        customizable: true,
        query: `${PREFIXES}

SELECT ?pattern ?label ?input WHERE {
  ?pattern t4b:hasInput ?input ;
           rdfs:label ?label .
  ?input a t4b:REPLACE_WITH_INPUT_TYPE ;
         rdfs:label "REPLACE_WITH_INPUT_LABEL" .
}
LIMIT 100`,
      },
    ],
  },
  {
    id: 'compare',
    title: 'Explore & Compare Systems',
    description: 'Find related patterns and systems, or compare two systems side by side. Edit the placeholders before running.',
    items: [
      {
        id: 'patterns-in-system',
        title: 'Find all patterns in a specific system',
        description: 'List every design pattern that belongs to one Boxology, by its label.',
        customizable: true,
        query: `${PREFIXES}

SELECT ?pattern ?patternLabel WHERE {
  ?boxology rdfs:label "REPLACE_WITH_BOXOLOGY_LABEL" ;
            t4b:hasPattern ?pattern .
  ?pattern rdfs:label ?patternLabel .
}
LIMIT 100`,
      },
      {
        id: 'similar-patterns',
        title: 'Find similar patterns',
        description: 'Other patterns anywhere in the graph that use the same kind of operation as a given pattern.',
        customizable: true,
        query: `${PREFIXES}

SELECT ?otherPattern ?otherLabel ?boxologyLabel WHERE {
  ?referencePattern rdfs:label "REPLACE_WITH_PATTERN_LABEL" ;
                     t4b:hasProcess ?refProcess .
  ?refProcess a ?processType .

  ?otherPattern t4b:hasProcess ?otherProcess ;
                rdfs:label ?otherLabel .
  ?otherProcess a ?processType .

  ?boxology t4b:hasPattern ?otherPattern ;
            rdfs:label ?boxologyLabel .

  FILTER(?otherPattern != ?referencePattern)
}
LIMIT 100`,
      },
      {
        id: 'similar-systems',
        title: 'Find similar systems',
        description: 'Other Boxologies ranked by how many operation types they share with a given system.',
        customizable: true,
        query: `${PREFIXES}

SELECT ?otherBoxology ?otherLabel (COUNT(DISTINCT ?sharedType) AS ?sharedPatternTypes) WHERE {
  ?refBoxology rdfs:label "REPLACE_WITH_BOXOLOGY_LABEL" ;
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
ORDER BY DESC(?sharedPatternTypes)
LIMIT 20`,
      },
      {
        id: 'compare-systems',
        title: 'Compare two systems',
        description: 'Compare how many patterns of each operation type two systems use, side by side.',
        customizable: true,
        query: `${PREFIXES}

SELECT ?processType (COUNT(DISTINCT ?patternA) AS ?countInSystemA) (COUNT(DISTINCT ?patternB) AS ?countInSystemB) WHERE {
  {
    ?boxologyA rdfs:label "REPLACE_WITH_SYSTEM_A_LABEL" ;
               t4b:hasPattern ?patternA .
    ?patternA t4b:hasProcess ?processA .
    ?processA a ?processType .
  }
  UNION
  {
    ?boxologyB rdfs:label "REPLACE_WITH_SYSTEM_B_LABEL" ;
               t4b:hasPattern ?patternB .
    ?patternB t4b:hasProcess ?processB .
    ?processB a ?processType .
  }
}
GROUP BY ?processType`,
      },
    ],
  },
];

function shortenUri(uri: string): string {
  if (uri.startsWith('http://tool4boxology.org/')) return 't4b:' + uri.slice('http://tool4boxology.org/'.length);
  if (uri.startsWith('http://www.w3.org/2000/01/rdf-schema#')) return 'rdfs:' + uri.slice('http://www.w3.org/2000/01/rdf-schema#'.length);
  return uri;
}

function formatBindingValue(binding?: { type: string; value: string }): string {
  if (!binding) return '';
  return binding.type === 'uri' ? shortenUri(binding.value) : binding.value;
}

const QueryExplorerDialog: React.FC<QueryExplorerDialogProps> = ({ open, onClose }) => {
  const [queryText, setQueryText] = useState(DEFAULT_QUERY);
  const [activeNotice, setActiveNotice] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (open) {
      setQueryText(DEFAULT_QUERY);
      setActiveNotice(null);
      setError(null);
      setHasRun(false);
      setColumns([]);
      setRows([]);
    }
  }, [open]);

  const handleSelectItem = (item: QueryItem) => {
    setQueryText(item.query);
    setError(null);
    setActiveNotice(
      item.customizable
        ? 'This is a template query — replace the ALL_CAPS placeholders (e.g. REPLACE_WITH_LABEL) with your own values before running.'
        : null
    );
  };

  const runQuery = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/t4b/sparql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Query failed (${res.status}): ${text || res.statusText}`);
      }
      const data = await res.json();
      setHasRun(true);

      if (typeof data?.boolean === 'boolean') {
        setColumns(['result']);
        setRows([{ result: String(data.boolean) }]);
        return;
      }

      const vars: string[] = data?.head?.vars || [];
      const bindings: Record<string, { type: string; value: string }>[] = data?.results?.bindings || [];
      setColumns(vars);
      setRows(
        bindings.map((binding) => {
          const row: Record<string, string> = {};
          vars.forEach((v) => {
            row[v] = formatBindingValue(binding[v]);
          });
          return row;
        })
      );
    } catch (err: any) {
      setError(err?.message || 'Query failed. Is the backend / Virtuoso endpoint reachable?');
      setColumns([]);
      setRows([]);
      setHasRun(true);
    } finally {
      setIsRunning(false);
    }
  };

  const openInVirtuoso = () => {
    const url = `http://localhost:8890/sparql?query=${encodeURIComponent(queryText)}&format=HTML`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { height: '92vh', maxHeight: 920 } }}>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Explore the Knowledge Graph</Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>Run SPARQL queries against Tool4Boxology and browse the results</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Prepared queries panel */}
        <Box
          sx={{
            width: sidebarOpen ? 300 : 0,
            flexShrink: 0,
            borderRight: sidebarOpen ? '1px solid #e5e7eb' : 'none',
            overflowY: sidebarOpen ? 'auto' : 'hidden',
            overflowX: 'hidden',
            bgcolor: '#fafafa',
            p: sidebarOpen ? 1 : 0,
            minHeight: 0,
            transition: 'width 0.15s ease, padding 0.15s ease',
          }}
        >
          {sidebarOpen && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 1, whiteSpace: 'nowrap' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b7280' }}>
                  PREPARED QUERIES
                </Typography>
                <Tooltip title="Hide this panel to make more room for results">
                  <IconButton size="small" onClick={() => setSidebarOpen(false)} aria-label="Collapse prepared queries panel">
                    <MenuOpenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {queryCategories.map((category) => (
                <Accordion key={category.id} disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{category.title}</Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>{category.description}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    {category.items && (
                      <List dense disablePadding>
                        {category.items.map((item) => (
                          <ListItemButton key={item.id} onClick={() => handleSelectItem(item)} sx={{ pl: 2 }}>
                            <ListItemText
                              primary={item.title}
                              secondary={item.description || undefined}
                              slotProps={{ primary: { fontSize: 13, fontWeight: 500 }, secondary: { fontSize: 11 } }}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    )}
                    {category.groups && category.groups.map((group) => (
                      <Accordion key={group.id} disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: 'transparent', ml: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>{group.title}</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                          <List dense disablePadding>
                            {group.items.map((item) => (
                              <ListItemButton key={item.id} onClick={() => handleSelectItem(item)} sx={{ pl: 3 }}>
                                <ListItemText
                                  primary={item.title}
                                  secondary={item.description || undefined}
                                  primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                                  secondaryTypographyProps={{ fontSize: 11 }}
                                />
                              </ListItemButton>
                            ))}
                          </List>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </>
          )}
        </Box>

        {/* Editor + results panel */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', p: 2, gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            {!sidebarOpen && (
              <Tooltip title="Show prepared queries">
                <IconButton size="small" onClick={() => setSidebarOpen(true)} aria-label="Expand prepared queries panel">
                  <MenuIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b7280' }}>SPARQL QUERY</Typography>
          </Box>

          {activeNotice && (
            <Alert severity="info" onClose={() => setActiveNotice(null)} sx={{ flexShrink: 0 }}>
              {activeNotice}
            </Alert>
          )}

          <Box
            component="textarea"
            value={queryText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQueryText(e.target.value)}
            spellCheck={false}
            sx={{
              flexShrink: 0,
              width: '100%',
              height: 150,
              minHeight: 90,
              maxHeight: 260,
              fontSize: 13,
              fontFamily: 'Consolas, Menlo, monospace',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: 1,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={runQuery} disabled={isRunning || !queryText.trim()}>
              {isRunning ? 'Running...' : 'Run Query'}
            </Button>
            <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={() => { setQueryText(DEFAULT_QUERY); setActiveNotice(null); }}>
              Reset
            </Button>
            <Tooltip title="Open raw results in Virtuoso's own results page">
              <Button variant="text" startIcon={<OpenInNewIcon />} onClick={openInVirtuoso}>
                Open in Virtuoso
              </Button>
            </Tooltip>
            {isRunning && <CircularProgress size={18} sx={{ ml: 1 }} />}
          </Box>

          {error && <Alert severity="error" sx={{ flexShrink: 0 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <TableChartOutlinedIcon fontSize="small" sx={{ color: '#6b7280' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b7280' }}>RESULTS</Typography>
            </Box>
            {rows.length > 0 && (
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>
                {rows.length} row{rows.length === 1 ? '' : 's'} &middot; {columns.length} column{columns.length === 1 ? '' : 's'}
              </Typography>
            )}
          </Box>

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', bgcolor: '#fff' }}
          >
            {isRunning && (
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {rows.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: '#9ca3af' }}>
                <Typography variant="body2">
                  {hasRun ? 'No results for this query.' : 'Run a query to see results here.'}
                </Typography>
              </Box>
            ) : (
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 700, bgcolor: '#f3f4f6', whiteSpace: 'nowrap' }}>{col}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx} hover sx={{ '&:nth-of-type(odd)': { bgcolor: '#fafafa' } }}>
                      {columns.map((col) => (
                        <TableCell
                          key={col}
                          sx={{ fontFamily: 'Consolas, Menlo, monospace', fontSize: 12.5, wordBreak: 'break-word', verticalAlign: 'top' }}
                        >
                          {row[col]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          {rows.length > 0 && (
            <Typography variant="caption" sx={{ color: '#6b7280' }}>{rows.length} row{rows.length === 1 ? '' : 's'}</Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default QueryExplorerDialog;
