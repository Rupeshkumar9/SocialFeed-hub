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

function browserIconInitial() {
  const author = DOM.addAuthorName?.value.trim();
  if (author) return author.charAt(0).toUpperCase();
  try {
    const host = new URL(DOM.addUrl?.value.trim() || '').hostname.replace(/^www\./, '');
    return host ? host.charAt(0).toUpperCase() : 'S';
  } catch {
    return 'S';
  }
}

function updateBrowserIconPreview() {
  if (!DOM.browserIconPreviewImage || !DOM.browserIconPreviewInitial || !DOM.browserIconValue) return;
  const value = DOM.browserIconValue.value.trim();
  DOM.browserIconPreviewInitial.textContent = browserIconInitial();
  DOM.browserIconPreviewImage.hidden = true;
  DOM.browserIconPreviewInitial.hidden = false;
  DOM.browserIconPreviewImage.onload = () => {
    DOM.browserIconPreviewImage.hidden = false;
    DOM.browserIconPreviewInitial.hidden = true;
  };
  DOM.browserIconPreviewImage.onerror = () => {
    DOM.browserIconPreviewImage.hidden = true;
    DOM.browserIconPreviewInitial.hidden = false;
  };
  if (value) DOM.browserIconPreviewImage.src = value;
}

function setBrowserIconFromFile(file) {
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    showToast('Please choose an image file.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Please choose an icon smaller than 2 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = event => {
    if (DOM.browserIconValue) {
      DOM.browserIconValue.value = String(event.target.result || '');
      DOM.browserIconValue.dataset.custom = 'true';
    }
    updateBrowserIconPreview();
    if (DOM.browserIconPickerPanel) DOM.browserIconPickerPanel.hidden = true;
    showToast('Custom site icon ready. Save the bookmark to apply it.', 'success');
  };
  reader.onerror = () => showToast('Could not read the icon file.', 'error');
  reader.readAsDataURL(file);
}

function clearBrowserIconValue() {
  if (DOM.browserIconValue) {
    DOM.browserIconValue.value = '';
    DOM.browserIconValue.dataset.custom = 'false';
  }
  updateBrowserIconPreview();
  if (DOM.browserIconPickerPanel) DOM.browserIconPickerPanel.hidden = true;
}

function setBrowserIconPickerVisible(visible) {
  if (!DOM.browserIconPicker) return;
  DOM.browserIconPicker.hidden = !visible;
  if (!visible && DOM.browserIconPickerPanel) DOM.browserIconPickerPanel.hidden = true;
  if (visible) updateBrowserIconPreview();
}

function updateManualModalPlatformUI(platformValue = '') {
  const isBrowser = platformValue === 'browser';
  const isCustom = platformValue === '__custom__';
  if (DOM.addUrlLabel) DOM.addUrlLabel.textContent = isBrowser ? 'Website URL' : 'Post URL';
  const authorLabel = document.getElementById('add-author-label');
  const contentLabel = document.getElementById('add-content-label');
  if (authorLabel) authorLabel.textContent = isBrowser ? 'Site name' : 'Author name (Optional)';
  if (contentLabel) contentLabel.textContent = isBrowser ? 'Description' : 'Caption / Post Content';
  if (DOM.addAuthorName) DOM.addAuthorName.placeholder = isBrowser ? 'Google, NASA, National Geographic…' : 'NASA or National Geographic';
  if (DOM.addAuthorName) DOM.addAuthorName.required = isBrowser;
  if (DOM.addContent) DOM.addContent.placeholder = isBrowser ? 'What is this link about?' : 'Enter tweet content or post description here...';
  if (DOM.addTagsGroup) DOM.addTagsGroup.hidden = isBrowser;
  if (DOM.addImageControls) DOM.addImageControls.hidden = isBrowser;
  if (isBrowser) {
    setManualImageFieldVisible(false);
    clearManualImageValue();
  }
  setBrowserIconPickerVisible(isBrowser);
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

registerActions('bookmark-media', { setManualImageFromFile, setManualImageSourceControlsVisible, clearManualImageValue, updateManualImagePreview, setManualImageFieldVisible, updateBrowserIconPreview, setBrowserIconFromFile, clearBrowserIconValue, setBrowserIconPickerVisible, updateManualModalPlatformUI });
export { setManualImageFromFile, setManualImageSourceControlsVisible, clearManualImageValue, updateManualImagePreview, setManualImageFieldVisible, updateBrowserIconPreview, setBrowserIconFromFile, clearBrowserIconValue, setBrowserIconPickerVisible, updateManualModalPlatformUI };
