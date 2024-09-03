"use client";

import { useEffect, useState } from "react";

const useDeviceDetect = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const detectDevice = () => {
      if (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        )
      ) {
        setIsMobile(true);
        console.log("is mobile");
      } else {
        setIsMobile(false);
        console.log("is not mobile");
      }
    };

    detectDevice();

    return () => {
      setIsMobile(false);
    };
  }, []);

  return { isMobile };
};

export default useDeviceDetect;
