import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  TextField,
  Autocomplete,
  Alert,
  CircularProgress,
  LinearProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { API_BASE } from '../../config';
import { colors, shadows } from '../../styles/theme';

type ScopeMode = 'all' | 'label' | 'recent';

type CompiledCheck = {
  id: string;
  shapeName: string;
  path: string;
  constraint: string;
  message: string;
  severity: 'Violation' | 'Warning' | 'Info';
  kind: 'property' | 'sparql' | 'unsupported';
  sparql: string | null;
  reason?: string;
};

type CheckStatus = 'pending' | 'running' | 'pass' | 'fail' | 'error' | 'skipped';

type CheckResult = {
  status: CheckStatus;
  violations: Record<string, string>[];
  errorMessage?: string;
};

type SparqlJsonResult = {
  head?: { vars?: string[] };
  results?: { bindings?: Record<string, { type: string; value: string }>[] };
};

type Props = {
  open: boolean;
  onClose: () => void;
  recentBoxology: { id: string; label: string } | null;
};

const T4B = 'http://tool4boxology.org/';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const TRAVERSAL = `<${T4B}hasPattern>|<${T4B}hasInput>|<${T4B}hasOutput>|<${T4B}hasProcess>`;

function shortenUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith(T4B)) return 't4b:' + uri.slice(T4B.length);
  if (uri.startsWith(RDFS)) return 'rdfs:' + uri.slice(RDFS.length);
  return uri;
}

const PLACEHOLDER = `Paste SHACL shapes here (e.g. the contents of T4B-KG.ttl)...`;

const SEVERITY_COLOR: Record<CompiledCheck['severity'], string> = {
  Violation: colors.semantic.danger.main,
  Warning: '#b45309',
  Info: colors.semantic.info.main,
};

function statusIcon(status: CheckStatus, severity?: CompiledCheck['severity']) {
  if (status === 'fail') {
    if (severity === 'Warning') return <WarningAmberIcon fontSize="small" sx={{ color: SEVERITY_COLOR.Warning }} />;
    if (severity === 'Info') return <InfoOutlinedIcon fontSize="small" sx={{ color: SEVERITY_COLOR.Info }} />;
    return <CancelIcon fontSize="small" sx={{ color: SEVERITY_COLOR.Violation }} />;
  }
  switch (status) {
    case 'pass': return <CheckCircleIcon fontSize="small" sx={{ color: colors.semantic.success.main }} />;
    case 'error': return <ErrorOutlineIcon fontSize="small" sx={{ color: '#b45309' }} />;
    case 'running': return <CircularProgress size={16} />;
    case 'skipped': return <HelpOutlineIcon fontSize="small" sx={{ color: '#9ca3af' }} />;
    default: return <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #d1d5db' }} />;
  }
}

function SectionHeader({ step, title, complete }: { step: number; title: string; complete?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: complete ? colors.semantic.success.main : colors.primary.main,
          color: 'white',
        }}
      >
        {complete ? <CheckIcon sx={{ fontSize: 14 }} /> : step}
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#374151' }}>{title}</Typography>
    </Stack>
  );
}

function ScopeCard({
  selected,
  disabled,
  icon,
  title,
  description,
  onSelect,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Box
      role="radio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
      }}
      sx={{
        flex: 1,
        minWidth: 220,
        p: 1.75,
        borderRadius: 2.5,
        border: '2px solid',
        borderColor: selected ? colors.primary.main : '#e5e7eb',
        bgcolor: selected ? colors.primary.lighter : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        outline: 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
        '&:hover': disabled ? {} : { borderColor: colors.primary.light, boxShadow: shadows.sm },
        '&:focus-visible': { boxShadow: `0 0 0 3px ${colors.primary.lighter}` },
      }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1.25}>
        <Box sx={{ color: selected ? colors.primary.main : '#9ca3af', mt: 0.25, display: 'flex' }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#1f2937' }}>{title}</Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block' }}>{description}</Typography>
          {children}
        </Box>
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            flexShrink: 0,
            mt: 0.25,
            border: selected ? 'none' : '2px solid #d1d5db',
            bgcolor: selected ? colors.primary.main : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'white' }} />}
        </Box>
      </Stack>
    </Box>
  );
}

