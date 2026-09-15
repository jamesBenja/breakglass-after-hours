import { Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader } from 'three';
import { Hud } from '../ui/Hud.js';
import { PlayerController } from '../player/PlayerController.js';
import { normalizeFaceTexture } from './profile.js';

let installed = false;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read that photo.'));
    image.src = url;
  });
}

async function makeFaceTexture(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose a photo from the front camera.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 144;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Face capture is unavailable in this browser.');

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const targetAspect = canvas.width / canvas.height;
    const maxCropWidth = Math.min(sourceWidth, sourceHeight * targetAspect);
    const cropWidth = maxCropWidth * 0.74;
    const cropHeight = cropWidth / targetAspect;
    const sourceX = Math.max(0, sourceWidth * 0.5 - cropWidth * 0.5);
    const sourceY = Math.max(0, sourceHeight * 0.43 - cropHeight * 0.5);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.beginPath();
    context.ellipse(64, 72, 58, 68, 0, 0, Math.PI * 2);
    context.clip();
    context.drawImage(
      image,
      sourceX,
      sourceY,
      Math.min(cropWidth, sourceWidth - sourceX),
      Math.min(cropHeight, sourceHeight - sourceY),
      0,
      0,
      canvas.width,
      canvas.height,
    );
    context.restore();

    let dataUrl = canvas.toDataURL('image/webp', 0.8);
    if (!normalizeFaceTexture(dataUrl)) dataUrl = canvas.toDataURL('image/png');
    if (!normalizeFaceTexture(dataUrl))
      throw new Error('The processed face image is too large to save locally.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function stopCamera(stream) {
  for (const track of stream?.getTracks?.() ?? []) track.stop();
}

function snapshotVideo(ui, video) {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;
  const width = Math.min(720, sourceWidth);
  const height = Math.round((sourceHeight / sourceWidth) * width);
  const canvas = ui.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not capture a frame from the camera.');
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not capture a frame from the camera.'));
      },
      'image/jpeg',
      0.92,
    );
  });
}

async function takeCameraSelfie(ui, trigger, status) {
  const mediaDevices = globalThis.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    throw new Error('Live camera is unavailable in this browser. Use CHOOSE PHOTO INSTEAD.');
  }

  trigger.disabled = true;
  status.textContent = 'Requesting camera permission…';
  let stream;
  let dialog;
  try {
    stream = await mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    dialog = ui.document.createElement('dialog');
    dialog.className = 'avatar-camera-dialog';
    dialog.setAttribute('aria-label', 'Take avatar selfie');
    dialog.style.maxWidth = 'min(92vw, 620px)';
    dialog.style.width = '100%';

    const heading = ui.document.createElement('strong');
    heading.textContent = 'LIVE CAMERA · CENTER YOUR FACE';

    const help = ui.document.createElement('small');
    help.textContent =
      'Nothing is uploaded. Capture is processed locally into the small avatar face texture.';

    const video = ui.document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.display = 'block';
    video.style.width = '100%';
    video.style.margin = '12px 0';
    video.style.transform = 'scaleX(-1)';
    video.style.borderRadius = '8px';

    const row = ui.document.createElement('div');
    row.className = 'row';
    const useFrame = ui.document.createElement('button');
    useFrame.type = 'button';
    useFrame.textContent = 'CAPTURE SELFIE';
    const cancel = ui.document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'CANCEL';
    row.append(useFrame, cancel);
    dialog.append(heading, help, video, row);
    ui.document.body.appendChild(dialog);

    const result = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value, error = null) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(value);
      };
      useFrame.onclick = async () => {
        useFrame.disabled = true;
        status.textContent = 'Capturing face locally…';
        try {
          finish(await snapshotVideo(ui, video));
        } catch (error) {
          useFrame.disabled = false;
          finish(null, error);
        }
      };
      cancel.onclick = () => finish(null);
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(null);
      });
    });

    await video.play();
    dialog.showModal();
    return await result;
  } catch (error) {
    if (error?.name === 'NotAllowedError') {
      throw new Error(
        'Camera permission was denied. Allow camera access or use CHOOSE PHOTO INSTEAD.',
      );
    }
    if (error?.name === 'NotFoundError') {
      throw new Error('No camera was found. Use CHOOSE PHOTO INSTEAD.');
    }
    throw error;
  } finally {
    stopCamera(stream);
    dialog?.close?.();
    dialog?.remove?.();
    trigger.disabled = false;
  }
}

