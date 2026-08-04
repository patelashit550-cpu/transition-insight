import type { ReactNode } from 'react';
import { Header } from './Header';

interface NarrativeProps {
  sidebar?: ReactNode;
  children: ReactNode;
  hideHeader?: boolean; // New prop to toggle the global header
}

const Narrative = ({ sidebar, children, hideHeader = false }: NarrativeProps) => {
  return (
    /* Unified background: bg-black or a solid dark grey (zinc-950) 
       to ensure the 'header area' matches the 'content area'
    */
    <div className="flex-1 flex flex-col bg-black text-white selection:bg-emerald-500/30">
      
      {!hideHeader && <Header />}

      <div className="flex-1 w-full max-w-[1550px] mx-auto px-6 md:px-10 flex flex-col justify-start pt-12 pb-20">
        <div 
          className={`grid gap-8 ${
            sidebar 
              ? 'grid-cols-1 lg:grid-cols-[250px_1fr]' 
              : 'grid-cols-1'
          }`}
        >
          {sidebar && (
            <aside className="border-r border-white/10 pr-6 hidden lg:block sticky top-24 self-start max-h-[calc(100vh-10rem)] overflow-y-auto">
              {sidebar}
            </aside>
          )}

          {/* BROADENED TEXT: Removed the 'max-w-5xl' to let the chronicle expand */}
          <main className="w-full">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Narrative;