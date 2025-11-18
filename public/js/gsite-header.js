window.addEventListener('scroll', function() {
  if (window.innerWidth < 768) return; // Skip mobile

  const nav = document.getElementById('siteHeader');
  const navbarLinks = nav ? nav.querySelectorAll('.nlink') : [];
  const carets = nav ? nav.querySelectorAll('svg path:not([fill="none"])') : [];

  if (window.scrollY > 20) {
    if (nav) nav.style.backgroundColor = 'rgba(7, 55, 99, 1)';
    navbarLinks.forEach(el => el.style.color = 'white');
    carets.forEach(path => path.setAttribute('stroke', 'white'));
  } else {
    if (nav) nav.style.backgroundColor = 'transparent';
    navbarLinks.forEach(el => el.style.color = 'rgb(28, 28, 28)');
    carets.forEach(path => path.setAttribute('stroke', 'rgb(28, 28, 28)'));
  }
});


document.addEventListener('DOMContentLoaded', () => {

  if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
  }

  window.scrollTo(0, 0);

  const hamburger = document.getElementById('hamburger');  
  const mobileNav = document.getElementById('mobileNav');  
  const closeBtn = document.getElementById('mobileMenuClose'); // close X in markup
  const body = document.body;

  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
  console.log(`isMobile: ${isMobile()}`);

  // Ensure menu has a predictable initial inline state
  if (mobileNav) {
    mobileNav.style.display = 'none';
    mobileNav.setAttribute('aria-hidden', 'true');
    mobileNav.style.pointerEvents = 'auto';
  }

  function openMenu() {
    if (!mobileNav || !hamburger) return;
    mobileNav.style.display = 'block';
    mobileNav.setAttribute('aria-hidden', 'false');
    body.classList.add('menu-open');
    hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!mobileNav || !hamburger) return;
    mobileNav.style.display = 'none';
    mobileNav.setAttribute('aria-hidden', 'true');
    body.classList.remove('menu-open');
    hamburger.setAttribute('aria-expanded', 'false');
    // also close any open submenus
    mobileNav.querySelectorAll('ul.mobilesub').forEach(ul => ul.style.display = 'none');
    mobileNav.querySelectorAll('.submenu-caret.open').forEach(c => c.classList.remove('open'));
  }

  // Hook the hamburger element
  if (hamburger) {
    // Make clickable
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      // toggle
      const isOpen = mobileNav && mobileNav.style.display === 'block';
      if (isOpen) closeMenu(); else openMenu();
    });
  } else {
    console.warn('Hamburger not found.');
  }

  // Hook the close button (the big X)
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
    });
  }

  // Desktop hover behavior: expand submenu on hover only when not mobile
  const topLevelLis = document.querySelectorAll('li.top');
  topLevelLis.forEach(li => {
    const submenuUl = li.querySelector('ul.sub');
    if (!submenuUl) return;

    // Mouse enter/leave only on desktop widths
    if (!isMobile()) {
      li.addEventListener('mouseenter', () => {
         submenuUl.style.display = 'flex';
      });
      li.addEventListener('mouseleave', () => {
        if (!isMobile()) submenuUl.style.display = 'none';
      });
    } else {
      li.removeEventListener('mouseenter', () => {
         submenuUl.style.display = 'flex';
      });
      li.removeEventListener('mouseleave', () => {
        if (!isMobile()) submenuUl.style.display = 'none';
      });
    }
    
    
    });

  // Caret click for mobile: find the caret, target the ul inside the same li
  const carets = document.querySelectorAll('li:has(.submenu-caret)');

  const openCaret = (li) => {
    console.log('openCaret');
    // the actual visible list is the ul with class sub
    const submenuUl = li.querySelector('ul.sub');
    if (!submenuUl) return;
    console.log('118')
    submenuUl.style.display = 'flex';
    console.log('121');
    if (!isMobile()) {
      console.log(`*********************************** !isMobile, setting colors`);
      submenuUl.style.backgroundColor = 'rgba(7, 55, 99, 1)';
      submenuUl.style.color = 'white';
    }
  }

  const closeCaret = (li) => {
    console.log('closeCaret');
    // the actual visible list is the ul with class sub
    const submenuUl = li.querySelector('ul.sub');
    if (!submenuUl) return;
    submenuUl.style.display = 'none';
    if (!isMobile) {
      console.log(`!isMobile, setting colors`);
      submenuUl.style.backgroundColor = 'transparent';
      submenuUl.style.style.color = 'transparent';
    }
  }

  carets.forEach(caret => {
    caret.addEventListener('click', (e) => {
      console.log('caret click');
      e.preventDefault();
      e.stopPropagation();

      const li = caret.closest('li');
      if (!li) return;
      console.log(li);;
      // the actual visible list is the ul with class sub
      const submenuUl = li.querySelector('ul.sub');
      // const submenuContainer = li.querySelector('.oGuwee');
      console.log(submenuUl);
      if (!submenuUl) return;

      const isOpen = submenuUl.style.display === 'flex';
      console.log(`isOpen: ${isOpen}`);
      if (!isOpen) {
        openCaret(li);
      } else {
        closeCaret(li);
      }
      caret.classList.toggle('open', !isOpen);
    });
  });

  // When resizing
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      // On desktop: reset inline styles so CSS hover works
      document.querySelectorAll('ul.VcS63b').forEach(ul => {
        ul.style.display = '';
      });
      if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
      if (mobileNav) mobileNav.setAttribute('aria-hidden', 'false'); // not strictly needed
      body.classList.remove('menu-open');
    } else {
      // On mobile: close menu and submenus by default
      closeMenu();
    }
  });

  // Accessibility: close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });
});