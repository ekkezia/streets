import Phone from '@/components/molecules/phone';
import { CarousellContextProvider } from "@/contexts/carousell-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CarousellContextProvider>
      <main className="flex w-full items-center justify-center">
        {children}
        <Phone />
      </main>
    </CarousellContextProvider>
  );
}
