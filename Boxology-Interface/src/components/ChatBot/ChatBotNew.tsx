import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { colors } from '../../styles/theme';
import { API_BASE } from '../../config';
import './ChatBot.css';

type BoxologyGraphLinksModel = {
  class: 'GraphLinksModel';
  modelData?: {
    boxologyId?: string;
    boxologyLabel?: string;
    boxologyDescription?: string;
    [key: string]: unknown;
  };
  nodeDataArray: Record<string, unknown>[];
  linkDataArray: Record<string, unknown>[];
};

type GeneratedBoxologyArtifact = {
  id: string;
  filename: string;
  model: BoxologyGraphLinksModel;
  prettyJson: string;
  sourcePrompt: string;
  createdAt: number;
};

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
  artifact?: GeneratedBoxologyArtifact;
}

interface ChatBotProps {
  open: boolean;
  onClose: () => void;
  onOpenBoxology: (model: BoxologyGraphLinksModel, filename?: string) => void;
}

type Step = 'provider' | 'setup' | 'chat';
type ProviderKey = 'openai' | 'gemini' | 'claude' | 'huggingface';

const GENERAL_SYSTEM_PROMPT = 'You are a helpful, general-purpose AI assistant.';

const providers: Record<
  ProviderKey,
  { name: string; models: { id: string; name: string }[]; docs: string; placeholder: string; tokenLabel: string }
> = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    docs: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    tokenLabel: 'API key',
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
    ],
    docs: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza...',
    tokenLabel: 'API key',
  },
  claude: {
    name: 'Anthropic Claude',
    models: [
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ],
    docs: 'https://console.anthropic.com/api/keys',
    placeholder: 'sk-ant-...',
    tokenLabel: 'API key',
  },
  huggingface: {
    name: 'Hugging Face',
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B' },
      { id: 'openai/gpt-oss-120b:fastest', name: 'GPT-OSS 120B (Fastest)' },
    ],
    docs: 'https://huggingface.co/settings/tokens',
    placeholder: 'hf_...',
    tokenLabel: 'Access token',
  },
};

function isBoxologyModel(value: unknown): value is BoxologyGraphLinksModel {
  const maybe = value as Partial<BoxologyGraphLinksModel> | null;
  return (
    !!maybe &&
    maybe.class === 'GraphLinksModel' &&
    Array.isArray(maybe.nodeDataArray) &&
    Array.isArray(maybe.linkDataArray)
  );
}

function safeFilename(label: string) {
  const base = label.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().replace(/\s+/g, '_').slice(0, 120);
  return `${base || 'ai_generated_boxology'}.boxology`;
}

