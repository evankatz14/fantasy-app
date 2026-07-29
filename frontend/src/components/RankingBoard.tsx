import { useState, useMemo, useCallback, useRef } from 'react';
import { PlayerModal } from './PlayerModal';
import type { Player } from '../types';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../store/useAppStore';
import { SortablePlayerCard } from './SortablePlayerCard';
import { TierDivider } from './TierDivider';
import { PlayerCard } from './PlayerCard';
import type { FantasyPosition } from '../types';

export function RankingBoard() {
  const {
    players,
    leagues,
    activeLeagueId,
    orderedItems,
    positionFilter,
    stats,
    showStats,
    showTiers,
    auctionPrices,
    moveItem,
    movePlayerInPosition,
    addTierAfter,
  } = useAppStore();

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const scoringFormat = activeLeague?.scoringFormat ?? 'half_ppr';
  const scoringSettings = activeLeague?.scoringSettings;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const leagueItems = activeLeagueId ? (orderedItems[activeLeagueId] ?? []) : [];

  const visibleItems = useMemo(() => {
    // When tiers are hidden, strip all tier items regardless of view
    if (!showTiers) {
      if (positionFilter === 'ALL') return leagueItems.filter(i => i.type !== 'tier');
      return leagueItems.filter(i => i.type === 'player' && playerMap.get(i.playerId)?.position === positionFilter);
    }
    if (positionFilter === 'ALL') return leagueItems;
    // Include tier dividers only when at least one matching player follows before the next tier
    const result: typeof leagueItems = [];
    let pendingTier: (typeof leagueItems)[0] | null = null;
    for (const item of leagueItems) {
      if (item.type === 'tier') {
        pendingTier = item;
      } else if (playerMap.get(item.playerId)?.position === positionFilter) {
        if (pendingTier) { result.push(pendingTier); pendingTier = null; }
        result.push(item);
      }
    }
    return result;
  }, [leagueItems, positionFilter, playerMap, showTiers]);

  // Rank: sequential count among player items in this view
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    let rank = 1;
    for (const item of visibleItems) {
      if (item.type === 'player') map.set(item.id, rank++);
    }
    return map;
  }, [visibleItems]);

  // Tier: count of dividers above this player in the VISIBLE list (resets per filtered view)
  const tierMap = useMemo(() => {
    const map = new Map<string, number>();
    let tier = 1;
    for (const item of visibleItems) {
      if (item.type === 'tier') tier++;
      else map.set(item.id, tier);
    }
    return map;
  }, [visibleItems]);

  // Tier number for each divider — relative to visible list so filtered views start at Tier 2
  const tierNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    for (const item of visibleItems) {
      if (item.type === 'tier') {
        count++;
        map.set(item.id, count + 1);
      }
    }
    return map;
  }, [visibleItems]);

  const playerRowH = showStats ? 70 : 52;

  const estimateSize = useCallback(
    (i: number) => (visibleItems[i]?.type === 'tier' ? 36 : playerRowH),
    [visibleItems, playerRowH],
  );

  // Key the measurement cache by item ID instead of index.
  // Without this, a drag that moves item X from index 5 to index 3 leaves the
  // cache saying "index 3 is 50px" — but index 3 is now a tier (36px), causing
  // the extra-space / overlap bug the user reported.
  const getItemKey = useCallback(
    (i: number) => visibleItems[i]?.id ?? i,
    [visibleItems],
  );

  const virtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 15,
    getItemKey,
  });

  // Freeze ResizeObserver measurements while dragging so mid-drag position
  // recalculations can't shift items under the cursor.
  const measureRef = useCallback(
    (el: HTMLElement | null) => {
      if (el && !activeId) virtualizer.measureElement(el);
    },
    [activeId, virtualizer],
  );

  const activeItem = activeId ? visibleItems.find((i) => i.id === activeId) : null;
  const activePlayer =
    activeItem?.type === 'player' ? playerMap.get(activeItem.playerId) : null;

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over || active.id === over.id || !activeLeagueId) return;
      const draggedItem = visibleItems.find((i) => i.id === String(active.id));
      const overItem = visibleItems.find((i) => i.id === String(over.id));
      // Use moveItem when: ALL view, dragging a tier, or dropping onto a tier
      if (positionFilter === 'ALL' || draggedItem?.type === 'tier' || overItem?.type === 'tier') {
        moveItem(activeLeagueId, String(active.id), String(over.id));
      } else {
        movePlayerInPosition(
          activeLeagueId,
          positionFilter as FantasyPosition,
          String(active.id),
          String(over.id),
        );
      }
    },
    [activeLeagueId, positionFilter, visibleItems, moveItem, movePlayerInPosition],
  );

  if (!activeLeagueId) return null;

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {/* Virtualized scroll container */}
        <div ref={parentRef} className="h-full overflow-y-auto pr-1">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const item = visibleItems[vRow.index];
              if (!item) return null;

              return (
                <div
                  key={item.id}
                  data-index={vRow.index}
                  ref={measureRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  {item.type === 'tier' ? (
                    <TierDivider
                      id={item.id}
                      name={item.name}
                      leagueId={activeLeagueId}
                      tierNumber={tierNumberMap.get(item.id) ?? 2}
                    />
                  ) : (() => {
                    const player = playerMap.get(item.playerId);
                    if (!player) return null;
                    return (
                      <SortablePlayerCard
                        id={item.id}
                        player={player}
                        rank={rankMap.get(item.id) ?? 0}
                        tier={tierMap.get(item.id) ?? 1}
                        stats={stats[player.id]}
                        scoringFormat={scoringFormat}
                        scoringSettings={scoringSettings}
                        auctionPrice={auctionPrices[activeLeagueId]?.[player.id]}
                        showStats={showStats}
                        onAddTierBelow={() => addTierAfter(activeLeagueId, item.id)}
                        onPlayerClick={() => setSelectedPlayer(player)}
                      />
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 120, easing: 'ease' }}>
        {activeItem?.type === 'player' && activePlayer && (
          <div className="flex items-center gap-1 shadow-2xl opacity-95">
            <div className="w-5" />
            <div className="flex-1">
              <PlayerCard
                player={activePlayer}
                rank={rankMap.get(activeId!) ?? 0}
                tier={tierMap.get(activeId!) ?? 1}
                stats={stats[activePlayer.id]}
                scoringFormat={scoringFormat}
                scoringSettings={scoringSettings}
                showStats={showStats}
              />
            </div>
          </div>
        )}
        {activeItem?.type === 'tier' && (
          <div className="flex items-center gap-2 shadow-xl px-2 py-1 bg-slate-800 rounded border border-indigo-500/50">
            <div className="flex-1 h-px bg-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">{activeItem.name}</span>
            <div className="flex-1 h-px bg-indigo-400" />
          </div>
        )}
      </DragOverlay>
    </DndContext>

    {selectedPlayer && (
      <PlayerModal
        player={selectedPlayer}
        scoringFormat={scoringFormat}
        scoringSettings={scoringSettings}
        onClose={() => setSelectedPlayer(null)}
      />
    )}
    </>
  );
}
