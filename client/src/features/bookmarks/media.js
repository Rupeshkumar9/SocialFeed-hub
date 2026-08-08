import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const escapeHTML = (...args) => actions.escapeHTML(...args);
const showToast = (...args) => actions.showToast(...args);

function setManualImageFromFile(file) {
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    showToast('Please choose an image file.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = event => {
    if (DOM.addThumbnail) DOM.addThumbnail.value = String(event.target.result || '');
    updateManualImagePreview();
    showToast('Image ready. It will upload to Cloudinary on save.', 'success');
  };
  reader.onerror = () => showToast('Could not read image file.', 'error');
  reader.readAsDataURL(file);
}

function setManualImageSourceControlsVisible(visible) {
  if (DOM.addImageSourceControls) DOM.addImageSourceControls.hidden = !visible;
}

function clearManualImageValue() {
  if (DOM.addThumbnail) DOM.addThumbnail.value = '';
  if (DOM.addImageFile) DOM.addImageFile.value = '';
  updateManualImagePreview();
}

function updateManualImagePreview() {
  if (!DOM.addImagePreview || !DOM.addThumbnail) return;
  const value = DOM.addThumbnail.value.trim();
  if (!value) {
    DOM.addImagePreview.hidden = true;
    DOM.addImagePreview.innerHTML = '';
    setManualImageSourceControlsVisible(true);
    return;
  }
  setManualImageSourceControlsVisible(false);
  DOM.addImagePreview.hidden = false;
  DOM.addImagePreview.innerHTML = '<button type="button" class="manual-image-remove" title="Remove image" aria-label="Remove image"><i class="app-icon icon-xmark"></i></button><img src="' + escapeHTML(value) + '" alt="Image preview" loading="lazy">';
}

function setManualImageFieldVisible(visible) {
  if (!DOM.addImageField) return;
  DOM.addImageField.hidden = !visible;
  if (DOM.btnToggleImageField) {
    const label = DOM.btnToggleImageField.querySelector('span');
    if (label) label.textContent = visible ? 'Hide Image Field' : 'Add / Change Image';
  }
  if (visible) updateManualImagePreview();
}

function updateManualModalPlatformUI(platformValue = '') {
  const isBrowser = platformValue === 'browser';
  const isCustom = platformValue === '__custom__';
  if (DOM.addUrlLabel) DOM.addUrlLabel.textContent = isBrowser ? 'Site Link' : 'Post URL';
  if (DOM.addTagsGroup) DOM.addTagsGroup.hidden = isBrowser;
  if (isBrowser && DOM.addTags) DOM.addTags.value = '';
  if (DOM.addCustomPlatformGroup) DOM.addCustomPlatformGroup.hidden = !isCustom;
  if (DOM.addCustomPlatformName) {
    DOM.addCustomPlatformName.required = isCustom;
    if (!isCustom) {
      DOM.addCustomPlatformName.value = '';
      DOM.addCustomPlatformName.setCustomValidity('');
    }
  }
}

registerActions('bookmark-media', { setManualImageFromFile, setManualImageSourceControlsVisible, clearManualImageValue, updateManualImagePreview, setManualImageFieldVisible, updateManualModalPlatformUI });
export { setManualImageFromFile, setManualImageSourceControlsVisible, clearManualImageValue, updateManualImagePreview, setManualImageFieldVisible, updateManualModalPlatformUI };
