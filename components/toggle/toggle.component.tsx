'use client'

import { useId } from "react";
import { Icon } from "@iconify/react";
import { ToggleProps } from "./toggle.types";
import "./toggle.styles.css";

function ToggleComponent<T extends string>({
  options,
  value,
  onChange,
  name,
  size = "md",
  ariaLabel,
}: ToggleProps<T>) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <div
      className={`toggle toggle--${size}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const checked = option.value === value;

        return (
          <label
            key={option.value}
            className={`toggle__option${checked ? " toggle__option--active" : ""}`}
          >
            <input
              className="toggle__input"
              type="radio"
              name={groupName}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
            />
            {option.icon && (
              <Icon
                className="toggle__icon"
                icon={option.icon}
                width={16}
                height={16}
                aria-hidden
              />
            )}
            <span className="toggle__label">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export default ToggleComponent;
