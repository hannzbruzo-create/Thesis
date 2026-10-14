
export type NodeType =
  | 'exit'
  | 'walkway'
  | 'turn'
  | 'intersection'
  | 'evac-access';

export type PathNode = {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  isExit?: boolean;
};

export type PathEdge = {
  from: string;
  to: string;
};

export const NODES: Record<string, PathNode> = {
  N2: {
    id: 'N2',
    x: 29.8613,
    y: 82.4775,
    type: 'exit',
    isExit: true,
  },
  N3: {
    id: 'N3',
    x: 32.4162,
    y: 82.5613,
    type: 'exit',
    isExit: true,
  },
  N4: {
    id: 'N4',
    x: 34.8612,
    y: 82.6162,
    type: 'exit',
    isExit: true,
  },
  N5: {
    id: 'N5',
    x: 32.6112,
    y: 74.45,
    type: 'evac-access',
  },
};

export const EDGES: PathEdge[] = [
  { from: 'N2', to: 'N3' },
  { from: 'N3', to: 'N4' },
  { from: 'N3', to: 'N5' },
];

export const EVACUATION_TARGETS = {
  EVAC_AREA_1: {
    name: 'Evacuation Area 1',
    accessNodeIds: ['N5'],
  },
};
