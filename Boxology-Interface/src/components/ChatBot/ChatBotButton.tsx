import React, { useState } from 'react';
import { Fab } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import { colors } from '../../styles/theme';
import ChatBotNew from './ChatBotNew';

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

interface ChatBotButtonProps {
  onOpenBoxology: (model: BoxologyGraphLinksModel, filename?: string) => void;
}

export const ChatBotButton: React.FC<ChatBotButtonProps> = ({ onOpenBoxology }) => {
  const [chatOpen, setChatOpen] = useState(false);

  const openChat = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setChatOpen(true);
  };

  return (
    <>
      <Fab
        color="primary"
        aria-label="chat"
        onClick={openChat}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: chatOpen ? { xs: 24, sm: 504, md: 544, lg: 584 } : 24,
          backgroundColor: colors.primary.darker,
          '&:hover': {
            backgroundColor: colors.primary.darker,
            opacity: 0.9,
          },
          zIndex: 1299,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          transition: 'right 180ms ease',
        }}
      >
        <ChatIcon />
      </Fab>

      <ChatBotNew open={chatOpen} onClose={() => setChatOpen(false)} onOpenBoxology={onOpenBoxology} />
    </>
  );
};

export default ChatBotButton;
