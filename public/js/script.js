// Bootstrap-style form validation
document.querySelectorAll('form.needs-validation').forEach(form => {
  form.addEventListener('submit', e => {
    if (!form.checkValidity()) {
      e.preventDefault();
      e.stopPropagation();
    }
    form.classList.add('was-validated');
  });
});

// Flash auto-dismiss
document.querySelectorAll('.flash-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.flash').remove();
  });
});

setTimeout(() => {
  document.querySelectorAll('.flash').forEach(f => {
    f.style.transition = 'opacity 0.5s ease';
    f.style.opacity = '0';
    setTimeout(() => f.remove(), 500);
  });
}, 5000);

// Mobile nav toggle
const navToggle = document.getElementById('wl-nav-toggle');
const navLinks  = document.getElementById('wl-nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// Tax toggle (index page)
const taxSwitch = document.getElementById('taxSwitch');
if (taxSwitch) {
  taxSwitch.addEventListener('change', () => {
    document.querySelectorAll('.tax-amount').forEach(el => {
      el.style.display = taxSwitch.checked ? 'inline' : 'none';
    });
  });
}

// Filter chip active state
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// ─── Password Toggle ──────────────────────────────────────────────────────
document.querySelectorAll('.pwd-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = btn.closest('div').querySelector('input[type="password"], input[type="text"]');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    const icon = btn.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  });
});

// ─── Sort Select ──────────────────────────────────────────────────────────
const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    window.location.href = sortSelect.value;
  });
}

// ─── Gallery Thumbnails ───────────────────────────────────────────────────
document.querySelectorAll('.gallery-thumb').forEach(thumb => {
  thumb.addEventListener('click', () => {
    const mainImg = document.getElementById('gallery-main-img');
    if (mainImg) mainImg.src = thumb.src;
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
  });
});

// ─── Review Edit Toggle ──────────────────────────────────────────────────
function toggleEditReview(id) {
  const form = document.getElementById('edit-form-' + id);
  const comment = document.getElementById('comment-' + id);
  const stars = document.getElementById('stars-' + id);
  if (!form) return;
  if (form.style.display === 'none') {
    form.style.display = 'block';
    comment.style.display = 'none';
    stars.style.display = 'none';
  } else {
    form.style.display = 'none';
    comment.style.display = 'block';
    stars.style.display = 'inline-flex';
  }
}

document.querySelectorAll('.review-edit-btn, .review-cancel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const reviewId = btn.dataset.reviewId;
    if (reviewId) toggleEditReview(reviewId);
  });
});

// ─── Image Upload Preview ──────────────────────────────────────────────────
const imageInput = document.getElementById('images');
const previewContainer = document.getElementById('imagePreviewContainer');

if (imageInput && previewContainer) {
  imageInput.addEventListener('change', () => {
    previewContainer.innerHTML = '';
    const files = Array.from(imageInput.files).slice(0, 3);

    if (imageInput.files.length > 3) {
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      imageInput.files = dt.files;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
        previewContainer.appendChild(div);
      };
      reader.readAsDataURL(file);
    });
  });
}

// ─── Listing Preview Modal ─────────────────────────────────────────────────
const previewBtn    = document.getElementById('previewBtn');
const previewModal  = document.getElementById('previewModal');
const closePreview  = document.getElementById('closePreview');
const closePreview2 = document.getElementById('closePreview2');
const confirmSubmit = document.getElementById('confirmSubmit');
const newListingForm = document.getElementById('newListingForm');

