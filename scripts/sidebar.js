// scripts/sidebar.js

export function loadSidebar(pageId) {
	// Load sidebar and header
	const sidebarPath = pageId == 'main' ? './sidebar.html' : '../sidebar.html';

	fetch(sidebarPath)
		.then((response) => response.text())
		.then((html) => {
			document.getElementById('sidebar-container').innerHTML = html;

			const hamburgerButton = document.getElementById('hamburger');
			const sidebar = document.getElementById('sidebar');

			if (hamburgerButton && sidebar) {
				hamburgerButton.addEventListener('click', () => {
					sidebar.classList.toggle('hidden');
				});
			} else {
				console.error('Sidebar or hamburger not found');
			}

			if (pageId === 'main') {
				sidebar.classList.remove('hidden');
			}
		})
		.catch((err) => console.error('Error loading sidebar:', err));
}
