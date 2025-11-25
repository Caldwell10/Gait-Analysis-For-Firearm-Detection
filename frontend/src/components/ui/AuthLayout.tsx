import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-16">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.15),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.12),_transparent_55%)]" />
      <div className="glass-card max-w-md w-full space-y-8 px-8 py-10">
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-white heading-font">{title}</h2>
          {description && (
            <p className="mt-3 text-sm text-slate-300 body-font">{description}</p>
          )}
        </div>
        <div className="space-y-6 body-font">{children}</div>
      </div>
    </div>
  );
}
