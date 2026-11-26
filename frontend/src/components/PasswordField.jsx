import { useState } from 'react';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { VisibilityOffRounded, VisibilityRounded } from '@mui/icons-material';

export default function PasswordField({ size = 'medium', 'aria-label': ariaLabel, slotProps = {}, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      size={size}
      type={show ? 'text' : 'password'}
      {...props}
      slotProps={{
        ...slotProps,
        // aria-label must reach the <input>, not the wrapper, or screen readers announce an unlabeled field
        htmlInput: { ...slotProps.htmlInput, ...(ariaLabel ? { 'aria-label': ariaLabel } : {}) },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton edge="end" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} tabIndex={-1}>
                {show ? <VisibilityRounded /> : <VisibilityOffRounded />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
