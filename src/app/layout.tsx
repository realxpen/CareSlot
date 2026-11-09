import type {Metadata} from 'next';
import './globals.css';

export const metadata:Metadata={
  title:'CareSlot | Clinic appointments',
  description:'Book, view, and manage clinic appointments. Koya Academy assessment.'
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
