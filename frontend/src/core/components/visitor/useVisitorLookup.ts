import { useEffect, useRef, useState } from 'react';
import { visitorApi } from './visitorApi';
import type { VisitorInput, VisitorLookupResult } from './visitorTypes';

const EMPTY: VisitorLookupResult = { visitor: null, matches: [], conflict: false };

const digitCount = (value: string) => value.replace(/\D/g, '').length;

export function useVisitorLookup(input: VisitorInput, enabled = true) {
  const [result, setResult] = useState<VisitorLookupResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);

  const idNumber = input.identification.number.trim();
  const telephone = input.telephone.trim();
  const email = input.email.trim();
  const exclude = input.visitor_id || null;

  useEffect(() => {
    if (!enabled) {
      setResult(EMPTY);
      return undefined;
    }
    const params = {
      identification: idNumber.length >= 4 ? idNumber : undefined,
      telephone: digitCount(telephone) >= 9 ? telephone : undefined,
      email: /@.+\./.test(email) ? email : undefined,
      exclude,
    };
    if (!params.identification && !params.telephone && !params.email) {
      setResult(EMPTY);
      return undefined;
    }
    const current = ++sequence.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await visitorApi.lookup(params);
        if (current === sequence.current) setResult({ visitor: response.visitor, matches: response.matches || [], conflict: !!response.conflict });
      } catch {
        if (current === sequence.current) setResult(EMPTY);
      } finally {
        if (current === sequence.current) setLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [enabled, idNumber, telephone, email, exclude]);

  return { result, loading };
}
