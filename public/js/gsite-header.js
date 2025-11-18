window.addEventListener('scroll', function() {
  if (window.innerWidth < 768) return; // Skip mobile

  const nav = document.getElementById('siteHeader');
  const navbarLinks = nav ? nav.querySelectorAll('a') : [];

  if (window.scrollY > 20) {
    if (nav) nav.style.backgroundColor = 'rgba(7, 55, 99, 1)';
    navbarLinks.forEach(el => el.style.color = 'white');
  } else {
    if (nav) nav.style.backgroundColor = 'transparent';
    navbarLinks.forEach(el => el.style.color = 'rgb(28, 28, 28)');
  }
});


document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  const closeBtn = document.getElementById('mobileMenuClose');
  const body = document.body;

  const isMobile = () => window.innerWidth <= 767;

  function openMenu() {
    mobileNav.style.display = 'block';
    mobileNav.setAttribute('aria-hidden', 'false');
    body.classList.add('menu-open');
    hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    mobileNav.style.display = 'none';
    mobileNav.setAttribute('aria-hidden', 'true');
    body.classList.remove('menu-open');
    hamburger.setAttribute('aria-expanded', 'false');

    // close any open submenus
    mobileNav.querySelectorAll('li.open').forEach(li => li.classList.remove('open'));
  }

  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = mobileNav.style.display === 'block';
      if (isOpen) closeMenu(); else openMenu();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
    });
  }

  // Mobile submenu toggle
  document.querySelectorAll('#mobileNav .nav-item.has-submenu').forEach(li => {
    const caret = li.querySelector('.submenu-caret');
    const submenu = li.querySelector('.submenu');

    if (!caret || !submenu) return;

    caret.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault(); // prevent accidental navigation

      const isOpen = li.classList.contains('open');

      if (isOpen) {
        // Close submenu
        submenu.style.display = 'none';
        li.classList.remove('open');
      } else {
        // Open submenu
        submenu.style.display = 'block';
        li.classList.add('open');
      }
    });
  });

  // Desktop hover handled via CSS
  // Reset menu on window resize
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      closeMenu();
      mobileNav.querySelectorAll('ul').forEach(ul => ul.style.display = '');
    }
  });

  // Close menu on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
});
