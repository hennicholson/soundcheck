import { redirect } from 'next/navigation';

/** There is one path. Send everybody down it. */
export default function Home() {
  redirect('/soundcheck');
}
