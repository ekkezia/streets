"use client";

import { useCarousellContext } from "@/contexts/carousell-context";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CHAT = [
  {
    message: <p>hii, is this still avail? :3</p>,
    role: "buyer",
    path: 1,
  },
  {
    message: (
      <div>
        <p>
          Made An Offer&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          &nbsp;&nbsp;
        </p>{" "}
        <b>HK$ 90</b>
      </div>
    ),
    role: "buyer",
    path: 1,
  },
  {
    message: <p>yes</p>,
    role: "seller",
    path: 1,
  },
  {
    message: (
      <div>
        <p>
          Accepted Offer&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          &nbsp;&nbsp;
        </p>{" "}
        <b>HK$ 90</b>
      </div>
    ),
    role: "seller",
    path: 1,
  },
  {
    message: <p>im available around Temple St Jordan at 5pm today</p>,
    role: "seller",
    path: 1,
  },
  {
    message: <p>perfect! see you soon then ^^</p>,
    role: "buyer",
    path: 1,
  },
  {
    message: <p>hey look at this </p>,
    role: "seller",
    path: 2,
    img: "https://i.imgur.com/vQGXw3B.jpeg",
  },
  {
    message: <p>omg </p>,
    role: "buyer",
    path: 2,
  },
  {
    message: <p>i'm around a karaoke place</p>,
    role: "seller",
    path: 4,
    img: "/images/3.JPG",
  },
  {
    message: <p>okay</p>,
    role: "buyer",
    path: 4,
  },
  {
    message: <p>i'm around a karaoke place</p>,
    role: "seller",
    path: 5,
    img: "/images/3.JPG",
  },
  {
    message: <p>omg </p>,
    role: "buyer",
    path: 5,
  },
];

const getCurrentTime = () => {
  return new Date(Date.now()).toLocaleTimeString();
};

const Phone = () => {
  const pathname = usePathname();

  const { display, setDisplay } = useCarousellContext();

  const chatRef = useRef<HTMLDivElement | null>(null);

  const [notification, setNotification] = useState<number>(0);

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    setNotification(notification + 1);
  }, [pathname]);

  const handleClickButton = () => {
    setDisplay(!display);
    setNotification(0);
  };

  return (
    <AnimatePresence>
      {/* Button */}
      <div
        className={`absolute bottom-0 h-12 w-12 rounded-full bg-red-500 ${display ? "block" : "none"}`}
        onClick={handleClickButton}
      >
        <img
          src="/images/carousell-logo.png"
          alt="carousell-logo"
          className="h-12 w-12 object-contain"
        />
      </div>

      {/* Notification Flag */}
      {notification > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className={`absolute bottom-12 ml-12 h-6 w-6 rounded-full bg-green-300 ${display ? "block" : "none"} flex items-center justify-center text-xs`}
        >
          {notification}
        </motion.span>
      )}
      {display && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute bottom-14 h-full w-full rounded-xl bg-white sm:h-[600px] sm:w-[360px]"
        >
          {/* Profile */}
          <div className="flex h-[60px] w-full items-center justify-between gap-4 overflow-hidden rounded-t-xl bg-red-500 p-4">
            <div className="text-white">←</div>
            <div className="flex flex-col items-center justify-center">
              <b className="text-center text-white">09sweetheart09</b>
              <p className="flex items-center gap-1 text-center text-xs text-white">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                Online
              </p>
            </div>
            <div className="text-white">...</div>
          </div>

          {/* Item */}

          {/* Chat */}
          <div
            className="relative flex flex-col gap-1 overflow-y-scroll p-2"
            style={{ height: 600 - 60 }}
            ref={chatRef}
          >
            {CHAT.filter(
              (item) => item.path <= parseInt(pathname.split("/")[2]),
            ).map((item, idx) => {
              return (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.1, delay: idx * 0.2 }}
                  className={`${item.role == "seller" ? "justify-start" : "justify-end"} flex items-end`}
                  key={idx}
                >
                  {/* Profile Pic */}
                  {item.role == "buyer" ? (
                    <></>
                  ) : CHAT[(idx + 1) % CHAT.length].role == "buyer" ? (
                    <div className="mr-1 h-8 w-8 rounded-full bg-pink-300">
                      👧🏻
                    </div>
                  ) : (
                    <div className="w-9" />
                  )}

                  <div
                    className={`${item.role == "seller" ? "items-start bg-slate-200 text-slate-600" : "items-end bg-blue-900 text-white"} bg-blue flex w-fit flex-col gap-2 rounded-xl p-2`}
                  >
                    {item.message}
                    {item.img && (
                      <img
                        src={item.img}
                        className="h-48 w-48 object-cover"
                        alt={item.img}
                      />
                    )}
                    <p className="text-xs">
                      <span>16:00</span>
                      {item.role == "buyer" && (
                        <span className="text-blue-400">✓</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Phone;
