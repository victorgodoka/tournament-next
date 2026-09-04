'use client';

import { createContext, useContext, useState } from 'react';

interface ModalContextType {
  isOpen: boolean;
  toggleModal: (f?: boolean) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setModal] = useState<boolean>(false);

  const toggleModal = (f?: boolean) => {
    setModal((prev) => f ?? !prev);
  };

  return (
    <ModalContext.Provider value={{ isOpen, toggleModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
