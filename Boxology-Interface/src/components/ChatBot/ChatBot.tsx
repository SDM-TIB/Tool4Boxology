import React, { useState, useRef, useEffect } from 'react';
import {
  Paper,
  TextField,
  IconButton,
  Box,
  Typography,
  CircularProgress,
  List,
  ListItem,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Snackbar
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import { colors } from '../../styles/theme';
import './ChatBot.css';

const DEFAULT_HF_MODEL_ID = 'openai/gpt-oss-120b:fastest';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
}

interface ChatBotProps {
  open: boolean;
  onClose: () => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ open, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsKey, setSettingsKey] = useState('');
  const [modelType, setModelType] = useState<'gemini' | 'huggingface'>('gemini');
  const [hfToken, setHfToken] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_HF_MODEL_ID);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSnackbar, setDeleteSnackbar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedGeminiKey = localStorage.getItem('gemini_api_key');
    if (savedGeminiKey) {
      setApiKey(savedGeminiKey);
    }

    const savedHfToken = localStorage.getItem('hf_token');
    if (savedHfToken) {
      setHfToken(savedHfToken);
    }

    const savedModelType = localStorage.getItem('model_type') as 'gemini' | 'huggingface' | null;
    if (savedModelType) {
      setModelType(savedModelType);
    }

    const savedModelId = localStorage.getItem('model_id');
    if (savedModelId) {
      setModelId(savedModelId);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSaveApiKey = () => {
    if (modelType === 'gemini' && settingsKey.trim()) {
      setApiKey(settingsKey);
      localStorage.setItem('gemini_api_key', settingsKey);
      localStorage.setItem('model_type', 'gemini');
      setShowSettings(false);
      const welcomeMsg: Message = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: 'Gemini API key saved! Ready to help with your Boxology diagrams.',
        timestamp: Date.now()
      };
      setMessages([welcomeMsg]);
    }
  };

  const handleSaveHfSettings = () => {
    if (hfToken.trim() && modelId.trim()) {
      localStorage.setItem('hf_token', hfToken);
      localStorage.setItem('model_id', modelId);
      localStorage.setItem('model_type', 'huggingface');
      setModelType('huggingface');
      setShowSettings(false);
      const welcomeMsg: Message = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: `Hugging Face settings saved. Requests will run on Hugging Face for ${modelId}.`,
        timestamp: Date.now()
      };
      setMessages([welcomeMsg]);
    }
  };

  const handleSendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return;

    // Check if appropriate credentials are set
    if (modelType === 'gemini' && !apiKey) {
      const errorMsg: Message = {
        id: `msg_${Date.now()}`,
        type: 'error',
        content: 'Please set your Gemini API key in the settings first.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }

    if (modelType === 'huggingface' && !hfToken) {
      const errorMsg: Message = {
        id: `msg_${Date.now()}`,
        type: 'error',
        content: 'Please set your Hugging Face token in the settings first.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: trimmedInput,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.type !== 'error')
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

      let responseText: string;

      if (modelType === 'gemini') {
        // Use Gemini API
        const systemPrompt = `You are a helpful assistant for Boxology, a hierarchical diagram tool. You help users:
- Create and manage diagram nodes
- Link elements together
- Validate diagram patterns
- Organize shapes into clusters
- Export diagrams in various formats (PNG, JSON, DOT)
- Understand Boxology patterns and rules

When users ask about Boxology operations, provide clear, concise guidance. Keep responses focused and actionable.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents: [
                ...conversationHistory.map(m => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }]
                })),
                {
                  role: 'user',
                  parts: [{ text: trimmedInput }]
                }
              ],
              generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7
              }
            })
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          let errorMsg = `API error: ${response.status} ${response.statusText}`;

          if (response.status === 429) {
            errorMsg = '⏱️ Rate limit exceeded. Free tier: 60 requests/minute. Please wait a moment and try again.';
          } else if (errorData.error?.message) {
            errorMsg += `. ${errorData.error.message}`;
          }

          throw new Error(errorMsg);
        }

        const data = await response.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received';
      } else {
        // Use Hugging Face backend
        const response = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model_id: modelId,
            hf_token: hfToken,
            messages: [...conversationHistory, { role: 'user', content: trimmedInput }],
            max_tokens: 512
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.response?.trim()) {
          throw new Error('Hugging Face returned an empty message. Please try again.');
        }
        responseText = data.response;
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleDeleteApiKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
    setShowSettings(false);
    setShowDeleteConfirm(false);
    setDeleteSnackbar(true);
    setMessages([]);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.primary.lighter,
            color: colors.primary.darker
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Boxology Assistant
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Settings">
              <IconButton
                size="small"
                onClick={() => setShowSettings(true)}
                sx={{ color: colors.primary.darker }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: colors.primary.darker }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{
            height: '400px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0
          }}
        >
          {!apiKey && !hfToken && !showSettings && (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 3,
                textAlign: 'center'
              }}
            >
              <Box>
                <Typography variant="h6" gutterBottom>
                  Setup Required
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose Gemini API or hosted Hugging Face inference to get started.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => setShowSettings(true)}
                  sx={{ backgroundColor: colors.primary.darker }}
                >
                  Configure Model
                </Button>
              </Box>
            </Box>
          )}

          {(apiKey || hfToken) && (
            <>
              <Box
                className="chatbot-messages"
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 2,
                  backgroundColor: '#f5f5f5'
                }}
              >
                {messages.length === 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#999'
                    }}
                  >
                    <Typography variant="body2">
                      Ask me anything about your Boxology diagrams!
                    </Typography>
                  </Box>
                )}

                <List sx={{ padding: 0 }}>
                  {messages.map((message, index) => (
                    <React.Fragment key={message.id}>
                      <ListItem
                        sx={{
                          flexDirection: 'column',
                          alignItems:
                            message.type === 'user' ? 'flex-end' : 'flex-start',
                          padding: '8px 0',
                          marginBottom: 1
                        }}
                      >
                        <Paper
                          sx={{
                            maxWidth: '85%',
                            padding: 1.5,
                            backgroundColor:
                              message.type === 'user'
                                ? colors.primary.lighter
                                : message.type === 'error'
                                ? '#ffebee'
                                : '#fff',
                            color:
                              message.type === 'error' ? '#d32f2f' : '#000',
                            borderRadius: 2,
                            wordWrap: 'break-word',
                            border:
                              message.type === 'error'
                                ? '1px solid #ef5350'
                                : 'none'
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: 'pre-wrap' }}
                          >
                            {message.content}
                          </Typography>
                        </Paper>
                      </ListItem>
                      {index < messages.length - 1 && (
                        <Divider sx={{ margin: '4px 0' }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>

                <div ref={messagesEndRef} />
              </Box>

              <Box sx={{ padding: 2, backgroundColor: '#fff', borderTop: '1px solid #ddd' }}>
                <Box sx={{ display: 'flex', gap: 1, marginBottom: 1 }}>
                  <TextField
                    ref={inputRef}
                    fullWidth
                    multiline
                    maxRows={3}
                    placeholder="Ask me about your diagram..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    size="small"
                    sx={{
                      backgroundColor: '#f9f9f9',
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#f9f9f9'
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex' }}>
                    <Tooltip title={isLoading || !inputValue.trim() ? '' : 'Send message'}>
                      <span>
                        <IconButton
                          onClick={handleSendMessage}
                          disabled={isLoading || !inputValue.trim()}
                          sx={{
                            color: colors.primary.darker,
                            marginTop: 0.5,
                            '&:disabled': { color: '#ccc' }
                          }}
                        >
                          {isLoading ? (
                            <CircularProgress size={24} />
                          ) : (
                            <SendIcon />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                {messages.length > 0 && (
                  <Button
                    size="small"
                    onClick={handleClearChat}
                    sx={{ fontSize: '0.75rem', color: '#999' }}
                  >
                    Clear Chat
                  </Button>
                )}
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>LLM Settings</DialogTitle>
        <DialogContent sx={{ paddingTop: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Choose Model Type
          </Typography>

          {/* Model Selection Tabs */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <Button
              variant={modelType === 'gemini' ? 'contained' : 'outlined'}
              onClick={() => setModelType('gemini')}
              size="small"
              sx={{ backgroundColor: modelType === 'gemini' ? colors.primary.darker : 'inherit' }}
            >
              Gemini API
            </Button>
            <Button
              variant={modelType === 'huggingface' ? 'contained' : 'outlined'}
              onClick={() => setModelType('huggingface')}
              size="small"
              sx={{ backgroundColor: modelType === 'huggingface' ? colors.primary.darker : 'inherit' }}
            >
              Hugging Face
            </Button>
          </Box>

          {/* Gemini Settings */}
          {modelType === 'gemini' && (
            <>
              <Alert severity="info" sx={{ marginBottom: 2 }}>
                Get your API key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: colors.primary.darker, textDecoration: 'underline' }}
                >
                  Google AI Studio
                </a>
              </Alert>

              <TextField
                fullWidth
                label="Gemini API Key"
                type="password"
                value={settingsKey || apiKey}
                onChange={(e) => setSettingsKey(e.target.value)}
                placeholder="AIza..."
                helperText="Your API key is stored locally in your browser only"
                sx={{ marginBottom: 2 }}
              />
              {apiKey && (
                <Alert severity="warning" sx={{ marginTop: 2 }}>
                  API key is configured. Click "Delete" to remove it.
                </Alert>
              )}
            </>
          )}

          {/* Hugging Face Settings */}
          {modelType === 'huggingface' && (
            <>
              <Alert severity="info" sx={{ marginBottom: 2 }}>
                Get your token from{' '}
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: colors.primary.darker, textDecoration: 'underline' }}
                >
                  Hugging Face Settings
                </a>
              </Alert>

              <TextField
                fullWidth
                label="Hugging Face Token"
                type="password"
                value={hfToken}
                onChange={(e) => setHfToken(e.target.value)}
                placeholder="hf_..."
                helperText="Your token is stored locally in your browser only"
                sx={{ marginBottom: 2 }}
              />

              <TextField
                fullWidth
                label="Model ID"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder={DEFAULT_HF_MODEL_ID}
                helperText={`Hosted inference model, e.g. ${DEFAULT_HF_MODEL_ID}`}
                sx={{ marginBottom: 2 }}
              />

              {hfToken && (
                <Alert severity="success" sx={{ marginTop: 2 }}>
                  ✓ Hugging Face token configured
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Box>
            {((modelType === 'gemini' && apiKey) || (modelType === 'huggingface' && hfToken)) && (
              <Button
                onClick={() => {
                  if (modelType === 'gemini') {
                    setShowDeleteConfirm(true);
                  } else {
                    setHfToken('');
                    localStorage.removeItem('hf_token');
                    setDeleteSnackbar(true);
                  }
                }}
                sx={{ color: '#d32f2f' }}
              >
                Delete
              </Button>
            )}
          </Box>
          <Box>
            <Button onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (modelType === 'gemini') {
                  handleSaveApiKey();
                } else {
                  handleSaveHfSettings();
                }
              }}
              variant="contained"
              sx={{ backgroundColor: colors.primary.darker }}
            >
              Save
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete API Key?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ marginTop: 1 }}>
            Are you sure you want to delete your Gemini API key? You'll need to add it again to use the ChatBot.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteApiKey}
            variant="contained"
            sx={{ backgroundColor: '#d32f2f' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Success Snackbar */}
      <Snackbar
        open={deleteSnackbar}
        autoHideDuration={3000}
        onClose={() => setDeleteSnackbar(false)}
        message="API key deleted successfully"
      />
    </>
  );
};

export default ChatBot;
