import React from 'react';

export const BentoContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <section className="p3-bento-shell p3-home-content-band w-full self-start overflow-visible">
      {children}
    </section>
  );
};
