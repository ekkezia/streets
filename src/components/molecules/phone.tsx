"use client";

import { useCarousellContext } from "@/contexts/carousell-context";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CHAT from '@/config/hkg-chat-config';

const getCurrentTime = () => {
  return new Date(Date.now()).toLocaleTimeString();
};

const Phone = () => {
  const pathname = usePathname();

  const { display, setDisplay } = useCarousellContext();

  const chatRef = useRef<HTMLDivElement | null>(null);

  const [notification, setNotification] = useState<number>(0);

  const [isChatWindow, setIsChatWindow] = useState<boolean>(true);

  const [time, setTime] = useState<string | null>('');

  const scrollToBottom = () => {
    if (chatRef.current) {
              console.log('should scroll', chatRef.current.scrollHeight)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    setNotification((prevNotif) => prevNotif + 1);
  }, [pathname, display, isChatWindow]);

  const handleClickButton = () => {
    setDisplay(!display);
    setNotification(0);
  };


useEffect(() => {
  setTime(getCurrentTime());
}, [])

const handleBack = () => {
  setIsChatWindow(false)
}

  return (
    <AnimatePresence>
      {/* Button */}
      <div
        className={`absolute bottom-4 h-14 w-14 sm:left-auto left-4 rounded-full bg-red-500 flex items-center justify-center`}
        onClick={handleClickButton}
      >
        <img
          src="/images/carousell-logo.png"
          alt="carousell-logo"
          className="h-10 w-10 object-contain"
        />
      </div>

      {/* Notification Flag */}
      {notification > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className={`absolute sm:left-auto left-4 bottom-12 ml-12 h-6 w-6 rounded-full bg-green-300 flex items-center justify-center text-xs`}
        >
          {notification}
        </motion.span>
      )}

      {/* Chat UI */}
      {display && isChatWindow && (
        <motion.div
        key="chat-ui"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute bottom-20 h-[550px] w-[90vw] rounded-xl bg-white sm:w-[360px]"
        >
          {/* Profile */}
          <div className="flex h-[60px] w-full items-center justify-between gap-4 overflow-hidden rounded-t-xl bg-red-500 p-4">
            <div className="text-white" onClick={handleBack}>←</div>
            <div className="flex flex-col items-center justify-center">
              <b className="text-center text-white text-[16px]">09sweetheart09</b>
              <p className="flex items-center gap-1 text-center text-[12px] text-white">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                Online
              </p>
            </div>
            <div className="text-white"></div>
          </div>


          {/* Chat */}
          <div
            className="relative flex flex-col gap-1 overflow-y-scroll p-2"
            id="chat-container"
            style={{ height: 550 - 60 }}
            ref={chatRef}
          >
            {CHAT.filter(
              (item) => item.path <= parseInt(pathname.split("/")[2]),
            ).map((item, idx) => {
              const isMatch = item.path === parseInt(pathname.split("/")[2]); 
              return (
                <motion.div
                  initial={isMatch ? { scale: 0 } : false}
                  animate={isMatch ? { scale: 1 } : false}
                  transition={{ duration: 0.1, delay: idx * 0.2 }}
                  className={`${item.role == "seller" ? "justify-start" : "justify-end"} flex items-end`}
                  key={`${item.message}`}
                >
                  {/* Profile Pic */}
                  {item.role == "buyer" ? (
                    <></>
                  ) : CHAT[(idx + 1) % CHAT.length].role == "buyer" ? (
                    <div className="mr-1 h-8 w-8 rounded-full bg-pink-300 flex items-center justify-center">
                      🎀
                    </div>
                  ) : (
                    <div className="w-9" />
                  )}

                  <div
                    className={`${item.role == "seller" ? "items-start bg-slate-200 text-slate-600" : "items-end bg-blue-900 text-white"} bg-blue flex w-fit flex-col gap-2 rounded-xl p-2`}
                  >
                    <p className="text-[14px]">
                      {item.message}
                    </p>
                    {item.img && (
                      <img
                        src={item.img}
                        className="h-48 w-48 object-cover"
                        alt={item.img}
                      />
                    )}
                    <p className="text-[10px]">
                      <span>16:00</span>
                      {item.role == "buyer" && (
                        <span className="text-blue-400">&nbsp;✓</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}


      {/* Listing UI */}
      {display && !isChatWindow && (
        <motion.div
        key="listing-ui"
          className="absolute bottom-20 w-[90vw] rounded-xl bg-white h-[550px] sm:w-[360px]"
        >
          {/* Profile */}
          <div className="flex h-[60px] w-full items-center justify-between gap-4 overflow-hidden rounded-t-xl bg-white p-4">
            <div className="text-gray-500"></div>
            <b className="text-center text-gray-500 text-[16px]">Listing</b>
            <div></div>
          </div>

          {/* Listing Container */}
          <div
            className="relative flex flex-col gap-1 overflow-y-scroll p-2"
            id="listi-container"
            style={{ height: 550 - 60 - 76.5 }}
          >
            <img src="/images/4.JPG" alt="carousell-banner" className="aspect-square w-full" />

            <b className="text-gray-700 text-sm">Girly Shawl for the Best Girl in the World</b>
            <b className="text-gray-900 text-xl">HK$1000</b>
            <p className="text-gray-400 text-xs">⏱️ {time} ago</p>
            <p className="text-gray-400 text-xs"><span>❤️</span> 808</p>
            <p></p>
            <b className="text-gray-400 text-xs">Description</b>
            <p className="text-gray-500 text-sm">Wrap yourself in elegance and warmth with our Girly Shawl, designed for the best girl in the world—YOU! This shawl is crafted from premium, ultra-soft fabric that feels like a gentle hug, perfect for cozy evenings or glamorous outings.</p>
          </div>

          <div className="w-full flex space-between absolute bottom-0 rounded-b-xl p-4 gap-4 bg-white sha">
            <div className="bg-white text-gray-500 p-2 w-full flex justify-center rounded-xl text-sm" onClick={() => setIsChatWindow(true)}>Chat</div>
            <div className="bg-red-500 text-white p-2 w-full flex justify-center rounded-xl text-sm" onClick={() => setIsChatWindow(true)}>Buy Now</div>
          </div>
        </motion.div>
      )}

    </AnimatePresence>
  );
};

export default Phone;
