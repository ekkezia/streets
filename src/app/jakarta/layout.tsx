import SideMenu from '@/components/molecules/side-menu';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <main className="flex w-full items-center justify-center">
        <SideMenu projectId='jakarta' />
        {children}
      </main>
  );
}
