from pathlib import Path

path = Path('server/multiplayerServer.mjs')
text = path.read_text()

import_anchor = "import crypto from 'node:crypto';\n"
import_line = "import { invitationTypeFromFingerprint } from './inviteTokenFingerprints.js';\n"
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('crypto import anchor not found')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

loop_anchor = "  for (const type of INVITE_TYPES) {\n    if (secureTokenMatch(candidate, INVITE_TOKENS[type])) return type;\n  }\n\n"
fingerprint_block = "  const fingerprintType = invitationTypeFromFingerprint(candidate, crypto);\n  if (fingerprintType) return fingerprintType;\n\n"
if fingerprint_block not in text:
    if loop_anchor not in text:
        raise SystemExit('invite token loop anchor not found')
    text = text.replace(loop_anchor, loop_anchor + fingerprint_block, 1)

path.write_text(text)
