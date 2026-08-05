const profileEls = {
  root: document.getElementById('profile-studio'),
  canvas: document.getElementById('profileCanvas'),
  upload: document.getElementById('profileUpload'),
  download: document.getElementById('profileDownload'),
  zoom: document.getElementById('profileZoom'),
  offsetY: document.getElementById('profileOffsetY'),
  reset: document.getElementById('profileReset'),
  status: document.getElementById('profileStatus'),
  frameButtons: [...document.querySelectorAll('[data-profile-frame]')],
};

const size = 1024;
const centerX = size / 2;
const centerY = size * 0.43;
const avatarRadius = size * 0.34;
const ringRadius = avatarRadius + size * 0.04;
const badgeRadius = size * 0.112;
const badgeY = centerY + avatarRadius * 0.92;

const assetUrls = {
  defaultPhoto: new URL('../assets/profile-nftree-art.jpg', import.meta.url).href,
  thickBadge: new URL('../assets/profile-thickquidity-logo.png', import.meta.url).href,
  thickArt: new URL('../assets/profile-thickquidity-art.png', import.meta.url).href,
  leafyFrame: new URL('../assets/profile-leafy-sui-frame.png', import.meta.url).href,
  nftreeBadge: new URL('../assets/profile-nftree-art.jpg', import.meta.url).href,
  arboristBadge: new URL('../assets/profile-crypto-arborist-badge.png', import.meta.url).href,
};

