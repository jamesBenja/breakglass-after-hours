const TOKEN_STORAGE_KEY = 'breakglass.invitation.token';
const TYPE_STORAGE_KEY = 'breakglass.invitation.type';
const DEFAULT_SERVER = 'https://multiplayer-phase2-webrtc-production.up.railway.app';

export const GOD_MODE_INVITATION_PROFILE = Object.freeze({
  id: 'godmode',
  label: 'THEY WHO REMAIN',
  defaultRole: 'explorer',
  access: { guestlist: true, dj: true, studioFastTrack: true },
  intro:
    'This invitation belongs to they who remain. God Mode opens the building as a living archive: doors, rooms, shortcuts and hidden systems are available without normal progression requirements.',
  accessNote:
    'All access is open in God Mode. You do not need the guestlist, mission completion, collected keys, NPC approval or progression unlocks.',
});

export function invitationDisplayProfile(profileInput = null, godMode = false) {
  if (godMode === true || profileInput?.id === GOD_MODE_INVITATION_PROFILE.id)
    return GOD_MODE_INVITATION_PROFILE;
  return invitationProfile(profileInput?.id);
}

export const INVITATION_PROFILES = {
  participant: {
    id: 'participant',
    label: 'PARTICIPANT / EXPLORER',
    defaultRole: 'explorer',
    access: { guestlist: false, dj: false, studioFastTrack: false },
    intro:
      'You have been invited to spend the night inside Breakglass Studios as a participant and explorer. Arrive through the alley, meet the people in the building, and find your way into the party.',
    accessNote:
      'Regular admission applies. Sam controls the front door. If you want to DJ, find James on the club floor and ask him if you can play tonight.',
  },
  guestlist: {
    id: 'guestlist',
    label: 'GUESTLIST',
    defaultRole: 'explorer',
    access: { guestlist: true, dj: false, studioFastTrack: false },
    intro:
      'You have been invited to Breakglass Studios and your name is already on tonight’s guestlist. The building is yours to explore once Sam checks you in.',
    accessNote:
      'Tell Sam you are on the guestlist. If you want to DJ, you still need to find James on the club floor and ask him if you can play tonight.',
  },
  dj: {
    id: 'dj',
    label: 'DJ',
    defaultRole: 'dj',
    access: { guestlist: true, dj: true, studioFastTrack: false },
    intro:
      'You have been invited to Breakglass Studios to DJ tonight. Your name and role are already with the door, and the booth is available to you when it is free.',
    accessNote:
      'Tell Sam “I’m the DJ tonight” and he will let you in. You do not need James to approve your booth access.',
  },
  producer: {
    id: 'producer',
    label: 'PRODUCER / MUSICIAN',
    defaultRole: 'producer',
    access: { guestlist: true, dj: false, studioFastTrack: true },
    intro:
      'You have been invited to Breakglass Studios as a producer or musician. You are on tonight’s guestlist and your invitation includes direct studio access through Zander.',
    accessNote:
      'Tell Sam you are on the guestlist. Talk to Zander when you want to go upstairs and he will recognize this invitation. DJing still requires asking James on the club floor.',
  },
  residentproducer: {
    id: 'residentproducer',
    label: 'RESIDENT PRODUCER',
    defaultRole: 'producer',
    access: { guestlist: true, dj: false, studioFastTrack: true },
    entry: { sceneId: 'upstairs', position: [4.85, 0, -2.3] },
    intro:
      'You have been invited to Breakglass Studios as a resident producer. Your studio access is already active, so this invitation takes you directly into the upstairs recording studio.',
    accessNote:
      'You begin inside the Live Room with studio access already cleared. No front-door check-in or Zander handoff is required. DJing still requires asking James on the club floor.',
  },
  promoter: {
    id: 'promoter',
    label: 'PROMOTER',
    defaultRole: 'promoter',
    access: { guestlist: true, dj: false, studioFastTrack: false },
    intro:
      'You have been invited to Breakglass Studios as a promoter. Your name is already on tonight’s guestlist, but the rest of the night still unfolds inside the building.',
    accessNote:
      'Tell Sam you are on the guestlist and he will check you in. If you want to DJ, find James on the club floor and ask him first.',
  },
};

export function invitationProfile(id) {
  return INVITATION_PROFILES[id] ?? INVITATION_PROFILES.participant;
}

