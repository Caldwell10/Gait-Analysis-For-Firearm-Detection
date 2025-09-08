import { forwardRef, useRef, useImperativeHandle, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  length?: number;
}

export interface OtpFieldHandle {
  focus: () => void;
  clear: () => void;
}

const OtpField = forwardRef<OtpFieldHandle, OtpFieldProps>(
  ({ label, value, onChange, error, disabled = false, length = 6 }, ref) => {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRefs.current[0]?.focus();
      },
      clear: () => {
        onChange('');
        inputRefs.current[0]?.focus();
      },
    }));

    const handleInputChange = (index: number, inputValue: string) => {
      // Only allow numeric input
      const numericValue = inputValue.replace(/[^0-9]/g, '');
      if (numericValue.length > 1) return;

      const newValue = value.split('');
      newValue[index] = numericValue;
      const updatedValue = newValue.join('');

      onChange(updatedValue);

      // Auto-focus next input
      if (numericValue && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        // Focus previous input on backspace if current is empty
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text/plain');
      const numericData = pasteData.replace(/[^0-9]/g, '').slice(0, length);
      onChange(numericData);
      
      // Focus the next empty input or the last one
      const nextIndex = Math.min(numericData.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    };

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <div className="flex space-x-3 justify-center">
          {Array.from({ length }, (_, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={value[index] || ''}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={disabled}
              className={[
                'w-12 h-12 text-center text-lg font-semibold border-2 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                error
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300',
                disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white',
              ].filter(Boolean).join(' ')}
              aria-label={`Digit ${index + 1} of ${length}`}
              aria-describedby={error ? 'otp-error' : undefined}
              aria-invalid={error ? 'true' : 'false'}
            />
          ))}
        </div>
        {error && (
          <p id="otp-error" className="mt-2 text-sm text-red-600 text-center" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

OtpField.displayName = 'OtpField';

export default OtpField;