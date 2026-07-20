import { useEffect, useState } from 'react';
import { fetchYahooPlayerValues } from '../api';
import type { YahooPlayerValue } from '../api';

let _cached: YahooPlayerValue[] | null = null;
let _pending: Promise<YahooPlayerValue[]> | null = null;

function getOrFetch(): Promise<YahooPlayerValue[]> {
  if (_cached) return Promise.resolve(_cached);
  if (_pending) return _pending;

  _pending = fetchYahooPlayerValues()
    .then(values => {
      _cached = values;
      _pending = null;
      return values;
    })
    .catch(() => {
      _pending = null;
      return [];
    });

  return _pending;
}

export function useYahooPlayerValues(): { values: YahooPlayerValue[]; authenticated: boolean } {
  const [values, setValues] = useState<YahooPlayerValue[]>(_cached ?? []);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check auth status first
    fetch('/auth/yahoo/status')
      .then(r => r.json())
      .then(({ authenticated }) => {
        setAuthenticated(authenticated);
        if (authenticated) {
          getOrFetch().then(setValues);
        }
      })
      .catch(() => {});
  }, []);

  return { values, authenticated };
}