function syncFaceUi(ui) {
  const preview = ui.document.getElementById('avatarFacePreview');
  const status = ui.document.getElementById('avatarFaceStatus');
  const remove = ui.document.getElementById('avatarFaceRemove');
  const share = ui.document.getElementById('avatarFaceShare');
  const shareLabel = ui.document.getElementById('avatarFaceShareLabel');
  const hasFace = !!normalizeFaceTexture(ui._faceTextureData);
  if (preview) {
    preview.hidden = !hasFace;
    preview.src = hasFace ? ui._faceTextureData : '';
  }
  if (remove) remove.hidden = !hasFace;
  if (share) {
    share.disabled = !hasFace;
    if (!hasFace) share.checked = false;
  }
  if (shareLabel) shareLabel.hidden = !hasFace;
  if (status) {
    if (!hasFace) {
      status.textContent =
        'Optional. Opens your live camera when available. The photo is processed on this device and is not uploaded.';
    } else if (share?.checked) {
      status.textContent =
        'Face texture ready. Multiplayer sharing is ON, so the small processed texture will be sent to players in your live room.';
    } else {
      status.textContent =
        'Face texture ready. It stays in this browser unless you explicitly enable multiplayer sharing below.';
    }
  }
}

function ensureFaceUi(ui) {
  if (ui._faceUiInstalled) return;
  ui._faceUiInstalled = true;
  const form = ui.document.getElementById('avatarForm');
  if (!form) return;

  const host = ui.document.createElement('div');
  host.className = 'wide avatar-face-capture';

  const heading = ui.document.createElement('strong');
  heading.textContent = 'Use your face on the avatar';

  const preview = ui.document.createElement('img');
  preview.id = 'avatarFacePreview';
  preview.alt = 'Processed avatar face preview';
  preview.hidden = true;

  const controls = ui.document.createElement('div');
  controls.className = 'avatar-face-controls';
  const capture = ui.document.createElement('button');
  capture.type = 'button';
  capture.textContent = 'SCAN FACE / TAKE SELFIE';
  const choosePhoto = ui.document.createElement('button');
  choosePhoto.type = 'button';
  choosePhoto.textContent = 'CHOOSE PHOTO INSTEAD';
  const remove = ui.document.createElement('button');
  remove.type = 'button';
  remove.id = 'avatarFaceRemove';
  remove.textContent = 'REMOVE FACE IMAGE';
  remove.hidden = true;

  const input = ui.document.createElement('input');
  input.id = 'avatarFaceInput';
  input.type = 'file';
  input.accept = 'image/*';
  input.hidden = true;

  const shareLabel = ui.document.createElement('label');
  shareLabel.id = 'avatarFaceShareLabel';
  shareLabel.className = 'avatar-face-share';
  shareLabel.hidden = true;
  const share = ui.document.createElement('input');
  share.id = 'avatarFaceShare';
  share.type = 'checkbox';
  share.checked = false;
  const shareText = ui.document.createElement('span');
  shareText.textContent = 'Share my processed face texture with other players in multiplayer';
  shareLabel.append(share, shareText);

  const status = ui.document.createElement('small');
  status.id = 'avatarFaceStatus';

  capture.onclick = async () => {
    try {
      const photo = await takeCameraSelfie(ui, capture, status);
      if (!photo) {
        syncFaceUi(ui);
        return;
      }
      status.textContent = 'Processing face locally…';
      ui._faceTextureData = await makeFaceTexture(photo);
      syncFaceUi(ui);
    } catch (error) {
      status.textContent = error.message;
    }
  };
  choosePhoto.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    capture.disabled = true;
    choosePhoto.disabled = true;
    status.textContent = 'Processing face locally…';
    try {
      ui._faceTextureData = await makeFaceTexture(file);
      syncFaceUi(ui);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      capture.disabled = false;
      choosePhoto.disabled = false;
    }
  };
  remove.onclick = () => {
    ui._faceTextureData = null;
    share.checked = false;
    syncFaceUi(ui);
  };
  share.onchange = () => syncFaceUi(ui);

  controls.append(capture, choosePhoto, remove, input);
  host.append(heading, preview, controls, shareLabel, status);
  const photoConsent = ui.document.getElementById('avatarPhotos')?.closest('label');
  form.insertBefore(host, photoConsent ?? null);
  syncFaceUi(ui);
}

