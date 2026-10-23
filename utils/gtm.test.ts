import { describe, expect, it } from 'vitest'
import { consentFromTcf } from './gtm'

describe('consentFromTcf', () => {
  it('waits while the CMP dialog is open', () => {
    expect(consentFromTcf({ gdprApplies: true, eventStatus: 'cmpuishown' })).toBeNull()
  })

  it('grants everything where GDPR does not apply', () => {
    expect(consentFromTcf({ gdprApplies: false, eventStatus: 'tcloaded' })).toEqual({
      ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted',
    })
  })

  it('maps TCF purposes to Consent Mode', () => {
    const consents = { 1: true, 3: false, 4: true, 7: true }
    expect(consentFromTcf({ gdprApplies: true, eventStatus: 'useractioncomplete', purpose: { consents } })).toEqual({
      ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied',
    })
  })

  it('denies everything when storage is refused', () => {
    expect(consentFromTcf({ gdprApplies: true, eventStatus: 'useractioncomplete', purpose: { consents: {} } })).toEqual({
      ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    })
  })
})
