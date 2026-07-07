import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
} from '@mui/material';
import {
  AddCircleOutline,
  LinkOutlined,
  EditOutlined,
  SaveOutlined,
  WarningAmber,
  CheckCircleOutline,
  AccountTree,
  CloudUpload,
} from '@mui/icons-material';
import boxologyLogo from '../assets/Thum-tool4boxology.png'; // place your logo file here

interface InstructionDialogProps {
  open: boolean;
  onClose: () => void;
}

const InstructionDialog: React.FC<InstructionDialogProps> = ({ open, onClose }) => {
  const [showInstruction, setShowInstruction] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={(e, reason) => {
        if (reason !== 'backdropClick') onClose();
      }}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', pb: 2 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <img
            src={boxologyLogo}
            alt="Boxology Logo"
            style={{
              height: 36,
              width: 36,
              objectFit: 'contain',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.15)',
              padding: 4
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Welcome to Boxology Interface
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          A tool for designing hybrid AI systems using Boxology principles
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Getting Started Section */}
        <Typography variant="h6" gutterBottom color="primary">
          🚀 Getting Started
        </Typography>
        
        <List dense>
          <ListItem>
            <ListItemIcon>
              <AddCircleOutline color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="1. Add Components"
              secondary="Drag and drop components from the left sidebar (Input, Process, Output) or use predefined patterns"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <LinkOutlined color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="2. Connect Components"
              secondary="Click and drag from one component to another to create connections. Follow Boxology grammar rules."
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <EditOutlined color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="3. Configure Properties"
              secondary="Double-click components to edit labels and types. Use meaningful names for clarity (e.g., 'UserInput', 'DataProcessing', 'PredictionOutput')"
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Critical Rules Section */}
        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            ⚠️ Critical Rule for Knowledge Graph Creation
          </Typography>
          <Typography variant="body2">
            <strong>Each process MUST be defined with ONE and ONLY ONE Process component in a cluster.</strong>
            <br />
            Violating this rule will cause errors in Knowledge Graph creation and JSON file generation.
          </Typography>
        </Alert>

        {/* Best Practices */}
        <Typography variant="h6" gutterBottom color="primary">
          ✅ Best Practices
        </Typography>
        
        <List dense>
          <ListItem>
            <ListItemIcon>
              <CheckCircleOutline color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Use Meaningful Names"
              secondary="Label components clearly (e.g., 'SensorData', 'MLModel', 'VisualizationOutput') for better understanding"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <CheckCircleOutline color="success" />
            </ListItemIcon>
            <ListItemText
              primary="One Process Per Cluster"
              secondary="Group related Input → Process → Output components together with exactly ONE Process component"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <CheckCircleOutline color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Validate Before Exporting"
              secondary="Ensure all connections follow Boxology grammar rules before generating KG"
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Export & Save Section */}
        <Typography variant="h6" gutterBottom color="primary">
          💾 Saving & Exporting
        </Typography>

        <List dense>
          <ListItem>
            <ListItemIcon>
              <SaveOutlined color="info" />
            </ListItemIcon>
            <ListItemText
              primary="Save Project (.json)"
              secondary="Use 'Save File' to preserve your complete diagram with all hierarchies. Can be reopened in Tool4Boxology later."
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <CloudUpload color="info" />
            </ListItemIcon>
            <ListItemText
              primary="Export for Knowledge Graph (.json)"
              secondary="Use 'Export JSON' to generate a file for uploading to the backend and creating RDF Knowledge Graph in Virtuoso."
            />
          </ListItem>
        </List>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Tip:</strong> The JSON export file is specifically formatted for Knowledge Graph creation. 
            It validates your diagram structure and generates RDF triples following Boxology ontology.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onClose} 
          variant="contained" 
          color="primary"
          size="large"
        >
          Got It! Let's Start
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InstructionDialog;