import { COUNTRIES } from '@geoguess/shared';

type Props = {
  value: string;
  onChange: (country: string) => void;
  disabled?: boolean;
};

export default function CountryPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="country-picker">
      <label htmlFor="country-guess">Country</label>
      <select
        id="country-guess"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select country…</option>
        {COUNTRIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
