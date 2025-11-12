// gsite front end js for header

window.addEventListener('scroll', function() {
		if (window.innerWidth < 768) return;
    const navbarLinks = document.querySelectorAll('.YSH9J');
    const nav = document.getElementById('navBkgrd')
    const searchIconPaths = document.querySelectorAll('#search-icon svg path:not([fill="none"])');
    
    // Check scroll position
    if (window.scrollY > 20) {
    	console.log('window.scrollY', window.scrollY);
      navbarLinks.forEach(el => {
        el.style.color = 'white';
      });
			searchIconPaths.forEach(path => path.setAttribute('fill', 'white'));
			nav.style.backgroundColor = 'rgba(7, 55, 99, 1)';
      console.log('nav.style.backgroundColor', nav.style.backgroundColor);
    } else {
      navbarLinks.forEach(el => {
        el.style.color = 'rgb(28, 28, 28)';
      });
      searchIconPaths.forEach(path => path.setAttribute('fill', 'rgb(28, 28, 28)'));
      nav.style.backgroundColor = 'inherit';
    }
  });

document.addEventListener('DOMContentLoaded', () => {
  // Select all menu items that contain a submenu
  const dropdowns = document.querySelectorAll('li[data-nav-level="1"]');

  dropdowns.forEach(item => {
    const submenu = item.querySelector('.oGuwee');
    if (!submenu) return;

    // Show on hover
    item.addEventListener('mouseenter', () => {
      submenu.style.display = 'block';
      submenu.style.backgroundColor = 'rgba(7, 55, 99, 1)';
      submenu.style.color = 'white';
    });

    // Hide on mouse leave
    item.addEventListener('mouseleave', () => {
      submenu.style.display = 'none';
    });
  });



  const hamburger = document.getElementById('s9iPrd');
	const mobileNav = document.getElementById('yuynLe');

	hamburger.addEventListener('click', () => {
	  if (!mobileNav) return;

	  const isOpen = mobileNav.style.display === 'block';

		if (!isOpen) {
		  mobileNav.style.display = 'block';
		  hamburger.innerHTML = '&#10005;'; // simple "X"
		} else {
		  mobileNav.style.display = 'none';
		  hamburger.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 6h18M3 12h18M3 18h18" stroke="white" stroke-width="2"/></svg>'; // hamburger
		}
			  
	});

	// Mobile submenu expand/collapse
document.querySelectorAll('#yuynLe [jsname="ix0Hvc"]').forEach(caret => {
  caret.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const parent = caret.closest('li');
    const submenu = parent.querySelector('.oGuwee');

    if (submenu) {
      const isOpen = submenu.style.display === 'block';
      submenu.style.display = isOpen ? 'none' : 'block';
      caret.classList.toggle('open', !isOpen);
    }
  });
});

});
