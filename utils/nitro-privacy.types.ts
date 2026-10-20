export type UspApi = (command: 'addLink', param: number) => void

export type CmpApi = (command: 'addConsentLink') => void

declare global {
  interface Window {
    __uspapi?: UspApi
    __cmp?: CmpApi
  }
}
