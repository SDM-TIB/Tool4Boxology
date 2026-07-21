import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { API_BASE } from '../../config';
import { colors } from '../../styles/theme';

const DEFAULT_HF_MODEL_ID = 'openai/gpt-oss-120b:fastest';
const DEFAULT_DESCRIPTION = `A radiology assistant uses MRI scans and clinical notes.
The system preprocesses images, trains a segmentation model from expert labels,
uses the trained model to predict tumor regions, and produces an explanation
that links the prediction back to image evidence and clinical rules.`;

type GeneratedBoxology = {
  filename: string;
  explanation: string;
  boxology: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/boxology;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function BoxologyGeneratorDialog({ open, onClose }: Props) {
  const [hfToken, setHfToken] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_HF_MODEL_ID);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedBoxology | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setHfToken(localStorage.getItem('hf_token') || '');
    setModelId(localStorage.getItem('model_id') || DEFAULT_HF_MODEL_ID);
  }, [open]);

  const handleGenerate = async () => {
    setError('');
    setGenerated(null);

    if (!hfToken.trim()) {
      setError('Set a Hugging Face token with Inference Providers permission first.');
      return;
    }
    if (!description.trim()) {
      setError('Describe the system you want to convert into Boxology.');
      return;
    }

    localStorage.setItem('hf_token', hfToken.trim());
    localStorage.setItem('model_id', modelId.trim() || DEFAULT_HF_MODEL_ID);
    setIsGenerating(true);

    try {
      const response = await fetch(`${API_BASE}/api/llm/boxology`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hf_token: hfToken.trim(),
          model_id: modelId.trim() || DEFAULT_HF_MODEL_ID,
          description: description.trim()
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `Generation failed: ${response.status}`);
      }

      setGenerated({
        filename: data.filename || 'ai_generated_boxology.boxology',
        explanation: data.explanation || 'Generated a Tool4Boxology file.',
        boxology: data.boxology
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Boxology file.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={isGenerating ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon fontSize="small" />
        Generate Boxology from Text
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
        <Alert severity="info">
          Describe a neuro-symbolic system in natural language. Hosted Hugging Face inference
          will return a Tool4Boxology file that you can download and open in the editor.
        </Alert>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="Hugging Face Token"
            type="password"
            value={hfToken}
            onChange={(e) => setHfToken(e.target.value)}
            helperText="Stored locally in this browser"
            fullWidth
          />
          <TextField
            label="Hosted Model ID"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            helperText={`Default: ${DEFAULT_HF_MODEL_ID}`}
            fullWidth
          />
        </Box>

        <TextField
          label="System Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={8}
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}

        {generated && (
          <Alert severity="success">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{generated.filename}</Typography>
            <Typography variant="body2">{generated.explanation}</Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isGenerating}>Close</Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<DownloadIcon />}
            disabled={!generated || isGenerating}
            onClick={() => generated && downloadJsonFile(generated.boxology, generated.filename)}
          >
            Download File
          </Button>
          <Button
            variant="contained"
            startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
            onClick={handleGenerate}
            disabled={isGenerating}
            sx={{ backgroundColor: colors.primary.darker }}
          >
            {isGenerating ? 'Generating' : 'Generate'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
