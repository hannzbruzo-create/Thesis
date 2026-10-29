import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import initialModel from './campusModel';
import type { CampusBuilding, CampusModel, CampusTheme, XY } from './modelTypes';

/**
 * Working copy of campusModel.ts. The map always renders from here, so edits
 * made in the in-app editor show up immediately. Nothing is saved to disk:
 * use Export in the editor and paste the result over campusModel.ts.
 */
type ModelStore = {
  model: CampusModel;
  editorOpen: boolean;
  setEditorOpen: (open: boolean) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  /** Applies to every piece in the building's group (if any). */
  updateBuilding: (id: string, change: Partial<Omit<CampusBuilding, 'id' | 'footprint'>>) => void;
  /** Footprint edits only affect the single selected piece. */
  setFootprint: (id: string, footprint: XY[]) => void;
  updateTheme: (change: Partial<CampusTheme>) => void;
  resetModel: () => void;
  dirty: boolean;
};

const Context = createContext<ModelStore | null>(null);

export function ModelStoreProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<CampusModel>(initialModel);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const updateBuilding = useCallback<ModelStore['updateBuilding']>((id, change) => {
    setModel(m => {
      const target = m.buildings.find(b => b.id === id);
      if (!target) return m;
      const together = (b: CampusBuilding) => b.id === id || (!!target.group && b.group === target.group);
      return {
        ...m,
        buildings: m.buildings.map(b => together(b)
          ? { ...b, ...change, roof: change.roof ? { ...b.roof, ...change.roof } : b.roof }
          : b),
      };
    });
    setDirty(true);
  }, []);

  const setFootprint = useCallback<ModelStore['setFootprint']>((id, footprint) => {
    setModel(m => ({ ...m, buildings: m.buildings.map(b => (b.id === id ? { ...b, footprint } : b)) }));
    setDirty(true);
  }, []);

  const updateTheme = useCallback<ModelStore['updateTheme']>(change => {
    setModel(m => ({ ...m, theme: { ...m.theme, ...change } }));
    setDirty(true);
  }, []);

  const resetModel = useCallback(() => { setModel(initialModel); setDirty(false); }, []);

  const value = useMemo(() => ({
    model, editorOpen, setEditorOpen, selectedId, setSelectedId,
    updateBuilding, setFootprint, updateTheme, resetModel, dirty,
  }), [model, editorOpen, selectedId, updateBuilding, setFootprint, updateTheme, resetModel, dirty]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useModelStore(): ModelStore {
  const store = useContext(Context);
  if (!store) throw new Error('useModelStore must be used inside <ModelStoreProvider>');
  return store;
}