function applyFaceTexture(player) {
  const dataUrl = normalizeFaceTexture(player.avatar?.faceTexture);
  if (!player.facePatch) {
    player.facePatchMaterial = new MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.06,
      depthWrite: false,
      toneMapped: false,
    });
    player.facePatch = new Mesh(new PlaneGeometry(0.34, 0.39), player.facePatchMaterial);
    player.facePatch.position.set(0, -0.012, 0.258);
    player.facePatch.renderOrder = 3;
    player.head.add(player.facePatch);
  }

  if (!dataUrl) {
    player.facePatch.visible = false;
    player._faceTextureSource = null;
    player._faceTexture?.dispose?.();
    player._faceTexture = null;
    player.facePatchMaterial.map = null;
    player.facePatchMaterial.needsUpdate = true;
    return;
  }

  player.facePatch.visible = true;
  if (player._faceTextureSource === dataUrl && player._faceTexture) return;
  player._faceTextureSource = dataUrl;
  const requested = dataUrl;
  new TextureLoader().load(
    dataUrl,
    (texture) => {
      if (player._faceTextureSource !== requested) {
        texture.dispose();
        return;
      }
      texture.colorSpace = SRGBColorSpace;
      player._faceTexture?.dispose?.();
      player._faceTexture = texture;
      player.facePatchMaterial.map = texture;
      player.facePatchMaterial.needsUpdate = true;
    },
    undefined,
    () => {
      if (player._faceTextureSource === requested) player.facePatch.visible = false;
    },
  );
}

export function installFaceAvatarEnhancements() {
  if (installed) return;
  installed = true;

  const baseSetAvatarProfile = Hud.prototype.setAvatarProfile;
  const baseAvatarProfile = Hud.prototype.avatarProfile;
  Hud.prototype.setAvatarProfile = function setAvatarProfileWithFace(profile = {}) {
    ensureFaceUi(this);
    this._faceTextureData = normalizeFaceTexture(profile.faceTexture);
    baseSetAvatarProfile.call(this, profile);
    const share = this.document.getElementById('avatarFaceShare');
    if (share) share.checked = profile.shareFaceMultiplayer === true && !!this._faceTextureData;
    syncFaceUi(this);
  };
  Hud.prototype.avatarProfile = function avatarProfileWithFace() {
    ensureFaceUi(this);
    const faceTexture = normalizeFaceTexture(this._faceTextureData);
    return {
      ...baseAvatarProfile.call(this),
      faceTexture,
      shareFaceMultiplayer:
        !!faceTexture && this.document.getElementById('avatarFaceShare')?.checked === true,
    };
  };

  const baseApplyAvatar = PlayerController.prototype.applyAvatar;
  PlayerController.prototype.applyAvatar = function applyAvatarWithFace(profile) {
    baseApplyAvatar.call(this, profile);
    applyFaceTexture(this);
  };
}
