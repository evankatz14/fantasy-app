import { create } from 'zustand';
import type { Player } from '../types';
import { nominationChoice, AI_PERSONALITIES } from '../utils/auctionAI';
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

function makeRoster(): RosterSlot[] {
  return [
    { key: 'QB',   label: 'QB',   eligiblePositions: ['QB'],             isBench: false, playerId: null, price: null },
    { key: 'RB1',  label: 'RB',   eligiblePositions: ['RB'],             isBench: false, playerId: null, price: null },
    { key: 'RB2',  label: 'RB',   eligiblePositions: ['RB'],             isBench: false, playerId: null, price: null },
    { key: 'WR1',  label: 'WR',   eligiblePositions: ['WR'],             isBench: false, playerId: null, price: null },
    { key: 'WR2',  label: 'WR',   eligiblePositions: ['WR'],             isBench: false, playerId: null, price: null },
    { key: 'TE',   label: 'TE',   eligiblePositions: ['TE'],             isBench: false, playerId: null, price: null },
    { key: 'FLEX', label: 'FLEX', eligiblePositions: ['RB', 'WR', 'TE'], isBench: false, playerId: null, price: null },
    { key: 'DEF',  label: 'DEF',  eligiblePositions: ['DEF'],            isBench: false, playerId: null, price: null },
    ...Array.from({ length: 7 }, (_, i) => ({
      key: `BN${i + 1}`,
      label: 'BN',
      eligiblePositions: ['QB', 'RB', 'WR', 'TE', 'DEF'],
      isBench: true,
      playerId: null,
      price: null,
    })),
  ];
}

function findBestSlot(roster: RosterSlot[], player: Player): number {
  const pos = player.position;
  // 1. Position-specific starter slot (label matches position exactly)
  const starter = roster.findIndex(s => s.playerId === null && !s.isBench && s.label === pos);
  if (starter !== -1) return starter;
  // 2. FLEX slot for RB/WR/TE
  if (['RB', 'WR', 'TE'].includes(pos)) {
    const flex = roster.findIndex(s => s.playerId === null && s.key === 'FLEX');
    if (flex !== -1) return flex;
  }
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
  roster: RosterSlot[];
}

export const HUMAN_TEAM_ID = 'team-human';

const AI_NAMES = [
  'Gridiron Gurus', 'TD Titans', 'Fantasy Fanatics', 'Blitz Brigade',
  'Draft Dodgers', 'The Benchmarks', 'Punt Patrol', 'Touchdown Terrors',
  'Red Zone Raiders', 'Field Goal Fanatics', 'The Bye Weekers',
];

function buildTeams(): AuctionTeam[] {
  return [
    { id: HUMAN_TEAM_ID, name: 'Your Team', isHuman: true, personality: 'balanced', budget: 200, roster: makeRoster() },
    ...AI_NAMES.map((name, i) => ({
      id: `team-ai-${i}`,
      name,
      isHuman: false,
      personality: AI_PERSONALITIES[i],
      budget: 200,
      roster: makeRoster(),
    })),
  ];
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface AuctionLogEntry {
  playerId: string;
  price: number;
  winnerTeamId: string;
  nominatorTeamId: string;
}

export type AuctionPhase = 'idle' | 'bidding' | 'awarding' | 'complete';

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
  lastAwarded: LastAwarded | null;

  startAuction: (playerIds: string[], values: Record<string, number>) => void;
  doNominate: (players: Player[]) => void;
  placeBid: (teamId: string, amount: number) => void;
  awardPlayer: (players: Player[]) => void;
  resetAuction: () => void;
}

const INITIAL: Pick<AuctionState,
  'phase' | 'teams' | 'nominatingTeamIndex' | 'nominatorTeamId' | 'nominatedPlayerId' |
  'currentBid' | 'currentHighBidderTeamId' | 'bidSequence' | 'availablePlayerIds' |
  'auctionLog' | 'playerValues' | 'lastAwarded'
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
  lastAwarded: null,
};

export const useAuctionStore = create<AuctionState>()((set, get) => ({
  ...INITIAL,

  startAuction: (playerIds, values) => {
    set({ ...INITIAL, teams: buildTeams(), availablePlayerIds: playerIds, playerValues: values });
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
    const playerId = nominationChoice(nominatingTeam, availablePlayerIds, players, playerValues);
    if (!playerId) { set({ phase: 'complete' }); return; }

    set({
      nominatingTeamIndex: (idx + 1) % teams.length,
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
