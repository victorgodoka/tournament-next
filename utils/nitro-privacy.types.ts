type UspApi = (command: 'addLink', param: number) => void

type CmpApi = (command: 'addConsentLink') => void

declare global {
  interface Window {
    __uspapi?: UspApi
    __cmp?: CmpApi
  }
}

export {};
