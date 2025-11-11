import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UIState {
  // Modal states
  isCreateQueryModalOpen: boolean;
  isAddTablesModalOpen: boolean;
  isRenameQueryModalOpen: boolean;
  isDeleteQueryModalOpen: boolean;
  isCreateConnectionModalOpen: boolean;
  isEditConnectionModalOpen: boolean;
  isDeleteConnectionModalOpen: boolean;
  isSettingsModalOpen: boolean;
  
  // Modal data
  modalData: Record<string, any>;
  
  // Global loading state (for operations that affect multiple stores)
  globalLoading: boolean;
  
  // Global toast/notification state
  toast: {
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
  
  // Actions
  openModal: (modalName: string, data?: any) => void;
  closeModal: (modalName: string) => void;
  closeAllModals: () => void;
  setModalData: (modalName: string, data: any) => void;
  
  setGlobalLoading: (loading: boolean) => void;
  
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      // Initial state
      isCreateQueryModalOpen: false,
      isAddTablesModalOpen: false,
      isRenameQueryModalOpen: false,
      isDeleteQueryModalOpen: false,
      isCreateConnectionModalOpen: false,
      isEditConnectionModalOpen: false,
      isDeleteConnectionModalOpen: false,
      isSettingsModalOpen: false,
      modalData: {},
      globalLoading: false,
      toast: null,
      
      // Open a modal
      openModal: (modalName, data) => {
        set((state) => ({
          [`is${modalName}Open`]: true,
          modalData: data ? { ...state.modalData, [modalName]: data } : state.modalData,
        }));
      },
      
      // Close a modal
      closeModal: (modalName) => {
        set((state) => {
          const newModalData = { ...state.modalData };
          delete newModalData[modalName];
          return {
            [`is${modalName}Open`]: false,
            modalData: newModalData,
          };
        });
      },
      
      // Close all modals
      closeAllModals: () => {
        set({
          isCreateQueryModalOpen: false,
          isAddTablesModalOpen: false,
          isRenameQueryModalOpen: false,
          isDeleteQueryModalOpen: false,
          isCreateConnectionModalOpen: false,
          isEditConnectionModalOpen: false,
          isDeleteConnectionModalOpen: false,
          isSettingsModalOpen: false,
          modalData: {},
        });
      },
      
      // Set modal data
      setModalData: (modalName, data) => {
        set((state) => ({
          modalData: { ...state.modalData, [modalName]: data },
        }));
      },
      
      // Set global loading
      setGlobalLoading: (loading) => set({ globalLoading: loading }),
      
      // Show toast notification
      showToast: (message, type) => {
        set({ toast: { message, type } });
        // Auto-clear after 5 seconds
        setTimeout(() => {
          set({ toast: null });
        }, 5000);
      },
      
      // Clear toast
      clearToast: () => set({ toast: null }),
    }),
    { name: 'UIStore' }
  )
);

