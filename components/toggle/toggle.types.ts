export interface ToggleOption<T extends string = string> {
  label: string;
  value: T;
  icon?: string;
}

export interface ToggleProps<T extends string = string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}
