import { create } from 'zustand';
import type { Player, RosterSlots } from '../types';
import { nominationChoice, randomizePersonalities } from '../utils/auctionAI';
import type { AIPersonality } from '../utils/auctionAI';

// ── Roster ────────────────────────────────────────────────────────────────────

export interface RosterSlot {
  key: string;
  label: string;
  eligiblePositions: string[];
  isBench: boolean;
  playerId: string | null;
  price: number | null;
}

const DEFAULT_ROSTER_SLOTS: RosterSlots = {
  QB: 1, RB: 2, WR: 2, TE: 1, K: 0, DEF: 0, FLEX: 1, SFLEX: 0, BN: 7,
};

function makeRoster(slots: RosterSlots = DEFAULT_ROSTER_SLOTS): RosterSlot[] {
  const result: RosterSlot[] = [];
  const add = (key: string, label: string, eligible: string[], isBench = false) =>
    result.push({ key, label, eligiblePositions: eligible, isBench, playerId: null, price: null });

  for (let i = 0; i < slots.QB; i++) add(slots.QB > 1 ? `QB${i + 1}` : 'QB', 'QB', ['QB']);
  for (let i = 0; i < slots.RB; i++) add(`RB${i + 1}`, 'RB', ['RB']);
  for (let i = 0; i < slots.WR; i++) add(`WR${i + 1}`, 'WR', ['WR']);
  for (let i = 0; i < slots.TE; i++) add(slots.TE > 1 ? `TE${i + 1}` : 'TE', 'TE', ['TE']);
  for (let i = 0; i < slots.FLEX; i++) add(slots.FLEX > 1 ? `FLEX${i + 1}` : 'FLEX', 'FLEX', ['RB', 'WR', 'TE']);
  for (let i = 0; i < slots.SFLEX; i++) add(slots.SFLEX > 1 ? `SF${i + 1}` : 'SF', 'SF', ['QB', 'RB', 'WR', 'TE']);
  for (let i = 0; i < slots.DEF; i++) add(slots.DEF > 1 ? `DEF${i + 1}` : 'DEF', 'DEF', ['DEF']);
  for (let i = 0; i < slots.K; i++) add(slots.K > 1 ? `K${i + 1}` : 'K', 'K', ['K']);
  for (let i = 0; i < slots.BN; i++) add(`BN${i + 1}`, 'BN', ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'], true);

  return result;
}

function findBestSlot(roster: RosterSlot[], player: Player): number {
  const pos = player.position;
  // 1. Starter slot whose label matches this position exactly
  const starter = roster.findIndex(s => s.playerId === null && !s.isBench && s.label === pos);
  if (starter !== -1) return starter;
  // 2. Any eligible non-bench slot (FLEX, SF, etc.)
  const flex = roster.findIndex(s => s.playerId === null && !s.isBench && s.eligiblePositions.includes(pos));
  if (flex !== -1) return flex;
  // 3. Any bench slot
  return roster.findIndex(s => s.isBench && s.playerId === null);
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export interface AuctionTeam {
  id: string;
  name: string;
  isHuman: boolean;
  personality: AIPersonality;
  budget: number;
  initialBudget: number;
  roster: RosterSlot[];
}

export const HUMAN_TEAM_ID = 'team-human';

const AI_NAMES = [
  'Gridiron Gurus', 'TD Titans', 'Fantasy Fanatics', 'Blitz Brigade',
  'Draft Dodgers', 'The Benchmarks', 'Punt Patrol', 'Touchdown Terrors',
  'Red Zone Raiders', 'Field Goal Fanatics', 'The Bye Weekers',
  'Endzone Elite', 'The Audibles', 'Nickel Defense', 'Hail Mary Squad',
];

function buildTeams(
  humanPosition = 1,
  budget = 200,
  slots: RosterSlots = DEFAULT_ROSTER_SLOTS,
  teamCount = 12,
): AuctionTeam[] {
  const aiCount = teamCount - 1;
  const personalities = randomizePersonalities(aiCount);
  const human: AuctionTeam = {
    id: HUMAN_TEAM_ID,
    name: 'Your Team',
    isHuman: true,
    personality: 'balanced',
    budget,
    initialBudget: budget,
    roster: makeRoster(slots),
  };
  const aiTeams: AuctionTeam[] = AI_NAMES.slice(0, aiCount).map((name, i) => ({
    id: `team-ai-${i}`,
    name,
    isHuman: false,
    personality: personalities[i],
    budget,
    initialBudget: budget,
    roster: makeRoster(slots),
  }));
  const insertAt = Math.max(0, Math.min(teamCount - 1, humanPosition - 1));
  const teams = [...aiTeams];
  teams.splice(insertAt, 0, human);
  return teams;
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface AuctionLogEntry {
  playerId: string;
  price: number;
  winnerTeamId: string;
  nominatorTeamId: string;
}

export type AuctionPhase = 'idle' | 'nominating' | 'bidding' | 'awarding' | 'complete';

interface LastAwarded {
  playerId: string;
  winnerTeamId: string;
  price: number;
}

interface AuctionState {
  phase: AuctionPhase;
  teams: AuctionTeam[];
  nominatingTeamIndex: number;
  nominatorTeamId: string | null;
  nominatedPlayerId: string | null;
  currentBid: number;
  currentHighBidderTeamId: string | null;
  bidSequence: number;
  availablePlayerIds: string[];
  auctionLog: AuctionLogEntry[];
  playerValues: Record<string, number>;
  playerValueRanges: Record<string, { low: number; high: number }>;
  lastAwarded: LastAwarded | null;

  startAuction: (
    playerIds: string[],
    values: Record<string, number>,
    ranges?: Record<string, { low: number; high: number }>,
    humanPosition?: number,
    budget?: number,
    slots?: RosterSlots,
    teamCount?: number,
  ) => void;
  humanNominate: (playerId: string, startingBid?: number) => void;
  doNominate: (players: Player[]) => void;
  placeBid: (teamId: string, amount: number) => void;
  awardPlayer: (players: Player[]) => void;
  resetAuction: () => void;
}

const INITIAL: Pick<AuctionState,
  'phase' | 'teams' | 'nominatingTeamIndex' | 'nominatorTeamId' | 'nominatedPlayerId' |
  'currentBid' | 'currentHighBidderTeamId' | 'bidSequence' | 'availablePlayerIds' |
  'auctionLog' | 'playerValues' | 'playerValueRanges' | 'lastAwarded'
> = {
  phase: 'idle',
  teams: buildTeams(),
  nominatingTeamIndex: 0,
  nominatorTeamId: null,
  nominatedPlayerId: null,
  currentBid: 0,
  currentHighBidderTeamId: null,
  bidSequence: 0,
  availablePlayerIds: [],
  auctionLog: [],
  playerValues: {},
  playerValueRanges: {},
  lastAwarded: null,
};

export const useAuctionStore = create<AuctionState>()((set, get) => ({
  ...INITIAL,

  startAuction: (playerIds, values, ranges = {}, humanPosition = 1, budget = 200, slots = DEFAULT_ROSTER_SLOTS, teamCount = 12) => {
    set({ ...INITIAL, teams: buildTeams(humanPosition, budget, slots, teamCount), availablePlayerIds: playerIds, playerValues: values, playerValueRanges: ranges });
  },

  humanNominate: (playerId, startingBid = 1) => {
    const { nominatorTeamId, availablePlayerIds, bidSequence } = get();
    if (!nominatorTeamId) return;
    set({
      nominatedPlayerId: playerId,
      availablePlayerIds: availablePlayerIds.filter(id => id !== playerId),
      currentBid: Math.max(1, startingBid),
      currentHighBidderTeamId: nominatorTeamId,
      phase: 'bidding',
      bidSequence: bidSequence + 1,
    });
  },

  doNominate: (players) => {
    const { teams, nominatingTeamIndex, availablePlayerIds, playerValues, bidSequence } = get();

    if (!availablePlayerIds.length || teams.every(t => t.roster.every(s => s.playerId !== null))) {
      set({ phase: 'complete' });
      return;
    }

    // Find the next team that still has empty roster spots
    let idx = nominatingTeamIndex;
    for (let i = 0; i < teams.length; i++) {
      const candidate = teams[(nominatingTeamIndex + i) % teams.length];
      if (candidate.roster.some(s => s.playerId === null)) {
        idx = (nominatingTeamIndex + i) % teams.length;
        break;
      }
    }

    const nominatingTeam = teams[idx];
    const nextIndex = (idx + 1) % teams.length;

    if (nominatingTeam.isHuman) {
      set({
        nominatingTeamIndex: nextIndex,
        nominatorTeamId: nominatingTeam.id,
        phase: 'nominating',
        lastAwarded: null,
      });
      return;
    }

    const playerId = nominationChoice(nominatingTeam, availablePlayerIds, players, playerValues);
    if (!playerId) { set({ phase: 'complete' }); return; }

    set({
      nominatingTeamIndex: nextIndex,
      nominatorTeamId: nominatingTeam.id,
      nominatedPlayerId: playerId,
      availablePlayerIds: availablePlayerIds.filter(id => id !== playerId),
      currentBid: 1,
      currentHighBidderTeamId: nominatingTeam.id,
      phase: 'bidding',
      bidSequence: bidSequence + 1,
      lastAwarded: null,
    });
  },

  placeBid: (teamId, amount) => {
    const { currentBid, bidSequence, phase } = get();
    if (phase !== 'bidding' || amount <= currentBid) return;
    set({ currentBid: amount, currentHighBidderTeamId: teamId, bidSequence: bidSequence + 1 });
  },

  awardPlayer: (players) => {
    const { phase, nominatedPlayerId, currentHighBidderTeamId, currentBid, teams, auctionLog, nominatorTeamId } = get();
    if (phase !== 'bidding' || !nominatedPlayerId || !currentHighBidderTeamId) return;

    const player = players.find(p => p.id === nominatedPlayerId);
    if (!player) return;

    const updatedTeams = teams.map(team => {
      if (team.id !== currentHighBidderTeamId) return team;
      const slotIndex = findBestSlot(team.roster, player);
      if (slotIndex === -1) return team;
      const newRoster = [...team.roster];
      newRoster[slotIndex] = { ...newRoster[slotIndex], playerId: player.id, price: currentBid };
      return { ...team, budget: team.budget - currentBid, roster: newRoster };
    });

    set({
      teams: updatedTeams,
      auctionLog: [...auctionLog, {
        playerId: nominatedPlayerId,
        price: currentBid,
        winnerTeamId: currentHighBidderTeamId,
        nominatorTeamId: nominatorTeamId ?? currentHighBidderTeamId,
      }],
      lastAwarded: { playerId: nominatedPlayerId, winnerTeamId: currentHighBidderTeamId, price: currentBid },
      phase: 'awarding',
      nominatedPlayerId: null,
      currentBid: 0,
      currentHighBidderTeamId: null,
    });
  },

  resetAuction: () => set({ ...INITIAL, teams: buildTeams() }),
}));
