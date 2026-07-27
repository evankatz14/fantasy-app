import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player, League, ListItem, FantasyPosition, PlayerSeasonStats } from '../types';
import { MANUAL_AUCTION_VALUES } from '../data/manualAuctionValues';

const PLAYERS_PER_TIER = 10;

// Normalize a name for fuzzy matching against MANUAL_AUCTION_VALUES
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, ' ');
}

const POSITION_FALLBACK_PRIORITY: Record<string, number> = {
  RB: 5, WR: 4, TE: 3, QB: 2, DEF: 1, K: 0,
};

// Build once at module load
const AUCTION_VALUE_MAP = new Map<string, number>(
  MANUAL_AUCTION_VALUES.map(e => [`${normName(e.name)}|${e.position}`, e.value]),
);

function sortPlayersByDefaultRanking(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const valA = AUCTION_VALUE_MAP.get(`${normName(a.fullName)}|${a.position}`);
    const valB = AUCTION_VALUE_MAP.get(`${normName(b.fullName)}|${b.position}`);
    if (valA !== undefined && valB !== undefined) return valB - valA;
    if (valA !== undefined) return -1;
    if (valB !== undefined) return 1;
    // Fallback: position priority, then depth chart order
    const priDiff = (POSITION_FALLBACK_PRIORITY[b.position] ?? 0) - (POSITION_FALLBACK_PRIORITY[a.position] ?? 0);
    if (priDiff !== 0) return priDiff;
    return (a.depthChartPosition ?? 99) - (b.depthChartPosition ?? 99);
  });
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [removed] = result.splice(from, 1);
  result.splice(to, 0, removed);
  return result;
}

