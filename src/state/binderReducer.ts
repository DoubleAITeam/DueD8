import { BinderNode, BinderState } from '../types/binder';

type ClassNode = Extract<BinderNode, { type: 'class' }>;
type AssignmentNode = Extract<BinderNode, { type: 'assignment' }>;

type Action =
  | { type: 'OPEN_MAIN' }
  | { type: 'OPEN_CLASS'; node: ClassNode }
  | { type: 'OPEN_ASSIGNMENT'; node: AssignmentNode }
  | { type: 'ACTIVATE'; id: string }
  | { type: 'CLOSE'; id: string };

const DASHBOARD_NODE: BinderNode = {
  type: 'main',
  id: 'dashboard',
  label: 'Dashboard'
};

export const initialBinderState: BinderState = {
  nodes: [DASHBOARD_NODE],
  activeId: DASHBOARD_NODE.id
};

function ensureDashboard(nodes: BinderNode[]): BinderNode[] {
  if (nodes.length === 0) {
    return [DASHBOARD_NODE];
  }

  const [first, ...rest] = nodes;
  if (first.type === 'main') {
    if (first.label !== DASHBOARD_NODE.label) {
      return [{ ...DASHBOARD_NODE }, ...rest];
    }
    return nodes;
  }

  return [DASHBOARD_NODE, ...nodes];
}

function upsertNode(nodes: BinderNode[], node: BinderNode): BinderNode[] {
  return nodes.map((current) => {
    if (current.type === node.type && current.id === node.id) {
      return { ...current, ...node } as BinderNode;
    }
    return current;
  });
}

export function binderReducer(state: BinderState, action: Action): BinderState {
  switch (action.type) {
    case 'OPEN_MAIN': {
      const nodes = ensureDashboard(state.nodes);
      return {
        nodes,
        activeId: DASHBOARD_NODE.id
      };
    }
    case 'OPEN_CLASS': {
      const nodes = ensureDashboard(state.nodes);
      const existingIndex = nodes.findIndex(
        (existing) => existing.type === 'class' && existing.id === action.node.id
      );

      if (existingIndex === -1) {
        return {
          nodes: [...nodes, action.node],
          activeId: action.node.id
        };
      }

      const updated = upsertNode(nodes, action.node);
      return {
        nodes: updated,
        activeId: action.node.id
      };
    }
    case 'OPEN_ASSIGNMENT': {
      const nodes = ensureDashboard(state.nodes);
      const classIndex = nodes.findIndex(
        (existing) => existing.type === 'class' && existing.id === action.node.parentClassId
      );

      if (classIndex === -1) {
        // Assignment should never be opened without its class being present. Ignore request.
        return state;
      }

      const existingIndex = nodes.findIndex(
        (existing) => existing.type === 'assignment' && existing.id === action.node.id
      );

      if (existingIndex !== -1) {
        const updated = upsertNode(nodes, action.node);
        return {
          nodes: updated,
          activeId: action.node.id
        };
      }

      let insertionIndex = classIndex + 1;
      while (insertionIndex < nodes.length) {
        const current = nodes[insertionIndex];
        if (current.type !== 'assignment' || current.parentClassId !== action.node.parentClassId) {
          break;
        }
        insertionIndex += 1;
      }

      const nextNodes = [
        ...nodes.slice(0, insertionIndex),
        action.node,
        ...nodes.slice(insertionIndex)
      ];

      return {
        nodes: nextNodes,
        activeId: action.node.id
      };
    }
    case 'ACTIVATE': {
      const exists = state.nodes.some((node) => node.id === action.id);
      if (!exists) {
        return state;
      }
      return {
        ...state,
        activeId: action.id
      };
    }
    case 'CLOSE': {
      const nodes = ensureDashboard(state.nodes);
      const index = nodes.findIndex((node) => node.id === action.id);
      if (index <= 0) {
        return state;
      }

      const trimmed = nodes.slice(0, index);
      const nextActive = trimmed[trimmed.length - 1]?.id ?? DASHBOARD_NODE.id;
      return {
        nodes: trimmed,
        activeId: nextActive
      };
    }
    default:
      return state;
  }
}

export type BinderAction = Action;