const profileState = {
  frame: 'thick',
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  photo: null,
  objectUrl: null,
  assets: {},
  dragging: null,
  ready: false,
  bounds: { x: 0, y: 0 },
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load profile asset: ${url}`));
    image.src = url;
  });
}

function drawCoverImage(context, image, x, y, width, height, zoom = 1, offsetX = 0, offsetY = 0) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight) * zoom;
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  context.drawImage(
    image,
    x + (width - drawnWidth) / 2 + offsetX,
    y + (height - drawnHeight) / 2 + offsetY,
    drawnWidth,
    drawnHeight,
  );
}

function calculateProfileBounds() {
  if (!profileState.photo) return { x: 0, y: 0 };
  const sourceWidth = profileState.photo.naturalWidth || profileState.photo.width;
  const sourceHeight = profileState.photo.naturalHeight || profileState.photo.height;
  const diameter = avatarRadius * 2;
  const coverScale = Math.max(diameter / sourceWidth, diameter / sourceHeight);
  const scale = coverScale * profileState.zoom;
  return {
    x: Math.max(0, (sourceWidth * scale - diameter) / 2),
    y: Math.max(0, (sourceHeight * scale - diameter) / 2),
  };
}

function clampProfileOffsets() {
  profileState.bounds = calculateProfileBounds();
  profileState.offsetX = Math.max(-profileState.bounds.x, Math.min(profileState.bounds.x, profileState.offsetX));
  profileState.offsetY = Math.max(-profileState.bounds.y, Math.min(profileState.bounds.y, profileState.offsetY));
  if (profileEls.offsetY) {
    profileEls.offsetY.min = String(Math.floor(-profileState.bounds.y));
    profileEls.offsetY.max = String(Math.ceil(profileState.bounds.y));
    profileEls.offsetY.value = String(Math.round(profileState.offsetY));
  }
}

function drawProfilePhoto(context) {
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, avatarRadius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = '#071a15';
  context.fillRect(centerX - avatarRadius, centerY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
  drawCoverImage(
    context,
    profileState.photo,
    centerX - avatarRadius,
    centerY - avatarRadius,
    avatarRadius * 2,
    avatarRadius * 2,
    profileState.zoom,
    profileState.offsetX,
    profileState.offsetY,
  );
  context.restore();
}

function drawCircularBadge(context, image, borderColors) {
  const gradient = context.createLinearGradient(centerX - badgeRadius, badgeY, centerX + badgeRadius, badgeY);
  borderColors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, borderColors.length - 1), color));
  context.save();
  context.beginPath();
  context.arc(centerX, badgeY, badgeRadius + 12, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.beginPath();
  context.arc(centerX, badgeY, badgeRadius, 0, Math.PI * 2);
  context.clip();
  drawCoverImage(context, image, centerX - badgeRadius, badgeY - badgeRadius, badgeRadius * 2, badgeRadius * 2);
  context.restore();
}

function drawLeaf(context, angle, radius, color) {
  context.save();
  context.translate(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
  context.rotate(angle + Math.PI / 2);
  context.beginPath();
  context.ellipse(0, 0, 13, 30, 0, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function renderGeneratedFrame(context, mode) {
  const colors = mode === 'nftree' ? ['#39f58b', '#f5c84c', '#0f5f3d'] : ['#39f58b', '#f5c84c', '#7f45cc'];
  const gradient = context.createLinearGradient(centerX - ringRadius, centerY, centerX + ringRadius, centerY);
  colors.forEach((color, index) => gradient.addColorStop(index / 2, color));
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
  context.lineWidth = 42;
  context.strokeStyle = gradient;
  context.shadowColor = 'rgba(51,247,143,.45)';
  context.shadowBlur = 26;
  context.stroke();
  context.restore();
  for (let index = 0; index < 16; index += 1) {
    drawLeaf(context, (Math.PI * 2 * index) / 16, ringRadius, index % 2 ? '#a7db38' : '#39f58b');
  }
}

function renderLeafyFrame(context) {
  context.drawImage(profileState.assets.leafyFrame, 0, 0, size, size);
}

function renderProfileCanvas() {
  if (!profileEls.canvas || !profileState.photo || !profileState.ready) return;
  clampProfileOffsets();
  const context = profileEls.canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  const background = context.createRadialGradient(centerX, centerY, 20, centerX, centerY, size * 0.68);
  background.addColorStop(0, '#103c2b');
  background.addColorStop(1, '#050714');
  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  drawProfilePhoto(context);

  if (profileState.frame === 'leafy') {
    renderLeafyFrame(context);
  } else {
    renderGeneratedFrame(context, profileState.frame);
    const badgeMap = {
      thick: [profileState.assets.thickBadge, ['#39f58b', '#f5c84c', '#7f45cc']],
      'thick-art': [profileState.assets.thickArt, ['#39f58b', '#f5c84c', '#7f45cc']],
      nftree: [profileState.assets.nftreeBadge, ['#f5c84c', '#39f58b']],
      arborist: [profileState.assets.arboristBadge, ['#f5c84c', '#7f45cc']],
    };
    const [badge, colors] = badgeMap[profileState.frame] || badgeMap.thick;
    drawCircularBadge(context, badge, colors);
  }
}

function revokeProfileObjectUrl() {
  if (profileState.objectUrl) {
    URL.revokeObjectURL(profileState.objectUrl);
    profileState.objectUrl = null;
  }
}

async function loadProfileFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    profileEls.status.textContent = 'Choose a JPG, PNG, or WebP image.';
    profileEls.upload.value = '';
    return;
  }
  revokeProfileObjectUrl();
  const objectUrl = URL.createObjectURL(file);
  profileState.objectUrl = objectUrl;
  profileState.ready = false;
  profileEls.download.disabled = true;
  try {
    profileState.photo = await loadImage(objectUrl);
    profileState.zoom = 1;
    profileState.offsetX = 0;
    profileState.offsetY = 0;
    profileEls.zoom.value = '1';
    clampProfileOffsets();
    profileState.ready = true;
    profileEls.download.disabled = false;
    profileEls.status.textContent = 'Photo loaded locally. It has not been uploaded.';
    renderProfileCanvas();
  } catch {
    revokeProfileObjectUrl();
    profileState.photo = profileState.assets.defaultPhoto || null;
    profileState.ready = Boolean(profileState.photo);
    profileEls.download.disabled = !profileState.ready;
    clampProfileOffsets();
    renderProfileCanvas();
    profileEls.status.textContent = 'That image could not be read.';
  }
}

function downloadProfileCanvas() {
  if (!profileState.ready || !profileState.photo) {
    profileEls.status.textContent = 'Profile artwork is still loading.';
    return;
  }
  renderProfileCanvas();
  const filenames = {
    thick: 'tree-profile-frame.png',
    'thick-art': 'tree-thickquidity-art-profile-frame.png',
    leafy: 'tree-leafy-profile-frame.png',
    nftree: 'tree-nftree-profile-frame.png',
    arborist: 'tree-crypto-arborist-profile-frame.png',
  };
  profileEls.canvas.toBlob((blob) => {
    if (!blob || blob.type !== 'image/png') {
      profileEls.status.textContent = 'The PNG could not be exported.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenames[profileState.frame];
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    profileEls.status.textContent = '1024 × 1024 PNG downloaded locally.';
  }, 'image/png');
}

function resetProfileMaker() {
  revokeProfileObjectUrl();
  profileState.photo = profileState.assets.defaultPhoto;
  profileState.frame = 'thick';
  profileState.zoom = 1;
  profileState.offsetX = 0;
  profileState.offsetY = 0;
  profileState.ready = Boolean(profileState.assets.defaultPhoto);
  profileEls.upload.value = '';
  profileEls.zoom.value = '1';
  clampProfileOffsets();
  profileEls.download.disabled = !profileState.ready;
  profileEls.frameButtons.forEach((button) => button.classList.toggle('active', button.dataset.profileFrame === 'thick'));
  profileEls.status.textContent = 'Default local preview restored.';
  renderProfileCanvas();
}

async function initProfileMaker() {
  if (!profileEls.root || !profileEls.canvas) return;
  profileEls.download.disabled = true;
  profileEls.canvas.width = size;
  profileEls.canvas.height = size;
  try {
    const [defaultPhoto, thickBadge, thickArt, leafyFrame, nftreeBadge, arboristBadge] = await Promise.all([
      loadImage(assetUrls.defaultPhoto),
      loadImage(assetUrls.thickBadge),
      loadImage(assetUrls.thickArt),
      loadImage(assetUrls.leafyFrame),
      loadImage(assetUrls.nftreeBadge),
      loadImage(assetUrls.arboristBadge),
    ]);
    profileState.assets = { defaultPhoto, thickBadge, thickArt, leafyFrame, nftreeBadge, arboristBadge };
    profileState.photo = defaultPhoto;
    profileState.ready = true;
    clampProfileOffsets();
    profileEls.download.disabled = false;
    renderProfileCanvas();
    profileEls.status.textContent = 'Default local preview ready. Nothing has been uploaded.';
  } catch {
    profileState.ready = false;
    profileEls.download.disabled = true;
    profileEls.status.textContent = 'One or more approved local artwork files could not be loaded.';
  }

  profileEls.upload.addEventListener('change', loadProfileFile);
  profileEls.zoom.addEventListener('input', () => {
    profileState.zoom = Number(profileEls.zoom.value);
    clampProfileOffsets();
    renderProfileCanvas();
  });
  profileEls.offsetY.addEventListener('input', () => {
    profileState.offsetY = Number(profileEls.offsetY.value);
    clampProfileOffsets();
    renderProfileCanvas();
  });
  profileEls.frameButtons.forEach((button) => button.addEventListener('click', () => {
    profileState.frame = button.dataset.profileFrame;
    profileEls.frameButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    renderProfileCanvas();
  }));
  profileEls.canvas.addEventListener('pointerdown', (event) => {
    profileState.dragging = { x: event.clientX, y: event.clientY, offsetX: profileState.offsetX, offsetY: profileState.offsetY };
    profileEls.canvas.setPointerCapture(event.pointerId);
  });
  profileEls.canvas.addEventListener('pointermove', (event) => {
    if (!profileState.dragging) return;
    const ratio = size / profileEls.canvas.getBoundingClientRect().width;
    profileState.offsetX = profileState.dragging.offsetX + (event.clientX - profileState.dragging.x) * ratio;
    profileState.offsetY = profileState.dragging.offsetY + (event.clientY - profileState.dragging.y) * ratio;
    clampProfileOffsets();
    renderProfileCanvas();
  });
  ['pointerup', 'pointercancel'].forEach((name) => profileEls.canvas.addEventListener(name, () => { profileState.dragging = null; }));
  profileEls.reset.addEventListener('click', resetProfileMaker);
  profileEls.download.addEventListener('click', downloadProfileCanvas);
  window.addEventListener('beforeunload', revokeProfileObjectUrl, { once: true });
}

initProfileMaker();
