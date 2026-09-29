// Stroke icons from the design.
type P = { size?: number };
const S = (size: number, sw = 1.7) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const IconWave = ({ size = 20 }: P) => <svg {...S(size)}><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></svg>;
export const IconCompare = ({ size = 20 }: P) => <svg {...S(size)}><rect x="3.5" y="4.5" width="7" height="15" rx="2" /><rect x="13.5" y="4.5" width="7" height="15" rx="2" /></svg>;
export const IconPlug = ({ size = 20 }: P) => <svg {...S(size)}><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" /></svg>;
export const IconSliders = ({ size = 20 }: P) => <svg {...S(size)}><path d="M4 7h9M18 7h2M4 17h3M12 17h8" /><circle cx="15.5" cy="7" r="2.3" /><circle cx="9.5" cy="17" r="2.3" /></svg>;
export const IconChevron = ({ size = 16 }: P) => <svg {...S(size, 2)}><path d="M6 9l6 6 6-6" /></svg>;
export const IconMic = ({ size = 15 }: P) => <svg {...S(size, 1.8)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>;
export const IconUpload = ({ size = 15 }: P) => <svg {...S(size, 1.8)}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>;
export const IconDownload = ({ size = 18 }: P) => <svg {...S(size, 1.8)}><path d="M12 4v11M7 10l5 5 5-5M4 20h16" /></svg>;
export const IconCode = ({ size = 18 }: P) => <svg {...S(size, 1.8)}><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg>;
export const IconArrowUpRight = ({ size = 16 }: P) => <svg {...S(size, 2)}><path d="M7 17L17 7M9 7h8v8" /></svg>;
export const IconSearch = ({ size = 15 }: P) => <svg {...S(size, 2)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
export const IconReset = ({ size = 14 }: P) => <svg {...S(size, 2)}><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" /></svg>;
export const IconPlay = ({ size = 20 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>;
export const IconStop = ({ size = 18 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5" /></svg>;
export const IconPause = ({ size = 18 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" /></svg>;
export const IconClose = ({ size = 16 }: P) => <svg {...S(size, 2)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconKey = ({ size = 16 }: P) => <svg {...S(size, 1.8)}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3M14 9l2 2" /></svg>;
export const IconCheck = ({ size = 14 }: P) => <svg {...S(size, 2.2)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
