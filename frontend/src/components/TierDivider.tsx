import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useAppStore } from '../store/useAppStore';

interface Props {
  id: string;
  name: string;
  leagueId: string;
  tierNumber: number;
}

export function TierDivider({ id, name, leagueId, tierNumber }: Props) {
  const { renameTier, removeTier } = useAppStore();
  const isDefaultName = /^Tier \d+$/.test(name);
  const displayName = isDefaultName ? `Tier ${tierNumber}` : name;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id });

  // Don't apply dnd-kit's CSS transform: the virtualizer positions items absolutely,
  // so sortable transforms on the inner div cause overlaps. DragOverlay handles visuals.
  const style = {
    opacity: isDragging ? 0.4 : 1,
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(displayName);
  }, [displayName, editing]);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      renameTier(leagueId, id, trimmed);
    } else {
      setDraft(name);
    }
    setEditing(false);
  }

  return (
    <div ref={setNodeRef} style={style} className="group/tier flex items-center gap-2 my-1">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 px-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag tier"
      >
        <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
          <rect x="0" y="0" width="12" height="1.5" rx="0.75" />
          <rect x="0" y="4.25" width="12" height="1.5" rx="0.75" />
          <rect x="0" y="8.5" width="12" height="1.5" rx="0.75" />
        </svg>
      </button>

      {/* Left rule */}
      <div className="flex-none w-6 h-px bg-slate-600" />

      {/* Tier label */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setDraft(name); setEditing(false); }
          }}
          className="bg-slate-800 border border-indigo-500 rounded px-2 py-0.5 text-xs font-semibold text-slate-200 w-32 outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-slate-400 hover:text-slate-200 whitespace-nowrap transition-colors"
          title="Click to rename"
        >
          {displayName}
        </button>
      )}

      {/* Right rule — expands to fill */}
      <div className="flex-1 h-px bg-slate-600" />

      {/* Tier number badge */}
      <span className="text-xs text-slate-600 tabular-nums shrink-0">T{tierNumber}</span>

      {/* Remove button — visible on hover */}
      <button
        onClick={() => removeTier(leagueId, id)}
        className="shrink-0 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover/tier:opacity-100"
        title="Remove tier divider"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="3" x2="11" y2="11" />
          <line x1="11" y1="3" x2="3" y2="11" />
        </svg>
      </button>
    </div>
  );
}
