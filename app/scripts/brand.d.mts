export declare const fish: {
  viewBox: string;
  body: string;
  tail: string;
  fins: string[];
  gill: string;
  eye: { cx: number; cy: number; r: number };
  ripple: string;
  tailPivot: [number, number];
  colors: Record<'fish' | 'deep' | 'eye' | 'ripple', string>;
};
export declare function fishGroup(opts?: {
  scale?: number;
  dy?: number;
  withRipple?: boolean;
  classes?: boolean;
}): string;
export declare function iconSvg(opts?: { size?: number; scale?: number; radius?: number }): string;