function downloadBoxology(artifact: GeneratedBoxologyArtifact) {
  const blob = new Blob([artifact.prettyJson], { type: 'application/boxology;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifact.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const ChatBotNew: React.FC<ChatBotProps> = ({ open, onClose, onOpenBoxology }) => {
  const [step, setStep] = useState<Step>('provider');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>('openai');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(providers.openai.models[0].id);
  const [useSkill, setUseSkill] = useState(true);
  const [setupError, setSetupError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentProvider = providers[selectedProvider];
  const providerEntries = useMemo(() => Object.entries(providers) as [ProviderKey, typeof providers[ProviderKey]][], []);

  const scrollMessagesToEnd = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const handleProviderSelect = (provider: ProviderKey) => {
    setSelectedProvider(provider);
    setSelectedModel(providers[provider].models[0].id);
    setApiKey('');
    setSetupError('');
    setStep('setup');
  };

  const handleStartChat = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setSetupError(`${currentProvider.tokenLabel} is required`);
      return;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      setSetupError(`Paste the ${currentProvider.tokenLabel} itself, not an API URL.`);
      return;
    }

    setIsValidating(true);
    setSetupError('');

    try {
      const response = await fetch(`${API_BASE}/api/llm/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model_id: selectedModel,
          api_key: trimmed,
        }),
      });
      const responseText = await response.text();
      if (!responseText) {
        throw new Error(
          `Backend returned HTTP ${response.status} with an empty response. Check the Vite /api proxy target and backend logs.`,
        );
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Backend returned HTTP ${response.status} with a non-JSON response.`,
        );
      }

      if (!response.ok || !result.valid) {
        setApiKey('');
        setSetupError(result.error || `Could not validate ${currentProvider.tokenLabel}`);
        return;
      }

      setStep('chat');
      setMessages([
        {
          id: `msg_${Date.now()}`,
          type: 'assistant',
          content: useSkill
            ? 'Boxology skill mode is active. Describe a neuro-symbolic AI system and I will generate a .boxology JSON file.'
            : 'Hi! How can I help?',
          timestamp: Date.now(),
        },
      ]);
      scrollMessagesToEnd();
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not reach the backend validation endpoint.');
    } finally {
      setIsValidating(false);
    }
  };

  const makeArtifact = (data: any, prompt: string): GeneratedBoxologyArtifact | null => {
    const model = data.boxology ?? data.model ?? data.response;
    const parsed = typeof model === 'string' ? JSON.parse(model) : model;
    if (!isBoxologyModel(parsed)) return null;

    const label = parsed.modelData?.boxologyLabel || data.filename?.replace(/\.boxology$/i, '') || 'AI Generated Boxology';
    const filename = data.filename || safeFilename(String(label));
    return {
      id: `artifact_${Date.now()}`,
      filename,
      model: parsed,
      prettyJson: JSON.stringify(parsed, null, 2),
      sourcePrompt: prompt,
      createdAt: Date.now(),
    };
  };

  const handleSendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: trimmedInput,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    scrollMessagesToEnd();

    try {
      const messageHistory = messages
        .filter((m) => m.type !== 'error' && !m.artifact)
        .map((m) => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content }));

      const response = await fetch(`${API_BASE}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model_id: selectedModel,
          api_key: apiKey.trim(),
          messages: [...messageHistory, { role: 'user', content: trimmedInput }],
          use_boxology_skill: useSkill,
          system_prompt: GENERAL_SYSTEM_PROMPT,
          max_tokens: useSkill ? 4096 : 1024,
        }),
      });

      if (!response.ok) {
        const rawBody = await response.text();
        let detail = '';
        try {
          const parsed = JSON.parse(rawBody);
          detail = parsed.detail || parsed.error || '';
        } catch {
          detail = rawBody;
        }
        throw new Error(detail || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      const artifact = useSkill ? makeArtifact(data, trimmedInput) : null;
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: artifact
          ? `Generated ${artifact.filename}. Review the Boxology JSON below, then open it on the canvas when ready.`
          : data.response || 'No response received',
        timestamp: Date.now(),
        artifact: artifact || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'error',
        content:
          err instanceof TypeError
            ? 'Cannot reach the backend server. Make sure it is running on http://localhost:8000.'
            : `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      scrollMessagesToEnd();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    setStep('provider');
    setMessages([]);
    setInputValue('');
    setApiKey('');
    setSelectedProvider('openai');
    setSelectedModel(providers.openai.models[0].id);
    setSetupError('');
    setUseSkill(true);
    setIsValidating(false);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      hideBackdrop
      PaperProps={{
        sx: {
          width: { xs: 'calc(100vw - 16px)', sm: 480, md: 520, lg: 560 },
          maxWidth: '100vw',
          height: 'calc(100vh - 16px)',
          top: 8,
          right: 8,
          boxSizing: 'border-box',
          borderRadius: 2,
          border: '1px solid #cfd9e3',
          boxShadow: '0 12px 40px rgba(15, 47, 74, 0.24)',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f6f8fb' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0f2f4a',
            color: '#fff',
            px: 2,
            py: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <SmartToyIcon fontSize="small" />
            <Typography component="span" variant="h6" sx={{ minWidth: 0, fontWeight: 700 }}>
              Boxology AI Assistant
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {step === 'provider' && (
          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Choose AI Provider
            </Typography>
            <Typography variant="body2" sx={{ color: '#5d6b7a' }}>
              Your key is used only for this chat session and is not saved.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1 }}>
              {providerEntries.map(([key, prov]) => (
                <Button
                  key={key}
                  variant="outlined"
                  fullWidth
                  onClick={() => handleProviderSelect(key)}
                  sx={{
                    p: 1.5,
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    borderColor: '#c8d3df',
                    color: '#183247',
                    backgroundColor: '#fff',
                    borderRadius: 1.5,
                    '&:hover': { backgroundColor: '#eef6ff', borderColor: '#4d8bc0' },
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {prov.name}
                  </Typography>
                </Button>
              ))}
            </Box>
          </Box>
        )}

        {step === 'setup' && (
          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {currentProvider.name} Setup
            </Typography>

            {setupError && <Alert severity="error">{setupError}</Alert>}
            {selectedProvider === 'gemini' && (
              <Alert severity="info">
                Gemini needs a Google AI Studio API key. OAuth access tokens usually do not work here.
              </Alert>
            )}

            <TextField
              fullWidth
              label={currentProvider.tokenLabel}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={currentProvider.placeholder}
              helperText={`Get from ${currentProvider.docs}`}
              autoComplete="new-password"
              inputProps={{ name: `boxology-${selectedProvider}-credential`, spellCheck: false }}
            />

            <FormControl fullWidth>
              <InputLabel>Model</InputLabel>
              <Select value={selectedModel} label="Model" onChange={(e) => setSelectedModel(e.target.value)}>
                {currentProvider.models.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                backgroundColor: '#fff',
                border: '1px solid #dfe7ef',
                borderRadius: 1.5,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Boxology AI Skill
                </Typography>
                <Typography variant="caption" sx={{ color: '#5d6b7a' }}>
                  {useSkill ? 'Generate .boxology JSON files' : 'General assistant'}
                </Typography>
              </Box>
              <Switch checked={useSkill} onChange={(e) => setUseSkill(e.target.checked)} color="primary" />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
              <Button variant="outlined" fullWidth onClick={() => setStep('provider')} startIcon={<ArrowBackIcon />}>
                Back
              </Button>
              <Button
                variant="contained"
                fullWidth
                onClick={handleStartChat}
                disabled={isValidating}
                sx={{ backgroundColor: colors.primary.darker }}
              >
                {isValidating ? <CircularProgress size={20} color="inherit" /> : 'Test & Start'}
              </Button>
            </Box>
          </Box>
        )}

        {step === 'chat' && (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.25,
                backgroundColor: '#fff',
                borderBottom: '1px solid #dfe7ef',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 'none' }}>
                  {currentProvider.name}
                </Typography>
                <Chip size="small" label={selectedModel} sx={{ height: 22, minWidth: 0, maxWidth: 190 }} />
              </Box>
              <Button size="small" onClick={handleReset} sx={{ color: '#6b7785', flex: 'none' }}>
                Change
              </Button>
            </Box>

            <Box
              className="chatbot-messages"
              sx={{
                flex: 1,
                minWidth: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {messages.map((message) => (
                <Paper
                  key={message.id}
                  sx={{
                    p: 1.5,
                    backgroundColor: message.type === 'user' ? '#dff0ff' : message.type === 'error' ? '#ffebee' : '#fff',
                    color: message.type === 'error' ? '#d32f2f' : '#000',
                    borderRadius: 1.5,
                    alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start',
                    width: message.artifact ? '100%' : 'auto',
                    maxWidth: message.artifact ? '100%' : '86%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    border: message.type === 'error' ? '1px solid #ef5350' : '1px solid #dfe7ef',
                    boxShadow: '0 1px 2px rgba(15, 47, 74, 0.06)',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>

                  {message.artifact && (
                    <Box sx={{ mt: 1.5, minWidth: 0, display: 'grid', gap: 1 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }}>
                        <Typography
                          variant="caption"
                          title={message.artifact.filename}
                          sx={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            color: '#2c5f86',
                          }}
                        >
                          {message.artifact.filename}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={() => message.artifact && downloadBoxology(message.artifact)}
                            sx={{ minWidth: 0 }}
                          >
                            Download
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<OpenInNewIcon />}
                            onClick={() => message.artifact && onOpenBoxology(message.artifact.model, message.artifact.filename)}
                            sx={{ backgroundColor: colors.primary.darker }}
                          >
                            Open
                          </Button>
                        </Box>
                      </Box>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          p: 1.25,
                          maxWidth: '100%',
                          maxHeight: 220,
                          boxSizing: 'border-box',
                          overflow: 'auto',
                          backgroundColor: '#0f1720',
                          color: '#d7e6f5',
                          borderRadius: 1,
                          fontSize: 11,
                          lineHeight: 1.45,
                          whiteSpace: 'pre',
                        }}
                      >
                        {message.artifact.prettyJson}
                      </Box>
                    </Box>
                  )}
                </Paper>
              ))}
              {isLoading && (
                <Paper sx={{ p: 1.5, maxWidth: '86%', border: '1px solid #dfe7ef', borderRadius: 1.5 }}>
                  <CircularProgress size={18} />
                </Paper>
              )}
              <div ref={messagesEndRef} />
            </Box>

            <Divider />
            <Box sx={{ display: 'flex', gap: 1, p: 2, minWidth: 0, backgroundColor: '#fff' }}>
              <TextField
                fullWidth
                sx={{ minWidth: 0 }}
                multiline
                maxRows={4}
                placeholder={useSkill ? 'Describe your AI system...' : 'Ask anything...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                size="small"
                autoComplete="off"
                inputProps={{ name: 'boxology-chat-message', spellCheck: true }}
              />
              <IconButton
                aria-label="Send message"
                onClick={handleSendMessage}
                disabled={isLoading || !inputValue.trim()}
                sx={{
                  width: 44,
                  height: 44,
                  backgroundColor: colors.primary.darker,
                  color: '#fff',
                  '&:hover': { backgroundColor: '#123d5d' },
                  '&:disabled': { backgroundColor: '#d7dde3', color: '#8793a0' },
                }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default ChatBotNew;
