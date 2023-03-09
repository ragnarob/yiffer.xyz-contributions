import { useState } from 'react';

export type BaseRadioButtonGroupProps<T> = {
  options: { text: string; value: T }[];
  title?: string;
  name: string;
  className?: string;
};

type FullRadioButtonGroupProps<T> = {
  onChange: (value: T) => void;
  value?: T;
} & BaseRadioButtonGroupProps<T>;

export default function RadioButtonGroup<T>({
  options,
  title,
  name,
  value,
  onChange,
  className = '',
}: FullRadioButtonGroupProps<T>) {
  const [currentlyHighlightedIndex, setCurrentlyHighlightedIndex] = useState(-1);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>, index: number) {
    if (event.key !== 'Tab') {
      event.stopPropagation();
      event.preventDefault();
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      let newIndex = currentlyHighlightedIndex;
      if (event.key === 'ArrowUp') {
        newIndex--;
      } else {
        newIndex++;
      }
      if (newIndex < 0) {
        newIndex = options.length - 1;
      } else if (newIndex >= options.length) {
        newIndex = 0;
      }
      setCurrentlyHighlightedIndex(newIndex);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      onChange(options[index].value);
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {title && <label className="mb-2">{title}</label>}
      <div
        className="flex flex-col gap-2"
        onBlur={() => setCurrentlyHighlightedIndex(-1)}
      >
        {options.map((option, index) => (
          <div
            key={index}
            className="flex flex-row items-center cursor-pointer outline-none"
            onClick={() => onChange(option.value)}
            onKeyDown={e => onKeyDown(e, index)}
            tabIndex={0}
            onFocus={() => setCurrentlyHighlightedIndex(index)}
          >
            <div
              className={`flex flex-shrink-0 items-center justify-center w-5 h-5 rounded-full border
                border-gray-800 dark:border-gray-600 
              ${currentlyHighlightedIndex === index ? ' bg-theme1-primaryTrans' : ''}`}
            >
              {value === option.value && (
                <div className="w-2 h-2 rounded-full bg-theme1-dark dark:bg-theme1-primary" />
              )}
            </div>
            <div className="ml-2 text-sm">{option.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
