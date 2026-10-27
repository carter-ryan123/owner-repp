import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Campus Loop · Good finds. Better campus life.',description:'Buy, sell, and trade pre-loved textbooks, lab coats, and dorm essentials with students near your school.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
