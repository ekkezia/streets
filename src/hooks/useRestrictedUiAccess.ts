"use client";

import { useEffect, useState } from "react";

type RestrictedUiAccessResponse = {
  isAllowed?: boolean;
};

const useRestrictedUiAccess = () => {
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    let disposed = false;

    const loadAccess = async () => {
      try {
        const response = await fetch("/api/restricted-ui-access", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as RestrictedUiAccessResponse;
        if (!disposed) {
          setIsAllowed(payload.isAllowed === true);
        }
      } catch {
        if (!disposed) {
          setIsAllowed(false);
        }
      }
    };

    loadAccess();

    return () => {
      disposed = true;
    };
  }, []);

  return isAllowed;
};

export default useRestrictedUiAccess;
