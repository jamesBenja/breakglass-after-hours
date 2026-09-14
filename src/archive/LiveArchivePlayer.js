export function showLiveArchivePlayer(ui, session, onClose = () => {}) {
  if (!ui?.document || !session) return false;
  ui.clearPanel(
    'LIVE ROOM · LIVE FROM BREAKGLASS',
    `${session.label} · ${session.source}. Loaded from the historic Neve archive station.`,
  );

  if (!session.youtubeId) {
    const note = ui.document.createElement('p');
    note.textContent = 'This archive slot is catalogued, but its playable media has not been attached yet.';
    ui.buttons.appendChild(note);
  } else {
    const frame = ui.document.createElement('iframe');
    frame.title = session.label;
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(session.youtubeId)}?autoplay=1&playsinline=1&rel=0`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    Object.assign(frame.style, {
      width: 'min(72vw, 760px)',
      maxWidth: '100%',
      aspectRatio: '16 / 9',
      border: '1px solid rgba(255,255,255,.22)',
      borderRadius: '8px',
      background: '#09090b',
      display: 'block',
    });
    ui.buttons.appendChild(frame);
  }

  const close = ui.document.createElement('button');
  close.textContent = 'Close screening';
  close.onclick = () => onClose();
  ui.buttons.appendChild(close);
  return true;
}
