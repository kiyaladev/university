/**
 * L'API `BarcodeDetector` du navigateur est expérimentale et absente des types
 * du DOM : on en décrit le minimum, pour que le lecteur de QR code soit typé.
 */
export {};

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
    };
  }
}
