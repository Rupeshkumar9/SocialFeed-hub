import { AppState, DOM, POSTS_PER_PAGE } from '../../app/state.js';
import { actions, registerActions } from '../../app/actions.js';

const escapeHTML = (...args) => actions.escapeHTML(...args);
const normalizeCollectionKey = (...args) => actions.normalizeCollectionKey(...args);
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

function updateCategoryEditButtonVisibility() {
  if (!DOM.btnEditCategoryName || !DOM.addCategory) return;
  const value = DOM.addCategory.value;
  DOM.btnEditCategoryName.hidden = !value || value === '__new__';
}

function renameSelectedModalCategory() {
  if (!DOM.addCategory) return;
  const currentValue = DOM.addCategory.value;
  if (!currentValue || currentValue === '__new__') return;
  const currentLabel = DOM.addCategory.options[DOM.addCategory.selectedIndex] ? DOM.addCategory.options[DOM.addCategory.selectedIndex].textContent : currentValue;
  const nextName = window.prompt('Rename this category for this bookmark:', currentLabel);
  if (nextName === null) return;
  const cleaned = nextName.trim();
  if (!cleaned) {
    showToast('Category name cannot be empty.', 'error');
    return;
  }
  const normalized = normalizeCollectionKey(cleaned);
  if (normalized === 'uncategorized') {
    DOM.addCategory.value = '';
    updateCategoryEditButtonVisibility();
    return;
  }
  let option = Array.from(DOM.addCategory.options).find(opt => opt.value.toLowerCase() === normalized.toLowerCase());
  if (!option) {
    option = document.createElement('option');
    option.value = normalized;
    option.textContent = normalized;
    const newOption = Array.from(DOM.addCategory.options).find(opt => opt.value === '__new__');
    DOM.addCategory.insertBefore(option, newOption || null);
  } else {
    option.textContent = normalized;
  }
  DOM.addCategory.value = option.value;
  if (DOM.addCategoryNew) {
    DOM.addCategoryNew.style.display = 'none';
    DOM.addCategoryNew.value = '';
  }
  updateCategoryEditButtonVisibility();
  showToast('Category name updated for this save.', 'info');
}

function updateManualModalPlatformUI(platformValue = '') {
  const isBrowser = platformValue === 'browser';
  const isCustom = platformValue === '__custom__';
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

registerActions('bookmark-media', { setManualImageFromFile, setManualImageSourceControlsVisible, clearManualImageValue, updateManualImagePreview, setManualImageFieldVisible, updateCategoryEditButtonVisibility, renameSelectedModalCategory, updateManualModalPlatformUI });
export { setManualImageFromFile, setManualImageSourceControlsVisible, clearManualImageValue, updateManualImagePreview, setManualImageFieldVisible, updateCategoryEditButtonVisibility, renameSelectedModalCategory, updateManualModalPlatformUI };
