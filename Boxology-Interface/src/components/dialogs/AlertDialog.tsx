import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export interface AlertDialogProps {
  open: boolean;
  title?: string;
  message: string;
  okText?: string;
  onClose: () => void;
}

// Styled stand-in for window.alert() when the content is long-form (e.g. a
// multi-line validation report) and deserves a deliberate dismiss rather than
// an auto-hiding toast.
export default function AlertDialog({ open, title = 'Notice', message, okText = 'OK', onClose }: AlertDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ whiteSpace: 'pre-line', color: 'text.primary' }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" autoFocus>{okText}</Button>
      </DialogActions>
    </Dialog>
  );
}
