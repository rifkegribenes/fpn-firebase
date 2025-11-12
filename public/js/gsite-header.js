// gsite front end js for header

window.addEventListener('scroll', function() {
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

 const searchIcon = document.getElementById("search-icon");
const searchBar = document.getElementById("search-bar");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");

// Open search bar
searchIcon.addEventListener("click", () => {
  searchBar.classList.add("active");
  searchInput.focus();
});

// Clear input
searchButton.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  searchButton.style.display = "none";
});

// Hide clear button if input is empty
searchInput.addEventListener("input", () => {
  searchButton.style.display = searchInput.value.length > 0 ? "block" : "none";
});

// Trigger search on Enter
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    console.log("Search for:", searchInput.value);
    // trigger search here
  }
  if (e.key === "Escape") {
    closeSearchBar();
  }
});

// Click-away listener
document.addEventListener("click", (e) => {
  if (!searchBar.contains(e.target) && !searchIcon.contains(e.target)) {
    closeSearchBar();
  }
});

// Close search bar function
function closeSearchBar() {
  searchBar.classList.remove("active");
  searchInput.value = "";
  searchButton.style.display = "none";
}
});
