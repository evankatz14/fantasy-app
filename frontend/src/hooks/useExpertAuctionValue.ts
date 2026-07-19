import { useEffect, useState } from 'react';
import { fetchAuctionValues } from '../api';
import { matchScrapedValues } from '../utils/auctionValues';
import type { Player, ScoringFormat } from '../types';

// Module-level cache — survives across mounts, one entry per scoring format
let _cached: { format: ScoringFormat; values: Record<string, number> } | null = null;
let _pending: Promise<Record<string, number>> | null = null;

function getOrFetch(format: ScoringFormat, allPlayers: Player[]): Promise<Record<string, number>> {
  if (_cached?.format === format) return Promise.resolve(_cached.values);
  if (_pending) return _pending;

  _pending = fetchAuctionValues(format)
    .then(scraped => {
      const values = matchScrapedValues(scraped, allPlayers);
      _cached = { format, values };
      _pending = null;
      return values;
    })
    .catch(() => {
      _pending = null;
      return {};
    });

  return _pending;
}

export function useExpertAuctionValue(
  player: Player,
  format: ScoringFormat,
  allPlayers: Player[],
): number | null {
  const [value, setValue] = useState<number | null>(() =>
    _cached?.format === format ? (_cached.values[player.id] ?? null) : null
  );

  useEffect(() => {
    let cancelled = false;
    getOrFetch(format, allPlayers).then(values => {
      if (!cancelled) setValue(values[player.id] ?? null);
    });
    return () => { cancelled = true; };
  }, [player.id, format]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}
