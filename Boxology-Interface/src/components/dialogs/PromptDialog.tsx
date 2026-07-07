import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TextField } from '@mui/material';

export interface PromptDialogProps {
  open: boolean;
  title?: string;
  message: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

// Styled stand-in for window.prompt(): submitting returns the (possibly empty)
// text value, cancelling resolves to null — same contract as the native dialog.
export default function PromptDialog({
  open,
  title = 'Input required',
  message,
  defaultValue = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const submit = () => onSubmit(value);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ whiteSpace: 'pre-line', mb: 2, color: 'text.primary' }}>
          {message}
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">{cancelText}</Button>
        <Button onClick={submit} variant="contained">{confirmText}</Button>
      </DialogActions>
    </Dialog>
  );
}