function makeTierId() {
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildInitialItems(players: Player[]): ListItem[] {
  const items: ListItem[] = [];
  let tierCount = 1;
  for (let i = 0; i < players.length; i++) {
    if (i > 0 && i % PLAYERS_PER_TIER === 0) {
      tierCount++;
      items.push({ type: 'tier', id: makeTierId(), name: `Tier ${tierCount}` });
    }
    items.push({ type: 'player', id: `player-${players[i].id}`, playerId: players[i].id });
  }
  return items;
}

export interface AuctionPrice {
  min: number | null;
  max: number | null;
}

interface AppState {
  players: Player[];
  leagues: League[];
  activeLeagueId: string | null;
  orderedItems: Record<string, ListItem[]>;
  positionFilter: FantasyPosition | 'ALL';
  stats: Record<string, PlayerSeasonStats>;
  showStats: boolean;
  showTiers: boolean;
  auctionPrices: Record<string, Record<string, AuctionPrice>>; // leagueId -> playerId -> price

  setPlayers: (players: Player[]) => void;
  setLeagues: (leagues: League[]) => void;
  setActiveLeague: (id: string) => void;
  addLeague: (data: Omit<League, 'id'>) => League;
  updateLeague: (id: string, updates: Partial<Omit<League, 'id'>>) => void;
  deleteLeague: (id: string) => void;
  setPositionFilter: (pos: FantasyPosition | 'ALL') => void;
  setStats: (stats: Record<string, PlayerSeasonStats>) => void;
  toggleShowStats: () => void;
  toggleShowTiers: () => void;
  setAuctionPrice: (leagueId: string, playerId: string, min: number | null, max: number | null) => void;

  initOrderedItems: (leagueId: string, players: Player[]) => void;

  // Move any item freely (ALL mode)
  moveItem: (leagueId: string, activeId: string, overId: string) => void;

  // Move only players of a given position (filtered mode)
  movePlayerInPosition: (leagueId: string, position: FantasyPosition, activeId: string, overId: string) => void;

  renameTier: (leagueId: string, tierId: string, name: string) => void;
  addTierAfter: (leagueId: string, afterItemId: string) => void;
  addTierAtEnd: (leagueId: string) => void;
  removeTier: (leagueId: string, tierId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      players: [],
      leagues: [],
      activeLeagueId: null,
      orderedItems: {},
      positionFilter: 'ALL',
      stats: {},
      showStats: true,
      showTiers: true,
      auctionPrices: {},

      setPlayers: (players) => set({ players }),
      setLeagues: (leagues) => set({ leagues }),
      setActiveLeague: (id) => set({ activeLeagueId: id }),

      addLeague: (data) => {
        const league: League = { id: `league-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...data };
        set((s) => ({ leagues: [...s.leagues, league] }));
        return league;
      },

      updateLeague: (id, updates) => {
        set((s) => ({ leagues: s.leagues.map((l) => (l.id === id ? { ...l, ...updates } : l)) }));
      },

      deleteLeague: (id) => {
        set((s) => {
          const leagues = s.leagues.filter((l) => l.id !== id);
          const activeLeagueId = s.activeLeagueId === id ? (leagues[0]?.id ?? null) : s.activeLeagueId;
          return { leagues, activeLeagueId };
        });
      },

      setPositionFilter: (pos) => set({ positionFilter: pos }),
      setStats: (stats) => set({ stats }),
      toggleShowStats: () => set((s) => ({ showStats: !s.showStats })),
      toggleShowTiers: () => set((s) => ({ showTiers: !s.showTiers })),
      setAuctionPrice: (leagueId, playerId, min, max) => {
        const { auctionPrices } = get();
        set({
          auctionPrices: {
            ...auctionPrices,
            [leagueId]: { ...(auctionPrices[leagueId] ?? {}), [playerId]: { min, max } },
          },
        });
      },

      initOrderedItems: (leagueId, players) => {
        const { orderedItems } = get();
        if (orderedItems[leagueId]?.length) return;
        const sorted = sortPlayersByDefaultRanking(players);
        set({ orderedItems: { ...orderedItems, [leagueId]: buildInitialItems(sorted) } });
      },

      moveItem: (leagueId, activeId, overId) => {
        const { orderedItems } = get();
        const items = orderedItems[leagueId] ?? [];
        const from = items.findIndex((i) => i.id === activeId);
        const to = items.findIndex((i) => i.id === overId);
        if (from === -1 || to === -1) return;
        set({ orderedItems: { ...orderedItems, [leagueId]: arrayMove(items, from, to) } });
      },

      movePlayerInPosition: (leagueId, position, activeId, overId) => {
        const { orderedItems, players } = get();
        const items = orderedItems[leagueId] ?? [];
        const playerMap = new Map(players.map((p) => [p.id, p]));

        const filteredIndices = items
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => item.type === 'player' && playerMap.get(item.playerId)?.position === position)
          .map(({ idx }) => idx);

        const filteredItems = filteredIndices.map((idx) => items[idx]);
        const from = filteredItems.findIndex((i) => i.id === activeId);
        const to = filteredItems.findIndex((i) => i.id === overId);
        if (from === -1 || to === -1) return;

        const reordered = arrayMove(filteredItems, from, to);
        const newItems = [...items];
        filteredIndices.forEach((fullIdx, i) => {
          newItems[fullIdx] = reordered[i];
        });
        set({ orderedItems: { ...orderedItems, [leagueId]: newItems } });
      },

      renameTier: (leagueId, tierId, name) => {
        const { orderedItems } = get();
        const items = (orderedItems[leagueId] ?? []).map((item) =>
          item.id === tierId && item.type === 'tier' ? { ...item, name } : item,
        );
        set({ orderedItems: { ...orderedItems, [leagueId]: items } });
      },

      addTierAfter: (leagueId, afterItemId) => {
        const { orderedItems } = get();
        const items = [...(orderedItems[leagueId] ?? [])];
        const idx = items.findIndex((i) => i.id === afterItemId);
        if (idx === -1) return;

        // Compute next tier number based on existing dividers up to this point
        const tiersAbove = items.slice(0, idx + 1).filter((i) => i.type === 'tier').length;
        const newTier: ListItem = {
          type: 'tier',
          id: makeTierId(),
          name: `Tier ${tiersAbove + 2}`,
        };
        items.splice(idx + 1, 0, newTier);
        set({ orderedItems: { ...orderedItems, [leagueId]: items } });
      },

      addTierAtEnd: (leagueId) => {
        const { orderedItems } = get();
        const items = [...(orderedItems[leagueId] ?? [])];
        const tierCount = items.filter(i => i.type === 'tier').length;
        items.push({ type: 'tier', id: makeTierId(), name: `Tier ${tierCount + 2}` });
        set({ orderedItems: { ...orderedItems, [leagueId]: items } });
      },

      removeTier: (leagueId, tierId) => {
        const { orderedItems } = get();
        const items = (orderedItems[leagueId] ?? []).filter((i) => i.id !== tierId);
        set({ orderedItems: { ...orderedItems, [leagueId]: items } });
      },
    }),
    {
      name: 'fantasy-rankings',
      version: 3,
      migrate: (persisted: any, version: number) => {
        if (version < 3) {
          // Leagues are now persisted locally; reset to seed fresh from API
          return { ...persisted, leagues: [], orderedItems: {}, activeLeagueId: null };
        }
        return persisted;
      },
      partialize: (state) => ({
        leagues: state.leagues,
        orderedItems: state.orderedItems,
        activeLeagueId: state.activeLeagueId,
        positionFilter: state.positionFilter,
        showTiers: state.showTiers,
        auctionPrices: state.auctionPrices,
      }),
    },
  ),
);