function tokenFromLocation(locationRef = globalThis.location) {
  if (!locationRef) return null;
  const search = new URLSearchParams(locationRef.search || '');
  const hash = new URLSearchParams(String(locationRef.hash || '').replace(/^#/, ''));
  return hash.get('invite') || search.get('invite') || null;
}

function invitationTokenFreeUrl(locationRef = globalThis.location) {
  if (!locationRef) return null;
  const url = new URL(locationRef.href);
  url.searchParams.delete('invite');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  hash.delete('invite');
  const nextHash = hash.toString();
  url.hash = nextHash ? `#${nextHash}` : '';
  return url;
}

function stripInvitationToken(locationRef = globalThis.location, historyRef = globalThis.history) {
  const url = invitationTokenFreeUrl(locationRef);
  if (url && historyRef?.replaceState)
    historyRef.replaceState(historyRef.state, globalThis.document?.title ?? '', url.href);
}

function stored(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function remember(token, type) {
  try {
    globalThis.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
    globalThis.localStorage?.setItem(TYPE_STORAGE_KEY, type);
  } catch {
    // The invitation still works for this visit if storage is blocked.
  }
}

function forgetInvitation() {
  try {
    globalThis.localStorage?.removeItem(TOKEN_STORAGE_KEY);
    globalThis.localStorage?.removeItem(TYPE_STORAGE_KEY);
  } catch {
    // Restricted/private storage can be ignored.
  }
}

function verificationServer(locationRef = globalThis.location) {
  const params = new URLSearchParams(locationRef?.search || '');
  const configured = params.get('server') || DEFAULT_SERVER;
  try {
    const url = new URL(configured, locationRef?.href || DEFAULT_SERVER);
    if (url.protocol === 'wss:') url.protocol = 'https:';
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_SERVER;
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return DEFAULT_SERVER;
  }
}

export async function resolveInvitationAccess({ fetchRef = globalThis.fetch } = {}) {
  const linkToken = tokenFromLocation();
  const token = linkToken || stored(TOKEN_STORAGE_KEY);
  if (!token) return { ...invitationProfile('participant'), verified: false, source: 'default' };

  try {
    const response = await fetchRef(`${verificationServer()}/invite/verify`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true || !INVITATION_PROFILES[payload.type]) {
      forgetInvitation();
      if (linkToken) stripInvitationToken();
      return { ...invitationProfile('participant'), verified: false, source: 'invalid' };
    }
    remember(token, payload.type);
    if (linkToken) stripInvitationToken();
    return {
      ...invitationProfile(payload.type),
      verified: true,
      source: linkToken ? 'link' : 'stored',
    };
  } catch {
    if (linkToken) stripInvitationToken();
    return { ...invitationProfile('participant'), verified: false, source: 'unavailable' };
  }
}

export function invitationSaveKey(profile) {
  const id = typeof profile === 'string' ? profile : profile?.id;
  if (!id || id === 'participant') return undefined;
  return `breakglass.after-hours.invite.${id}.v1`;
}

export function applyInvitationAccess(game, profile) {
  if (!game?.state?.data) return false;
  const resolved = invitationProfile(profile?.id);
  const state = game.state.data;
  state.invitationType = resolved.id;
  state.invitationAccess = { ...resolved.access };
  if (resolved.access.guestlist) state.guestlistApproved = true;
  if (resolved.access.dj) state.djAccessGranted = true;
  if (resolved.access.studioFastTrack) state.studioInviteAccess = true;
  if (resolved.entry?.sceneId === 'upstairs') state.studioAccessGranted = true;
  game.invitation = resolved;
  game.save?.();
  return true;
}

function letterHints(profile) {
  if (profile.id === 'godmode') {
    return [
      'They Who Remain enter with the building already open.',
      'The roof freight elevator is available immediately. No missions, keys, founder stories or other completion checks are required.',
      'Guestlist, DJ booth, studio, storage, archive, Dead Room and shortcut access are already cleared.',
      'You can still play any minigame, mission or conversation normally if you want to experience it.',
      'God Mode is for exploring, testing and revisiting the whole Breakglass archive without progression gates.',
    ];
  }
  const residentProducer = profile.id === 'residentproducer';
  const roleHint =
    profile.id === 'dj'
      ? 'At the door, tell Sam you are the DJ. Once inside, the booth is already cleared for you.'
      : residentProducer
        ? 'Your resident producer invitation starts inside the upstairs Live Room with studio access already cleared.'
        : profile.id === 'producer'
          ? 'Zander can take you upstairs immediately when you show up with this producer / musician invitation.'
          : profile.access.guestlist
            ? 'At the door, tell Sam you are on the guestlist.'
            : 'Sam runs the door. There are several ways to earn your way inside if your name is not on the guestlist.';
  return [
    residentProducer
      ? 'You begin upstairs in the recording studio rather than outside in the alley.'
      : 'You begin outside in the alley. Explore rather than rushing: conversations change what you can access.',
    'Green names identify people worth talking to. Some conversations unlock rooms, shortcuts, activities and secrets.',
    roleHint,
    profile.access.dj
      ? 'You can take over the DJ booth without finding James first.'
      : 'Want to DJ? Find James on the club floor and tell him you would like to DJ tonight.',
    residentProducer
      ? 'You can head downstairs whenever you want to join the party; your guestlist access remains active.'
      : 'Keep the alley reasonably quiet. If police arrive, either find James and tell him, or go to the alley and deal with them yourself.',
    'The game rewards curiosity. Not every useful interaction looks like a mission marker.',
  ];
}

export function mountInvitationLetter(documentRef = globalThis.document, profileInput = null) {
  if (!documentRef) return null;
  const profile = invitationDisplayProfile(profileInput);
  const card = documentRef.querySelector('#gate .avatar-card');
  if (!card || card.dataset.invitationMounted === '1') return card;
  card.dataset.invitationMounted = '1';
  card.classList.add('invitation-card');

  const heading = card.querySelector('h1');
  const intro = card.querySelector(':scope > p');
  const form = card.querySelector('#avatarForm');
  const enter = card.querySelector('#enter');
  const role = documentRef.getElementById('avatarRole');

  if (heading) heading.textContent = 'YOU’RE INVITED TO BREAKGLASS';
  if (intro) intro.textContent = profile.intro;
  if (enter) enter.textContent = 'ACCEPT INVITATION + ENTER BREAKGLASS';
  if (role && profile.defaultRole) role.value = profile.defaultRole;

  const envelope = documentRef.createElement('section');
  envelope.className = 'invite-envelope';
  envelope.innerHTML = `
    <div class="invite-envelope-flap"></div>
    <div class="invite-envelope-address">
      <span>BREAKGLASS STUDIOS</span>
      <strong>PRIVATE INVITATION</strong>
      <small>${profile.label}</small>
    </div>
    <div class="invite-seal">BG</div>
  `;
  const open = documentRef.createElement('button');
  open.type = 'button';
  open.className = 'invite-open';
  open.textContent = 'OPEN INVITATION';
  open.onclick = () => card.classList.add('invitation-open');
  envelope.appendChild(open);
  card.prepend(envelope);

  const details = documentRef.createElement('section');
  details.className = 'invite-letter-details';
  const access = documentRef.createElement('div');
  access.className = 'invite-access-stamp';
  access.innerHTML = `<small>YOUR INVITATION</small><strong>${profile.label}</strong>`;
  const note = documentRef.createElement('p');
  note.className = 'invite-access-note';
  note.textContent = profile.accessNote;
  const hintTitle = documentRef.createElement('h2');
  hintTitle.textContent = 'BEFORE YOU ARRIVE';
  const hints = documentRef.createElement('ul');
  hints.className = 'invite-hints';
  for (const text of letterHints(profile)) {
    const item = documentRef.createElement('li');
    item.textContent = text;
    hints.appendChild(item);
  }
  details.append(access, note, hintTitle, hints);
  if (form) card.insertBefore(details, form);
  else card.appendChild(details);
  return card;
}

function targetId(target) {
  return target?.npcId ?? target?.id ?? '';
}

function policeState(game) {
  return game?.scenes?.get?.('alley')?.alley?.snapshot?.() ?? null;
}

export function installInvitationAccess(game, ui, profileInput) {
  if (!game || game._invitationAccessInstalled) return;
  game._invitationAccessInstalled = true;
  const profile = invitationProfile(profileInput?.id);
  const state = game.state?.data;
  const save = () => game.save?.();
  const syncGates = () => game.sceneManager.current?.progressionGates?.sync?.(state ?? {});

  const bouncer = game.crowdDoor?.bouncer;
  if (bouncer) {
    const baseHandle = bouncer.handle.bind(bouncer);
    const baseGuestPanel = bouncer.guestPanel.bind(bouncer);
    bouncer.guestPanel = () => {
      if (profile.id !== 'dj') return baseGuestPanel();
      ui.panel('SAM · FRONT DOOR', 'Sam looks up from the list. “You working tonight?”', [
        [
          'I’m the DJ tonight',
          () => {
            state.djAccessGranted = true;
            state.guestlistApproved = true;
            save();
            ui.warning?.('Sam recognizes the DJ invitation and waves you through.');
            bouncer.enter();
          },
        ],
        [
          'I’m on the guestlist',
          () => {
            ui.warning?.('Sam finds your name on the guestlist and waves you through.');
            bouncer.enter();
          },
        ],
      ]);
    };
    bouncer.handle = (target) => {
      const id = targetId(target);
      const isSam = target?.action === 'dialogue' && (id === 'sam' || id === 'bouncer');
      if (!isSam || game.sceneManager.current?.definition?.id !== 'alley')
        return baseHandle(target);
      if (bouncer.admitted) return baseHandle(target);
      if (Number(bouncer.waitUntil || 0) > Number(bouncer.elapsed || 0)) {
        bouncer.waitingPanel?.();
        return true;
      }
      bouncer.guestPanel();
      return true;
    };
  }

  const baseDispatch = game.interactions?.dispatch?.bind(game.interactions);
  if (baseDispatch) {
    game.interactions.dispatch = (target) => {
      const sceneId = game.sceneManager.current?.definition?.id;
      const id = targetId(target);

      if (
        sceneId === 'downstairs' &&
        target?.action === 'dj' &&
        !game.godMode &&
        state?.djAccessGranted !== true
      ) {
        ui.panel(
          'DJ BOOTH · NOT CLEARED YET',
          'If you want to play tonight, find James on the club floor and tell him you would like to DJ.',
          [],
        );
        return;
      }

      if (
        sceneId === 'downstairs' &&
        target?.action === 'dialogue' &&
        id === 'zander' &&
        state?.studioInviteAccess === true &&
        state?.studioAccessGranted !== true
      ) {
        state.studioAccessGranted = true;
        save();
        syncGates();
        ui.panel(
          'ZANDER · STUDIO ACCESS',
          'Zander recognizes the producer / musician invitation. “You’re good. Studio is upstairs — go make something.”',
          [],
        );
        return;
      }

      if (sceneId === 'downstairs' && target?.action === 'dialogue' && id === 'james') {
        if (state?.guestlistReferralPending === true && state?.guestlistApproved !== true) {
          baseDispatch(target);
          return;
        }
        const actions = [];
        if (!game.godMode && state?.djAccessGranted !== true) {
          actions.push([
            'I’d like to DJ tonight',
            () => {
              state.djAccessGranted = true;
              save();
              ui.panel(
                'JAMES · DJ ACCESS',
                '“Yeah, absolutely. The booth is yours when it’s free. Go check what’s happening down there and jump on.”',
                [],
              );
            },
          ]);
        }
        const police = policeState(game);
        if (police?.policePresent) {
          actions.push([
            'Police are outside — can you handle it?',
            () => {
              const alley = game.scenes.get('alley')?.alley;
              const result = alley?.resolvePolice?.('cooperate');
              state.policeDecisionPending = false;
              state.policePlan = 'james';
              save();
              ui.panel(
                'JAMES · I’VE GOT IT',
                `“Yeah. Stay inside — I’ll deal with them.” James heads out to speak with the officers.${result ? ` ${result}` : ''}`,
                [],
              );
            },
          ]);
        }
        if (actions.length) {
          actions.push(['Talk about something else', () => baseDispatch(target)]);
          ui.panel('JAMES', 'James looks over. “What’s up?”', actions);
          return;
        }
      }

      baseDispatch(target);
    };
  }

  let lastPolicePresent = false;
  const baseUpdate = game.update.bind(game);
  game.update = (...args) => {
    const result = baseUpdate(...args);
    const police = policeState(game);
    const present = police?.policePresent === true;
    if (present && !lastPolicePresent) {
      state.policeDecisionPending = true;
      save();
      ui.panel(
        'POLICE HAVE ARRIVED',
        'Police are outside in the alley after a complaint. You can find James on the club floor and tell him, or go down to the alley and try to deal with them yourself.',
        [
          [
            'I’ll find James',
            () => {
              state.policePlan = 'find-james';
              save();
              ui.warning?.('Find James on the club floor and tell him the police are outside.');
            },
          ],
          [
            'I’ll talk to the police myself',
            () => {
              state.policePlan = 'self';
              save();
              ui.warning?.(
                'Head to the alley and talk to the officers before the warning expires.',
              );
            },
          ],
        ],
      );
    }
    if (!present && lastPolicePresent) {
      state.policeDecisionPending = false;
      save();
    }
    lastPolicePresent = present;
    return result;
  };
}
