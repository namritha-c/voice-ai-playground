import { MODES, type Mode } from '@/api/types';
import Playground from '@/views/Playground';

/** Only /tts, /stt and /sts exist; anything else is a 404 at routing time. */
export const dynamicParams = false;
export const generateStaticParams = () => MODES.map((mode) => ({ mode }));

export default async function PlaygroundPage({ params }: PageProps<'/[mode]'>) {
  const { mode } = await params;
  return <Playground key={mode} mode={mode as Mode} />;
}
