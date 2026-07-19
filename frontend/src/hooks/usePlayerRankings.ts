import { useEffect, useState } from 'react';
import { fetchPlayerRankings } from '../api';
import type { PlayerRanking, ScoringFormat } from '../api';

// Module-level cache — one entry per scoring format, survives across mounts
let _cached: { format: ScoringFormat; rankings: PlayerRanking[] } | null = null;
let _pending: Promise<PlayerRanking[]> | null = null;

function getOrFetch(format: ScoringFormat): Promise<PlayerRanking[]> {
  if (_cached?.format === format) return Promise.resolve(_cached.rankings);
  if (_pending) return _pending;

  _pending = fetchPlayerRankings(format)
    .then(rankings => {
      _cached = { format, rankings };
      _pending = null;
      return rankings;
    })
    .catch(() => {
      _pending = null;
      return [];
    });

  return _pending;
}

export function usePlayerRankings(format: ScoringFormat): PlayerRanking[] {
  const [rankings, setRankings] = useState<PlayerRanking[]>(() =>
    _cached?.format === format ? _cached.rankings : []
  );

  useEffect(() => {
    let cancelled = false;
    getOrFetch(format).then(r => {
      if (!cancelled) setRankings(r);
    });
    return () => { cancelled = true; };
  }, [format]); // eslint-disable-line react-hooks/exhaustive-deps

  return rankings;
}
