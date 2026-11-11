// Minimal typings for the parts of MindAR's prebuilt bundle that we use.
declare module 'mind-ar/dist/mindar-image.prod.js' {
  export interface MatchingKeyframe {
    maximaPoints: unknown[];
    minimaPoints: unknown[];
  }
  export interface CompiledTarget {
    targetImage: { width: number; height: number };
    matchingData: MatchingKeyframe[];
  }
  export class Compiler {
    data: CompiledTarget[] | null;
    compileImageTargets(
      images: HTMLImageElement[],
      progress: (percent: number) => void,
    ): Promise<CompiledTarget[]>;
    exportData(): Uint8Array;
  }
  export interface ControllerOptions {
    inputWidth: number;
    inputHeight: number;
    maxTrack?: number;
    filterMinCF?: number | null;
    filterBeta?: number | null;
    warmupTolerance?: number | null;
    missTolerance?: number | null;
    onUpdate?: (data: { type: string; targetIndex?: number; worldMatrix?: number[] | null }) => void;
  }
  export class Controller {
    constructor(options: ControllerOptions);
    inputWidth: number;
    inputHeight: number;
    addImageTargetsFromBuffer(buffer: ArrayBuffer | Uint8Array): { dimensions: [number, number][] };
    dummyRun(input: HTMLVideoElement): void;
    processVideo(input: HTMLVideoElement): void;
    stopProcessVideo(): void;
    getProjectionMatrix(): number[];
    dispose(): void;
  }
}