if (previewBtn && previewModal && newListingForm) {
  previewBtn.addEventListener('click', () => {
    const form = newListingForm;

    // Populate preview data
    document.getElementById('previewTitle').textContent =
      form.querySelector('[name="listing[title]"]').value || 'Untitled';

    const loc = form.querySelector('[name="listing[location]"]').value || '';
    const country = form.querySelector('[name="listing[country]"]').value || '';
    document.getElementById('previewLocation').innerHTML =
      `<i class="fa-solid fa-location-dot" style="color:var(--terra);margin-right:4px"></i>${loc}${country ? ', ' + country : ''}`;

    document.getElementById('previewDescription').textContent =
      form.querySelector('[name="listing[description]"]').value || '';

    const price = form.querySelector('[name="listing[price]"]').value || '0';
    document.getElementById('previewPrice').innerHTML =
      `&#8377;${parseInt(price).toLocaleString('en-IN')} <span style="font-size:0.9rem;color:var(--charcoal-60);font-family:var(--font-body)">/ night</span>`;

    const cat = form.querySelector('[name="listing[category]"]').value;
    const catEl = document.getElementById('previewCategory');
    if (cat) {
      catEl.textContent = cat;
      catEl.style.display = 'inline-block';
    } else {
      catEl.style.display = 'none';
    }

    // Preview images
    const previewImagesEl = document.getElementById('previewImages');
    previewImagesEl.innerHTML = '';
    const fileInput = form.querySelector('[name="listing[images]"]');
    if (fileInput && fileInput.files.length > 0) {
      Array.from(fileInput.files).slice(0, 3).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = document.createElement('img');
          img.src = e.target.result;
          img.alt = 'Preview';
          previewImagesEl.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    }

    previewModal.style.display = 'flex';
  });

  closePreview.addEventListener('click', () => {
    previewModal.style.display = 'none';
  });

  closePreview2.addEventListener('click', () => {
    previewModal.style.display = 'none';
  });

  confirmSubmit.addEventListener('click', () => {
    newListingForm.submit();
  });

  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      previewModal.style.display = 'none';
    }
  });
}

