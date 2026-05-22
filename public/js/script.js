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

// Filter bar active state
document.querySelectorAll('.filter-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.filter-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
}); 