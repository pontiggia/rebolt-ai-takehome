'use client';

import { useCallback, useState } from 'react';

export function useDisclosure(defaultExpanded = false) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  return {
    expanded,
    toggle,
  } as const;
}
