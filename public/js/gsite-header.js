// gsite front end js for header

window.addEventListener('scroll', function() {
  if (window.innerWidth < 768) return; // Skip mobile
  const navbarLinks = document.querySelectorAll('.YSH9J');
  const nav = document.getElementById('navBkgrd')
  const searchIconPaths = document.querySelectorAll('#search-icon svg path:not([fill="none"])');

  if (window.scrollY > 20) {
    navbarLinks.forEach(el => el.style.color = 'white');
    searchIconPaths.forEach(path => path.setAttribute('fill', 'white'));
    nav.style.backgroundColor = 'rgba(7, 55, 99, 1)';
  } else {
    navbarLinks.forEach(el => el.style.color = 'rgb(28, 28, 28)');
    searchIconPaths.forEach(path => path.setAttribute('fill', 'rgb(28, 28, 28)'));
    nav.style.backgroundColor = 'inherit';
  }
});

document.addEventListener('DOMContentLoaded', () => {

	if ('scrollRestoration' in history) {
	    history.scrollRestoration = 'manual';
	}

  window.scrollTo(0, 0);

  const hamburger = document.getElementById('s9iPrd');         //  hamburger
  const mobileNav = document.getElementById('yuynLe');        // mobile nav container
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
    mobileNav.querySelectorAll('ul.VcS63b').forEach(ul => ul.style.display = 'none');
    mobileNav.querySelectorAll('[jsname="ix0Hvc"].open').forEach(c => c.classList.remove('open'));
  }

  // Hook the real hamburger element
  if (hamburger) {
    // Make sure it is clickable even if Google Sites has native handlers
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      // toggle
      const isOpen = mobileNav && mobileNav.style.display === 'block';
      if (isOpen) closeMenu(); else openMenu();
    });
  } else {
    console.warn('Hamburger (#s9iPrd) not found.');
  }

  // Hook the close button (the big X)
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
    });
  }

  // Desktop hover behavior: expand submenu on hover only when not mobile
  const topLevelLis = document.querySelectorAll('li[data-nav-level="1"]');
  topLevelLis.forEach(li => {
    const submenuUl = li.querySelector('ul.VcS63b');
    if (!submenuUl) return;

    // Mouse enter/leave only on desktop widths
    if (!isMobile()) {
    	li.addEventListener('mouseenter', () => {
	       submenuUl.style.display = 'block';
	    });
    	li.addEventListener('mouseleave', () => {
	      if (!isMobile()) submenuUl.style.display = 'none';
	    });
    } else {
    	li.removeEventListener('mouseenter', () => {
	       submenuUl.style.display = 'block';
	    });
    	li.removeEventListener('mouseleave', () => {
	      if (!isMobile()) submenuUl.style.display = 'none';
	    });
    }
    
    
  	});

  // Caret click for mobile: find the caret, target the UL.VcS63b inside same LI
  const carets = document.querySelectorAll('#yuynLe [jsname="ix0Hvc"], #mainNavWide [jsname="ix0Hvc"], .dvmRw');

  const openCaret = (li) => {
  	console.log('openCaret');
  	// the actual visible list is the UL with class VcS63b
    const submenuUl = li.querySelector('ul.VcS63b');
    const submenuContainer = li.querySelector('.oGuwee');
    if (!submenuUl) return;
    console.log('118')
    submenuUl.style.display = 'block';
    submenuContainer.style.display = 'block';
    console.log('121');
    if (!isMobile()) {
    	console.log(`*********************************** !isMobile, setting colors`);
    	const mobileMenuBkg = document.querySelector('.oGuwee.eWDljc.RPRy1e.Mkt3Tc');
    	mobileMenuBkg.style.backgroundColor = 'rgba(7, 55, 99, 1)';
    	mobileMenuBkg.style.color = 'white';
    }
  }

  const closeCaret = (li) => {
  	console.log('closeCaret');
  	// the actual visible list is the UL with class VcS63b
    const submenuUl = li.querySelector('ul.VcS63b');
    const submenuContainer = li.querySelector('.oGuwee');
    if (!submenuUl) return;
    submenuUl.style.display = 'none';
    submenuContainer.style.display = 'none';
    if (!isMobile) {
    	console.log(`!isMobile, setting colors`);
    	document.querySelector('.RPRy1e').style.backgroundColor = 'transparent';
    	document.querySelector('.RPRy1e.I35ICb > a').style.color = 'transparent';
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
      // the actual visible list is the UL with class VcS63b
      const submenuUl = li.querySelector('ul.VcS63b');
      const submenuContainer = li.querySelector('.oGuwee');
      console.log(submenuUl);
      if (!submenuUl) return;

      const isOpen = submenuContainer.style.display === 'block';
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

