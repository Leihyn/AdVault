import React from 'react';

interface FilterOption {
  label: string;
  value: string;
}

interface Props {
  filters: { key: string; label: string; options: FilterOption[] }[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ filters, values, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={values[filter.key] || ''}
          onChange={(e) => onChange(filter.key, e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--tg-theme-hint-color, #ccc)',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
            color: 'var(--tg-theme-text-color, #000)',
            fontSize: '13px',
            flexShrink: 0,
          }}
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