// ─── Wishlist Toggle ───────────────────────────────────────────────────────
document.querySelectorAll('.wishlist-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const listingId = btn.dataset.listingId;
    const csrf = btn.dataset.csrf;

    try {
      const res = await fetch(`/wishlist/${listingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrf,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const icon = btn.querySelector('i');
        if (data.wishlisted) {
          btn.classList.add('wishlisted');
          icon.classList.remove('fa-regular');
          icon.classList.add('fa-solid');
        } else {
          btn.classList.remove('wishlisted');
          icon.classList.remove('fa-solid');
          icon.classList.add('fa-regular');
        }
      }
    } catch (err) {
      // Fallback: reload
      window.location.href = `/wishlist/${listingId}`;
    }
  });
});

// ─── Confirmation Modal ──────────────────────────────────────────────────
function showConfirmModal(title, body, confirmText = 'Confirm',
                          confirmClass = 'btn-primary') {
  return new Promise((resolve) => {
    const modal      = document.getElementById('confirm-modal');
    const titleEl    = document.getElementById('confirm-modal-title');
    const bodyEl     = document.getElementById('confirm-modal-body');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn  = document.getElementById('confirm-modal-cancel');
    const closeBtn   = document.getElementById('confirm-modal-close');

    titleEl.textContent     = title;
    bodyEl.innerHTML        = body;
    confirmBtn.textContent  = confirmText;
    confirmBtn.className    = `btn ${confirmClass}`;
    modal.style.display     = 'flex';

    function cleanup(result) {
      modal.style.display = 'none';
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      resolve(result);
    }

    document.getElementById('confirm-modal-confirm')
      .addEventListener('click', () => cleanup(true), { once: true });
    document.getElementById('confirm-modal-cancel')
      .addEventListener('click', () => cleanup(false), { once: true });
    closeBtn.addEventListener('click', () => cleanup(false), { once: true });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup(false);
    }, { once: true });
  });
}

// ─── Double Confirmation Modal ───────────────────────────────────────────
// Reuses the same #confirm-modal as showConfirmModal but requires the
// user to type an exact phrase before the confirm button enables.
function showDoubleConfirmModal(title, body, confirmPhrase, actionLabel) {
  return new Promise((resolve) => {
    const modal      = document.getElementById('confirm-modal');
    const titleEl    = document.getElementById('confirm-modal-title');
    const bodyEl     = document.getElementById('confirm-modal-body');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn  = document.getElementById('confirm-modal-cancel');
    const closeBtn   = document.getElementById('confirm-modal-close');

    const inputId = 'confirm-modal-phrase-input';

    titleEl.textContent = title;
    bodyEl.innerHTML =
      body +
      `<div style="margin-top:1rem">
         <label for="${inputId}" style="display:block;font-size:0.8rem;
           color:var(--charcoal);margin-bottom:0.35rem">
           Type <strong>${confirmPhrase}</strong> to confirm:
         </label>
         <input
           type="text"
           id="${inputId}"
           autocomplete="off"
           class="form-control"
           style="font-family:monospace"
         />
       </div>`;

    confirmBtn.textContent = actionLabel;
    confirmBtn.className   = 'btn btn-danger';
    confirmBtn.disabled    = true;
    confirmBtn.style.opacity = '0.6';
    confirmBtn.style.cursor  = 'not-allowed';

    modal.style.display = 'flex';

    const phraseInput = document.getElementById(inputId);
    phraseInput.focus();

    phraseInput.addEventListener('input', () => {
      const match = phraseInput.value === confirmPhrase;
      confirmBtn.disabled = !match;
      confirmBtn.style.opacity = match ? '1' : '0.6';
      confirmBtn.style.cursor  = match ? 'pointer' : 'not-allowed';
    });

    function cleanup(result) {
      modal.style.display = 'none';
      // Reset confirm button state
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor  = 'pointer';
      // Replace nodes to drop listeners
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      resolve(result);
    }

    document.getElementById('confirm-modal-confirm')
      .addEventListener('click', () => {
        if (phraseInput.value === confirmPhrase) cleanup(true);
      }, { once: true });
    document.getElementById('confirm-modal-cancel')
      .addEventListener('click', () => cleanup(false), { once: true });
    closeBtn.addEventListener('click', () => cleanup(false), { once: true });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup(false);
    }, { once: true });
  });
}

// ─── Admin: Double-Confirm Destructive Actions ───────────────────────────
function submitFormById(formId) {
  const form = document.getElementById(formId);
  if (form) form.submit();
}

document.querySelectorAll('.admin-hide-listing-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const { formId, title } = btn.dataset;
    const confirmed = await showDoubleConfirmModal(
      'Hide this listing?',
      `<strong>${title || 'Untitled'}</strong> will be hidden from the
       public site. Bookings and reviews remain in the database and
       it can be restored from the Deleted tab.`,
      'HIDE',
      'Yes, Hide Listing'
    );
    if (confirmed) submitFormById(formId);
  });
});

document.querySelectorAll('.admin-hide-review-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const { formId } = btn.dataset;
    const confirmed = await showDoubleConfirmModal(
      'Hide this review?',
      `The review will be hidden from the listing page. It remains in
       the database and can be restored from the Deleted tab.`,
      'HIDE',
      'Yes, Hide Review'
    );
    if (confirmed) submitFormById(formId);
  });
});

document.querySelectorAll('.admin-ban-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const { formId, username } = btn.dataset;
    const confirmed = await showDoubleConfirmModal(
      `Ban @${username}?`,
      `@<strong>${username}</strong> will be prevented from logging in.
       Their listings, reviews, and bookings will remain.`,
      username,
      'Yes, Ban User'
    );
    if (confirmed) submitFormById(formId);
  });
});

document.querySelectorAll('.admin-unban-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const { formId, username } = btn.dataset;
    const confirmed = await showConfirmModal(
      `Unban @${username}?`,
      `@<strong>${username}</strong> will be able to log in again.`,
      'Yes, Unban',
      'btn-primary'
    );
    if (confirmed) submitFormById(formId);
  });
});

document.querySelectorAll('.admin-restore-listing-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const { formId, title } = btn.dataset;
    const confirmed = await showConfirmModal(
      'Restore this listing?',
      `<strong>${title || 'Untitled'}</strong> will be visible to the
       public again.`,
      'Yes, Restore',
      'btn-primary'
    );
    if (confirmed) submitFormById(formId);
  });
});

document.querySelectorAll('.admin-restore-review-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const { formId } = btn.dataset;
    const confirmed = await showConfirmModal(
      'Restore this review?',
      'The review will be visible on the listing page again.',
      'Yes, Restore',
      'btn-primary'
    );
    if (confirmed) submitFormById(formId);
  });
});

// ─── Cancel Booking ───────────────────────────────────────────────────────
document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const { bookingId, listing, checkin, checkout, total } = btn.dataset;

    const confirmed = await showConfirmModal(
      'Cancel this booking?',
      `<strong>${listing}</strong><br><br>
       Check-in:  <strong>${checkin}</strong><br>
       Check-out: <strong>${checkout}</strong><br><br>
       <span style="color:var(--charcoal-60)">
         A full refund of
         <strong>₹${total}</strong>
         will be processed in 5–10 business days.
       </span><br><br>
       <span style="color:#c0392b;font-size:0.875rem">
         This action cannot be undone.
       </span>`,
      'Yes, Cancel Booking',
      'btn-danger'
    );

    if (confirmed) {
      document.getElementById('cancel-form-' + bookingId).submit();
    }
  });
});

// ─── Scroll to Top ────────────────────────────────────────────────────────
const scrollTopBtn = document.getElementById('scroll-top-btn');
if (scrollTopBtn) {
  window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
  });
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── Unread Message Count Polling ────────────────────────────────────────
// Polls every 30 seconds to update the unread badge
// Only runs when user is logged in (badge element exists)

(function () {
  const badge = document.querySelector('.unread-message-badge');
  if (!badge) return; // not logged in

  function pollUnreadCount() {
    fetch('/conversations/unread-count', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    })
      .then((res) => res.json())
      .then(({ unread }) => {
        if (unread > 0) {
          badge.textContent    = unread > 99 ? '99+' : unread;
          badge.style.display  = 'flex';
        } else {
          badge.style.display  = 'none';
        }
      })
      .catch(() => {
        // Silently ignore polling errors
      });
  }

  // Poll every 30 seconds
  setInterval(pollUnreadCount, 30000);
})();

// ─── Prevent Double Form Submission ──────────────────────────────────────
// Disables submit buttons immediately after first click
// Prevents duplicate bookings, messages, reviews, etc.

document.addEventListener('DOMContentLoaded', function () {

  document.querySelectorAll('form').forEach(function (form) {

    // Skip booking form — has its own submit flow with confirmation modal
    if (form.id === 'bookingForm') return;

    form.addEventListener('submit', function () {

      // Find all submit buttons in this form
      const submitBtns = form.querySelectorAll(
        'button[type="submit"], input[type="submit"], .btn-reserve'
      );

      submitBtns.forEach(function (btn) {

        // Skip if already disabled (e.g. booking button before dates)
        if (btn.disabled) return;

        // Store original text
        const originalText = btn.innerHTML;
        const originalWidth = btn.offsetWidth;

        // Lock width so button doesn't resize
        btn.style.minWidth = originalWidth + 'px';

        // Disable and show loading state
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor  = 'not-allowed';

        // Show spinner + text
        btn.innerHTML =
          '<i class="fa-solid fa-circle-notch fa-spin" ' +
          'style="margin-right:0.4rem"></i>' +
          'Please wait...';

        // Safety net: re-enable after 10 seconds
        // (in case of network error or redirect failure)
        setTimeout(function () {
          btn.disabled      = false;
          btn.style.opacity = '1';
          btn.style.cursor  = 'pointer';
          btn.innerHTML     = originalText;
        }, 10000);
      });
    });
  });

  // Special case: btn-reserve (booking submit)
  // Re-enable if flatpickr selection changes after disable
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('reset', function () {
      const reserveBtn = document.getElementById('booking-submit-btn');
      if (reserveBtn) {
        reserveBtn.disabled      = false;
        reserveBtn.style.opacity = '1';
        reserveBtn.innerHTML     = 'Confirm Booking';
      }
    });
  }
});
