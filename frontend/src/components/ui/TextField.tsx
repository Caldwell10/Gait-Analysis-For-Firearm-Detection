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
      'block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 placeholder-slate-400 shadow-sm transition',
      'focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/60 focus:ring-offset-2 focus:ring-offset-slate-950',
      error ? 'border-rose-500/40 focus:border-rose-400 focus:ring-rose-400/60' : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-200 heading-font">
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
          <p id={errorId} className="mt-2 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-2 text-sm text-slate-400 body-font">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

TextField.displayName = 'TextField';

export default TextField;
