import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from 'three';
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

function syncFaceUi(ui) {
  const preview = ui.document.getElementById('avatarFacePreview');
  const status = ui.document.getElementById('avatarFaceStatus');
  const remove = ui.document.getElementById('avatarFaceRemove');
  const hasFace = !!normalizeFaceTexture(ui._faceTextureData);
  if (preview) {
    preview.hidden = !hasFace;
    preview.src = hasFace ? ui._faceTextureData : '';
  }
  if (remove) remove.hidden = !hasFace;
  if (status)
    status.textContent = hasFace
      ? 'Face texture ready. It stays in this browser unless you remove it.'
      : 'Optional. Uses your front camera. The photo is processed on this device and is not uploaded.';
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
  const remove = ui.document.createElement('button');
  remove.type = 'button';
  remove.id = 'avatarFaceRemove';
  remove.textContent = 'REMOVE FACE IMAGE';
  remove.hidden = true;

  const input = ui.document.createElement('input');
  input.id = 'avatarFaceInput';
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('capture', 'user');
  input.hidden = true;

  const status = ui.document.createElement('small');
  status.id = 'avatarFaceStatus';

  capture.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    capture.disabled = true;
    status.textContent = 'Processing face locally…';
    try {
      ui._faceTextureData = await makeFaceTexture(file);
      syncFaceUi(ui);
    } catch (error) {
      status.textContent = error.message;
    } finally {
      capture.disabled = false;
    }
  };
  remove.onclick = () => {
    ui._faceTextureData = null;
    syncFaceUi(ui);
  };

  controls.append(capture, remove, input);
  host.append(heading, preview, controls, status);
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
    syncFaceUi(this);
  };
  Hud.prototype.avatarProfile = function avatarProfileWithFace() {
    ensureFaceUi(this);
    return {
      ...baseAvatarProfile.call(this),
      faceTexture: normalizeFaceTexture(this._faceTextureData),
    };
  };

  const baseApplyAvatar = PlayerController.prototype.applyAvatar;
  PlayerController.prototype.applyAvatar = function applyAvatarWithFace(profile) {
    baseApplyAvatar.call(this, profile);
    applyFaceTexture(this);
  };
}
