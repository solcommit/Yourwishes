"use client";

import { useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type SelectOption = { value: string; label: string; description?: string; tone?: "common" | "uncommon" | "rare" | "epic" | "legendary" };
interface FormSelectProps {
  name: string;
  label: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

// shadcn-style composition of the accessible Radix Select primitive.
export function FormSelect({ name, label, options, defaultValue, value, onValueChange, disabled }: FormSelectProps) {
  const [localValue, setLocalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? localValue;
  const selected = options.find((option) => option.value === current);
  return <SelectPrimitive.Root name={name} value={current} disabled={disabled}
    onValueChange={(next) => { setLocalValue(next); onValueChange?.(next); }}>
    <SelectPrimitive.Trigger className="field-input select-trigger" aria-label={label} data-tone={selected?.tone}>
      <span className="select-value">
        {selected?.tone && <span aria-hidden="true" className={`priority-dot priority-dot-${selected.tone}`} />}
        <SelectPrimitive.Value />
      </span>
      <SelectPrimitive.Icon asChild><ChevronDown aria-hidden="true" className="select-chevron" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="select-content" data-select-content="" position="popper" sideOffset={6} collisionPadding={12}
        onEscapeKeyDown={(event) => { event.stopPropagation(); }}>
        <SelectPrimitive.ScrollUpButton className="select-scroll"><ChevronUp aria-hidden="true" size={16} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="select-viewport">
          {options.map((option) => <SelectPrimitive.Item key={option.value} className="select-item" data-tone={option.tone} value={option.value}>
            {option.tone && <span aria-hidden="true" className={`priority-dot priority-dot-${option.tone}`} />}
            <span className="select-item-copy">
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              {option.description && <span className="select-description">{option.description}</span>}
            </span>
            <SelectPrimitive.ItemIndicator className="select-check"><Check aria-hidden="true" size={16} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="select-scroll"><ChevronDown aria-hidden="true" size={16} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