export default function ShaclValidationDialog({ open, onClose, recentBoxology }: Props) {
  const [shapesText, setShapesText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [scopeLabel, setScopeLabel] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checks, setChecks] = useState<CompiledCheck[]>([]);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [runProgress, setRunProgress] = useState(0);
  const [resultFilter, setResultFilter] = useState<'all' | 'fail' | 'pass' | 'skipped'>('all');
  const [boxologyLabels, setBoxologyLabels] = useState<string[]>([]);
  const [loadingBoxologies, setLoadingBoxologies] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const hasShapes = shapesText.trim().length > 0;
  const lineCount = shapesText ? shapesText.split('\n').length : 0;

  useEffect(() => {
    if (!open) return;
    cancelRef.current = false;

    // Offer real boxology labels as suggestions for "check against a specific
    // Boxology" instead of making the user recall/retype an exact label.
    setLoadingBoxologies(true);
    const query = `SELECT DISTINCT ?label WHERE { ?b a <${T4B}Boxology> ; <${RDFS}label> ?label } ORDER BY ?label`;
    fetch(`${API_BASE}/api/t4b/sparql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: SparqlJsonResult) => {
        const bindings = data?.results?.bindings || [];
        setBoxologyLabels(bindings.map((b) => b.label?.value).filter((v): v is string => Boolean(v)));
      })
      .catch(() => setBoxologyLabels([]))
      .finally(() => setLoadingBoxologies(false));
  }, [open]);

  const resetRun = () => {
    setChecks([]);
    setResults({});
    setStatusMessage(null);
    setRunProgress(0);
    setResultFilter('all');
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setShapesText(text);
    setFileName(file.name);
    setShowEditor(false);
    resetRun();
  };

  const clearShapes = () => {
    setShapesText('');
    setFileName(null);
    setShowEditor(false);
    resetRun();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onEditorDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDropzoneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  async function runSparql(query: string): Promise<SparqlJsonResult> {
    const res = await fetch(`${API_BASE}/api/t4b/sparql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Query failed (${res.status}): ${text || res.statusText}`);
    }
    return res.json();
  }

  async function resolveScopeNodes(): Promise<Set<string>> {
    let rootPattern: string;
    if (scopeMode === 'label') {
      const label = scopeLabel.trim();
      if (!label) throw new Error('Enter the boxology label to validate against.');
      const escaped = label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      rootPattern = `?root a <${T4B}Boxology> ; <${RDFS}label> "${escaped}" .`;
    } else {
      if (!recentBoxology) {
        throw new Error('No Knowledge Graph has been created yet in this session. Click "Create KG" first, then run this check.');
      }
      rootPattern = `BIND(<${T4B}Boxology/${recentBoxology.id}> AS ?root)\n  ?root a <${T4B}Boxology> .`;
    }

    const query = `SELECT DISTINCT ?node WHERE {\n  ${rootPattern}\n  ?root (${TRAVERSAL})* ?node .\n}`;
    const data = await runSparql(query);
    const bindings = data?.results?.bindings || [];
    const nodes = new Set<string>(bindings.map((b) => b.node?.value).filter((v): v is string => Boolean(v)));
    if (nodes.size === 0) {
      const what = scopeMode === 'label' ? `a boxology labeled "${scopeLabel.trim()}"` : 'the recently created boxology';
      throw new Error(`Could not find ${what} in the knowledge graph on Virtuoso.`);
    }
    return nodes;
  }

  async function runOneCheck(check: CompiledCheck, scopeNodes: Set<string> | null): Promise<CheckResult> {
    if (check.kind === 'unsupported' || !check.sparql) {
      return { status: 'skipped', violations: [] };
    }
    try {
      const data = await runSparql(check.sparql);
      const vars: string[] = data?.head?.vars || [];
      const bindings: Record<string, { type: string; value: string }>[] = data?.results?.bindings || [];
      let rows = bindings.map((binding) => {
        const row: Record<string, string> = {};
        vars.forEach((v) => { if (binding[v]) row[v] = binding[v].value; });
        return row;
      });
      if (scopeNodes) {
        rows = rows.filter((row) => row.this && scopeNodes.has(row.this));
      }
      return { status: rows.length > 0 ? 'fail' : 'pass', violations: rows };
    } catch (err: any) {
      return { status: 'error', violations: [], errorMessage: err?.message || 'Query failed.' };
    }
  }

  const handleRun = async () => {
    if (!shapesText.trim()) {
      setStatusMessage('Upload or paste a SHACL shapes file first.');
      return;
    }
    resetRun();
    setIsCompiling(true);
    cancelRef.current = false;

    let compiledChecks: CompiledCheck[] = [];
    try {
      const res = await fetch(`${API_BASE}/api/shacl/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shapes_ttl: shapesText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || `Could not compile shapes (${res.status})`);
      compiledChecks = data.checks || [];
    } catch (err: any) {
      setIsCompiling(false);
      setStatusMessage(err?.message || 'Failed to compile the SHACL shapes file.');
      return;
    }
    setIsCompiling(false);
    setChecks(compiledChecks);
    const initialResults: Record<string, CheckResult> = {};
    compiledChecks.forEach((c) => { initialResults[c.id] = { status: 'pending', violations: [] }; });
    setResults(initialResults);

    if (compiledChecks.length === 0) {
      setStatusMessage('No checkable shapes were found (every shape needs sh:targetClass or sh:targetNode).');
      return;
    }

    setIsRunning(true);
    let scopeNodes: Set<string> | null = null;
    if (scopeMode !== 'all') {
      try {
        scopeNodes = await resolveScopeNodes();
      } catch (err: any) {
        setStatusMessage(err?.message || 'Could not resolve the validation scope.');
        setIsRunning(false);
        return;
      }
    }

    for (let i = 0; i < compiledChecks.length; i++) {
      if (cancelRef.current) break;
      const check = compiledChecks[i];
      setRunProgress(i + 1);
      setResults((prev) => ({ ...prev, [check.id]: { status: 'running', violations: [] } }));
      const result = await runOneCheck(check, scopeNodes);
      setResults((prev) => ({ ...prev, [check.id]: result }));
    }
    setIsRunning(false);
  };

  const handleStop = () => {
    cancelRef.current = true;
  };

  const handleClose = () => {
    cancelRef.current = true;
    onClose();
  };

  const copySparql = async (id: string, sparql: string) => {
    try {
      await navigator.clipboard.writeText(sparql);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // Clipboard API unavailable/blocked - the query text is still visible to copy by hand.
    }
  };

  const summary = useMemo(() => {
    let passed = 0, failed = 0, violations = 0, errored = 0, skipped = 0, pending = 0;
    checks.forEach((c) => {
      const s = results[c.id]?.status;
      if (s === 'pass') passed++;
      else if (s === 'fail') {
        failed++;
        if (c.severity === 'Violation') violations++;
      } else if (s === 'error') errored++;
      else if (s === 'skipped') skipped++;
      else pending++;
    });
    const finished = checks.length > 0 && pending === 0;
    return { passed, failed, violations, errored, skipped, pending, total: checks.length, finished, conforms: violations === 0 };
  }, [checks, results]);

  const filteredChecks = useMemo(() => {
    if (resultFilter === 'all') return checks;
    return checks.filter((c) => {
      const s = results[c.id]?.status;
      if (resultFilter === 'fail') return s === 'fail';
      if (resultFilter === 'pass') return s === 'pass';
      return s === 'skipped' || s === 'error';
    });
  }, [checks, results, resultFilter]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      slotProps={{ paper: { sx: { height: '90vh', maxHeight: 900, borderRadius: 3, overflow: 'hidden', boxShadow: shadows.xl } } }}
    >
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          py: 2.25,
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <RuleOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>SHACL Constraint Validation</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Check the Knowledge Graph against a SHACL shapes file, constraint by constraint
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={handleClose} sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f7f7fb' }}>
        <Box sx={{ flex: 1, overflow: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Step 1: shapes source */}
          <Box>
            <SectionHeader step={1} title="Provide SHACL shapes" complete={hasShapes} />

            {!hasShapes && !showEditor && (
              <Stack gap={0.5} sx={{ alignItems: 'flex-start' }}>
                <Box
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={onDropzoneDrop}
                  sx={{
                    width: '100%',
                    border: '2px dashed',
                    borderColor: isDragOver ? colors.primary.main : '#d1d5db',
                    borderRadius: 3,
                    bgcolor: isDragOver ? colors.primary.lighter : '#fff',
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: colors.primary.light, bgcolor: '#fafaff' },
                  }}
                >
                  <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: isDragOver ? colors.primary.main : '#9ca3af', mb: 0.5 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>
                    Drag &amp; drop a SHACL shapes file, or click to browse
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>.ttl or .turtle - e.g. T4B-KG.ttl</Typography>
                  <input ref={fileInputRef} type="file" accept=".ttl,.turtle,text/turtle" hidden onChange={onFileInputChange} />
                </Box>
                <Button size="small" variant="text" onClick={() => setShowEditor(true)} sx={{ textTransform: 'none' }}>
                  or paste shapes as text instead
                </Button>
              </Stack>
            )}

            {hasShapes && !showEditor && (
              <Stack direction="row" alignItems="center" gap={1.5} sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e5e7eb', bgcolor: '#fff' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: colors.primary.lighter, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <DescriptionOutlinedIcon sx={{ color: colors.primary.main, fontSize: 20 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fileName || 'Pasted shapes'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>{lineCount} line{lineCount === 1 ? '' : 's'}</Typography>
                </Box>
                <Button size="small" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => setShowEditor(true)} sx={{ textTransform: 'none' }}>
                  Edit
                </Button>
                <Tooltip title="Remove">
                  <IconButton size="small" onClick={clearShapes}><CloseIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
            )}

            {showEditor && (
              <Box>
                <Box
                  component="textarea"
                  value={shapesText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setShapesText(e.target.value); resetRun(); }}
                  onDragOver={(e: React.DragEvent) => e.preventDefault()}
                  onDrop={onEditorDrop}
                  placeholder={PLACEHOLDER}
                  spellCheck={false}
                  autoFocus
                  sx={{
                    width: '100%',
                    height: 180,
                    minHeight: 100,
                    maxHeight: 320,
                    fontSize: 12.5,
                    fontFamily: 'Consolas, Menlo, monospace',
                    p: 1.5,
                    border: '1px solid #d1d5db',
                    borderRadius: 2.5,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    '&:focus': { outline: 'none', borderColor: colors.primary.main, boxShadow: `0 0 0 3px ${colors.primary.lighter}` },
                  }}
                />
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>You can also drag a file directly onto this box</Typography>
                  {hasShapes && (
                    <Button size="small" onClick={() => setShowEditor(false)} sx={{ textTransform: 'none' }}>Done editing</Button>
                  )}
                </Stack>
              </Box>
            )}
          </Box>

          {/* Step 2: scope */}
          <Box>
            <SectionHeader step={2} title="Choose what to check" />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ alignItems: 'stretch' }}>
              <ScopeCard
                selected={scopeMode === 'all'}
                icon={<HubOutlinedIcon />}
                title="Whole Knowledge Graph"
                description="Everything currently stored in Virtuoso"
                onSelect={() => setScopeMode('all')}
              />
              <ScopeCard
                selected={scopeMode === 'label'}
                icon={<LabelOutlinedIcon />}
                title="A specific Boxology"
                description="Pick a system by its label"
                onSelect={() => setScopeMode('label')}
              >
                <Autocomplete
                  size="small"
                  freeSolo
                  loading={loadingBoxologies}
                  options={boxologyLabels}
                  inputValue={scopeLabel}
                  onInputChange={(_, value) => { setScopeLabel(value); setScopeMode('label'); }}
                  onOpen={() => setScopeMode('label')}
                  sx={{ mt: 1 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="e.g. T4B-1"
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingBoxologies ? <CircularProgress size={14} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                />
              </ScopeCard>
              <ScopeCard
                selected={scopeMode === 'recent'}
                disabled={!recentBoxology}
                icon={<HistoryOutlinedIcon />}
                title="Recently created KG"
                description={recentBoxology ? `"${recentBoxology.label}" - created this session` : 'Click "Create KG" first'}
                onSelect={() => setScopeMode('recent')}
              />
            </Stack>
          </Box>

          {/* Step 3: run + results */}
          <Box>
            <SectionHeader step={3} title="Run &amp; review results" />

            <Stack direction="row" gap={1.25} alignItems="center" sx={{ mb: 1.5 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={isCompiling || isRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                onClick={handleRun}
                disabled={isCompiling || isRunning || !shapesText.trim()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: 2.5,
                  px: 3,
                  bgcolor: colors.primary.main,
                  boxShadow: shadows.sm,
                  '&:hover': { bgcolor: colors.primary.dark },
                }}
              >
                {isCompiling ? 'Compiling shapes...' : isRunning ? `Running ${runProgress}/${checks.length}...` : 'Run SHACL Validation'}
              </Button>
              {isRunning && (
                <Button variant="outlined" color="error" startIcon={<StopIcon />} onClick={handleStop} sx={{ textTransform: 'none', borderRadius: 2.5 }}>
                  Stop
                </Button>
              )}
            </Stack>

            {isRunning && checks.length > 0 && (
              <LinearProgress
                variant="determinate"
                value={(runProgress / checks.length) * 100}
                sx={{ borderRadius: 999, height: 6, mb: 1.5, bgcolor: '#eef0f6', '& .MuiLinearProgress-bar': { borderRadius: 999 } }}
              />
            )}

            {statusMessage && <Alert severity="warning" sx={{ mb: 1.5 }} onClose={() => setStatusMessage(null)}>{statusMessage}</Alert>}

            {summary.finished && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2.25,
                  mb: 1.5,
                  borderRadius: 3,
                  bgcolor: summary.conforms ? '#f0fdf4' : '#fef2f2',
                  border: '1px solid',
                  borderColor: summary.conforms ? '#bbf7d0' : '#fecaca',
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: summary.conforms ? colors.semantic.success.main : colors.semantic.danger.main,
                    color: 'white',
                  }}
                >
                  {summary.conforms ? <CheckCircleIcon /> : <CancelIcon />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: summary.conforms ? '#166534' : '#991b1b' }}>
                    {summary.conforms ? 'Conforms' : 'Does not conform'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: summary.conforms ? '#15803d' : '#b91c1c' }}>
                    {summary.conforms
                      ? `All ${summary.passed} evaluated constraint${summary.passed === 1 ? '' : 's'} passed.`
                      : `${summary.violations} violation${summary.violations === 1 ? '' : 's'} found across ${summary.total} constraints checked.`}
                  </Typography>
                  {(summary.failed > summary.violations || summary.errored > 0 || summary.skipped > 0) && (
                    <Typography variant="caption" sx={{ color: '#78716c', display: 'block', mt: 0.5 }}>
                      {summary.failed > summary.violations && `${summary.failed - summary.violations} additional warning/info-level issue(s). `}
                      {summary.errored > 0 && `${summary.errored} check(s) errored - results may be incomplete. `}
                      {summary.skipped > 0 && `${summary.skipped} constraint(s) not supported by this validator.`}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {checks.length > 0 && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={resultFilter}
                onChange={(_, v) => v && setResultFilter(v)}
                sx={{
                  mb: 1.5,
                  bgcolor: '#eef0f6',
                  borderRadius: 999,
                  p: 0.5,
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    borderRadius: 999,
                    px: 1.75,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: '#6b7280',
                    '&.Mui-selected': { bgcolor: 'white', color: colors.primary.dark, boxShadow: shadows.sm, '&:hover': { bgcolor: 'white' } },
                  },
                }}
              >
                <ToggleButton value="all">All {summary.total}</ToggleButton>
                <ToggleButton value="fail">Failed {summary.failed}</ToggleButton>
                <ToggleButton value="pass">Passed {summary.passed}</ToggleButton>
                <ToggleButton value="skipped">Not evaluated {summary.skipped + summary.errored}</ToggleButton>
              </ToggleButtonGroup>
            )}

            {checks.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: '#9ca3af' }}>
                <Typography variant="body2">Provide shapes and run validation to see per-constraint results here.</Typography>
              </Box>
            ) : filteredChecks.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: '#9ca3af' }}>
                <Typography variant="body2">No checks match this filter.</Typography>
              </Box>
            ) : (
              filteredChecks.map((check) => {
                const result = results[check.id] || { status: 'pending' as CheckStatus, violations: [] };
                const label = `${check.shapeName} — ${check.path} (${check.constraint})`;
                const accentColor = result.status === 'fail' ? SEVERITY_COLOR[check.severity] : 'transparent';
                return (
                  <Accordion
                    key={check.id}
                    disableGutters
                    elevation={0}
                    sx={{
                      borderRadius: '14px !important',
                      overflow: 'hidden',
                      border: '1px solid #eef0f3',
                      borderLeft: '4px solid',
                      borderLeftColor: accentColor,
                      boxShadow: shadows.sm,
                      mb: 1.25,
                      '&:before': { display: 'none' },
                      '&.Mui-expanded': { margin: 0, mb: 1.25 },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 56, '&:hover': { bgcolor: '#fafafa' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
                        {statusIcon(result.status, check.severity)}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {check.message}
                          </Typography>
                        </Box>
                        {result.status === 'fail' && (
                          <Chip
                            size="small"
                            label={`${result.violations.length} violation${result.violations.length === 1 ? '' : 's'}`}
                            sx={{ bgcolor: SEVERITY_COLOR[check.severity], color: 'white', fontWeight: 600 }}
                          />
                        )}
                        {check.severity !== 'Violation' && <Chip size="small" label={check.severity} variant="outlined" />}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: '#fcfcfd', borderTop: '1px solid #f1f1f4' }}>
                      {check.kind === 'unsupported' ? (
                        <Alert severity="info" sx={{ mb: 1 }}>{check.reason}</Alert>
                      ) : (
                        <>
                          {result.status === 'error' && <Alert severity="error" sx={{ mb: 1 }}>{result.errorMessage}</Alert>}
                          {result.status === 'fail' && (
                            <Box sx={{ mb: 1.5 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280' }}>VIOLATING NODES</Typography>
                              <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 180, overflow: 'auto' }}>
                                {result.violations.slice(0, 50).map((row, idx) => (
                                  <Box component="li" key={idx} sx={{ fontFamily: 'Consolas, Menlo, monospace', fontSize: 12.5 }}>
                                    {Object.entries(row).filter(([k]) => !k.startsWith('__')).map(([k, v]) => (
                                      <span key={k} style={{ marginRight: 12 }}>
                                        <strong>{k}</strong>: {shortenUri(v)}
                                      </span>
                                    ))}
                                  </Box>
                                ))}
                                {result.violations.length > 50 && (
                                  <Box component="li" sx={{ color: '#6b7280' }}>...and {result.violations.length - 50} more</Box>
                                )}
                              </Box>
                            </Box>
                          )}
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Stack direction="row" alignItems="center" gap={0.5}>
                              <CodeOutlinedIcon sx={{ fontSize: 15, color: '#6b7280' }} />
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280' }}>SPARQL QUERY</Typography>
                            </Stack>
                            <Tooltip title={copiedId === check.id ? 'Copied!' : 'Copy query'}>
                              <IconButton size="small" onClick={() => check.sparql && copySparql(check.id, check.sparql)}>
                                {copiedId === check.id
                                  ? <CheckIcon fontSize="small" sx={{ color: colors.semantic.success.main }} />
                                  : <ContentCopyOutlinedIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              p: 1.5,
                              bgcolor: '#1e1e2e',
                              color: '#cdd6f4',
                              borderRadius: 2,
                              fontSize: 11.5,
                              fontFamily: 'Consolas, Menlo, monospace',
                              overflow: 'auto',
                              maxHeight: 160,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.6,
                            }}
                          >
                            {check.sparql}
                          </Box>
                        </>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid #eef0f3', flexShrink: 0 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
