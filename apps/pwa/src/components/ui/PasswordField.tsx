import { forwardRef, useState } from 'react';

interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  showStrengthIndicator?: boolean;
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, helperText, showStrengthIndicator = false, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = props.id || props.name || label.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    const inputClasses = [
      'appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-400',
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
        <div className="mt-1 relative">
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            className={inputClasses}
            aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
            aria-invalid={error ? 'true' : 'false'}
            {...props}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
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

PasswordField.displayName = 'PasswordField';

export default PasswordField;