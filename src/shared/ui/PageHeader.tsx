import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-5">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[10px] font-bold tracking-wider text-brand-secondary uppercase sm:text-xs">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
          {title}
        </h1>
        <p className="max-w-3xl text-xs leading-relaxed text-text-secondary sm:text-sm hidden sm:block">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1 sm:pt-0">{actions}</div> : null}
    </header>
  );
}
