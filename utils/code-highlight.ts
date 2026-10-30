import { createLowlight } from 'lowlight'
import bash from 'highlight.js/lib/languages/bash'
import cmd from 'highlight.js/lib/languages/dos'
import json from 'highlight.js/lib/languages/json'
import lua from 'highlight.js/lib/languages/lua'
import powershell from 'highlight.js/lib/languages/powershell'
import sql from 'highlight.js/lib/languages/sql'

/** One grammar per `CODE_LANGUAGES` entry except `text`. Imported on demand: only a page with a code fence pays for it. */
export const lowlight = createLowlight({ bash, cmd, json, lua, powershell, sql })
