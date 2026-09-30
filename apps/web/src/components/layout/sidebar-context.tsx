"use client";

import { createContext, useContext, useEffect, useState } from "react";

type SidebarState = "expanded" | "collapsed";

type SidebarContextType = {
  state: SidebarState;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  // SSR-safe defaults: match server render (desktop, open)
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mobile = window.innerWidth < 1024;
    setIsMobile(mobile);
    if (mobile) setIsOpen(false);
    setMounted(true);

    const onResize = () => {
      const nowMobile = window.innerWidth < 1024;
      setIsMobile(nowMobile);
      if (nowMobile) setIsOpen(false);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function toggleSidebar() {
    setIsOpen(prev => !prev);
  }

  return (
    <SidebarContext.Provider
      value={{
        state: isOpen ? "expanded" : "collapsed",
        isOpen: mounted ? isOpen : defaultOpen,
        setIsOpen,
        isMobile: mounted ? isMobile : false,
        toggleSidebar,
      }}
    >
      {children as any}
    </SidebarContext.Provider>
  );
}
