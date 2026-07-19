import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlayerCard } from './PlayerCard';
import type { Player, PlayerSeasonStats, ScoringFormat, ScoringSettings } from '../types';
import type { AuctionPrice } from '../store/useAppStore';

interface Props {
  id: string;
  player: Player;
  rank: number;
  tier: number;
  stats?: PlayerSeasonStats;
  scoringFormat?: ScoringFormat;
  scoringSettings?: ScoringSettings;
  auctionPrice?: AuctionPrice;
  showStats?: boolean;
  onAddTierBelow: () => void;
  onPlayerClick?: () => void;
}

export function SortablePlayerCard({ id, player, rank, tier, stats, scoringFormat, scoringSettings, auctionPrice, showStats, onAddTierBelow, onPlayerClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/row relative">
      <div className="flex items-center gap-1">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 px-1 py-2 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="4" cy="3" r="1.5" />
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="4" cy="13" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>

        <div className="flex-1">
          <PlayerCard
            player={player}
            rank={rank}
            tier={tier}
            stats={stats}
            scoringFormat={scoringFormat}
            scoringSettings={scoringSettings}
            auctionPrice={auctionPrice}
            showStats={showStats}
            onClick={onPlayerClick}
          />
        </div>
      </div>

      {/* Add tier divider below — thin hover zone */}
      <button
        onClick={onAddTierBelow}
        className="absolute -bottom-0.5 left-0 right-0 h-1 bg-transparent hover:bg-indigo-500/40 rounded cursor-pointer opacity-0 group-hover/row:opacity-100 transition-opacity z-10"
        title="Add tier divider below"
      />
    </div>
  );
}
