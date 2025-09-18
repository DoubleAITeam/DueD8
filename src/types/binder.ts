export type BinderNode =
  | { type: 'main'; id: 'dashboard'; label: string; color?: string }
  | { type: 'class'; id: string; label: string; color: string }
  | { type: 'assignment'; id: string; label: string; color: string; parentClassId: string };

export type BinderState = {
  nodes: BinderNode[];
  activeId: string;
};
