export type GtmAuthMethod = 'discord'

export type GtmEventName =
  | 'page_view'
  | 'login_start'
  | 'login'
  | 'login_error'
  | 'logout'
  | 'cta_click'
  | 'outbound_click'

export type GtmEventPayload = {
  page_view: {
    page_path: string
    page_location: string
    page_title: string
  }
  login_start: {
    method: GtmAuthMethod
  }
  login: {
    method: GtmAuthMethod
  }
  login_error: {
    method: GtmAuthMethod
    error_message: string
  }
  logout: Record<string, never>
  cta_click: {
    cta_name: string
    cta_location: string
    link_url: string
  }
  outbound_click: {
    link_url: string
    link_text: string
    link_location: string
  }
}
