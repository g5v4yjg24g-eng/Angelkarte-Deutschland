import { Composition } from 'remotion';
import { FPS, T } from './config';
import { FangpunktVideo } from './Video';

export function Root() {
  const durationInFrames = Math.round(T.total * FPS);
  return (
    <>
      <Composition id="Vertical" component={FangpunktVideo} defaultProps={{ format: 'vertical' as const }} durationInFrames={durationInFrames} fps={FPS} width={1080} height={1920} />
      <Composition id="Horizontal" component={FangpunktVideo} defaultProps={{ format: 'horizontal' as const }} durationInFrames={durationInFrames} fps={FPS} width={1920} height={1080} />
    </>
  );
}
