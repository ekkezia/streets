import LocationMap from '@/components/atoms/location-map';
import MediaTranscript from '@/components/atoms/media-transcript';
import SideMenu from '@/components/molecules/side-menu';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <main className="flex w-full items-center justify-center">
        <SideMenu projectId='new-york-city' />
        <MediaTranscript projectId='new-york-city' />
        <LocationMap projectId='new-york-city' width={400} height={266} zoom={18} />
        {children}
      </main>
  );
}
