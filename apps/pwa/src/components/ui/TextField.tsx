import { forwardRef } from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    const inputId = props.id || props.name || label.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    const inputClasses = [
      'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400',
      'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm',
      error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="mt-1">
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
            aria-invalid={error ? 'true' : 'false'}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-2 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

TextField.displayName = 'TextField';

export default TextField;