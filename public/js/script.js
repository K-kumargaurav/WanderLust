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
