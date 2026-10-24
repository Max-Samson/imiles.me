import { createContext, useContext } from 'react';

/** 宿主只注入界面状态和修改通知，编辑内容仍由 Pageel 管理。 */
export interface WorkbenchContextValue {
  dark: boolean;
  onDirtyChange: (dirty: boolean) => void;
  confirmLeave: () => Promise<boolean>;
  registerSaveDraft: (save: () => Promise<boolean>) => () => void;
}
export const WorkbenchContext = createContext<WorkbenchContextValue>({
  dark: false,
  onDirtyChange: () => {},
  confirmLeave: async () => true,
  registerSaveDraft: () => () => {},
});
export const useWorkbench = () => useContext(WorkbenchContext);
