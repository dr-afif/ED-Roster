import { Link, useInRouterContext } from 'react-router-dom';
import { useIsMobileViewport } from './useIsMobileViewport';

type ModuleBackBarProps = {
  title: string;
  backTo?: string;
};

/**
 * Compact mobile navigation bar shown above secondary modules.
 */
export function ModuleBackBar({ title, backTo = '/' }: ModuleBackBarProps) {
  const isMobile = useIsMobileViewport(1023);
  const inRouter = useInRouterContext();

  if (!isMobile) {
    return null;
  }

  const linkClass =
    'inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[#57534E] transition hover:border-stone-400 hover:text-[#18181B] active:scale-[0.97]';

  return (
    <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
      {inRouter ? (
        <Link to={backTo} className={linkClass}>
          ← Home
        </Link>
      ) : (
        <a href={`#${backTo}`} className={linkClass}>
          ← Home
        </a>
      )}
      <span className="text-[11px] font-extrabold text-[#57534E]">{title}</span>
    </div>
  );
}
