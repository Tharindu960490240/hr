import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import EmpAvatar from './EmpAvatar';
import { usePeople } from '../lib/usePeople';

/** Pick one (value = id|null) or many (multiple, value = id[]) employees. */
export default function PersonPicker({ label, value, onChange, multiple, exclude = [], required, helperText, error, disabled }) {
  const people = usePeople().filter((p) => p.is_active && !exclude.includes(p.id));
  const byId = new Map(people.map((p) => [p.id, p]));
  const selected = multiple ? (value || []).map((id) => byId.get(id)).filter(Boolean) : byId.get(value) || null;
  return (
    <Autocomplete
      multiple={multiple}
      options={people}
      value={selected}
      disabled={disabled}
      onChange={(_, v) => onChange(multiple ? v.map((p) => p.id) : v?.id ?? null)}
      getOptionLabel={(p) => p.full_name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterSelectedOptions={multiple}
      renderOption={({ key, ...props }, p) => (
        <Box component="li" key={key} {...props} sx={{ gap: 1.5 }}>
          <EmpAvatar id={p.id} name={p.full_name} hasAvatar={p.has_avatar} size={28} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{p.full_name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{[p.designation, p.department].filter(Boolean).join(' · ')}</Typography>
          </Box>
        </Box>
      )}
      renderValue={multiple ? (vals, getItemProps) => vals.map((p, index) => {
        const { key, ...rest } = getItemProps({ index });
        return <Chip key={key} size="small" label={p.full_name} {...rest} />;
      }) : undefined}
      renderInput={(params) => <TextField {...params} label={label} required={required} helperText={helperText} error={error} />}
    />
  );
}
