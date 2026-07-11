import { clearOAuthParamsFromUrl } from '@lib/discord-oauth'

export {
  buildDiscordOAuthUrl,
  cleanupOAuthParams,
  clearOAuthParamsFromUrl,
  createOAuthState,
  exchangeAuthorizationCode,
  getOAuthParams,
  hasOAuthParams,
  isDiscordTokenValid,
  parseOAuthCallbackFromUrl,
  persistDiscordToken,
} from '@lib/discord-oauth'

export type { OAuthParams, OAuthTokens } from '@lib/discord-oauth'

/** @deprecated Use clearOAuthParamsFromUrl */
export function clearOAuthHashFromUrl() {
  clearOAuthParamsFromUrl()
}
