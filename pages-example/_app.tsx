import type { AppProps } from 'next/app';
import '../src/app/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}