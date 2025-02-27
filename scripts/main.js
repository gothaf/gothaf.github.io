// scripts/main.js

import { initializeChatWithData } from './chatRenderer.js';
import { loadSidebar } from './sidebar.js';
import { setupScrollTracking, startBatchFlushInterval } from './analytics.js';
// You can also import flushEvents if you want to call it manually, etc.

// A function to load JSON
function loadJSONFile(jsonFilePath, callback) {
	const xhr = new XMLHttpRequest();
	xhr.open('GET', jsonFilePath, true);
	xhr.responseType = 'json';

	xhr.onload = function () {
		if (xhr.status >= 200 && xhr.status < 300) {
			callback(null, xhr.response);
		} else {
			callback(new Error('Failed to load JSON file: ' + xhr.status));
		}
	};

	xhr.onerror = function () {
		callback(new Error('Network error while loading JSON file'));
	};

	xhr.send();
}

// On DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
	// read <meta name="page-id">
	const metaTag = document.querySelector('meta[name="page-id"]');
	const pageId = metaTag ? metaTag.content : 'Unknown';

	// start the flush interval for analytics
	startBatchFlushInterval();

	// If there's a data-config script with JSON
	const scriptTag = document.querySelector('script#data-config');
	const jsonFilePath = scriptTag?.getAttribute('src');

	if (jsonFilePath) {
		loadJSONFile(jsonFilePath, (error, jsonData) => {
			if (error) {
				console.error(error);
			} else {
				// Initialize chat
				initializeChatWithData(jsonData);
				// Setup sidebar
				loadSidebar(pageId);
				// Setup scroll tracking
				setupScrollTracking(pageId);
			}
		});
	} else {
		console.error('JSON file path is not specified.');
	}

	// Send page load event (single request)
	fetch('https://api.test.tradext.gr/github_pages/events.php', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ page_id: pageId }),
	})
		.then((resp) => resp.json())
		.then((data) => {
			console.log('Page load logged:', data);
		})
		.catch((err) => {
			console.error('Error logging page load:', err);
		});
});

// Optionally handle click events for images, etc. if needed
document.addEventListener('click', (event) => {
	// If a thumbnail was clicked
	if (event.target.matches('.thumbnail')) {
		const imageContainer = event.target.closest('.image-container');
		const overlay = imageContainer.querySelector('.full-image-overlay');
		overlay.classList.remove('hidden');
	}

	// If the close button or the overlay background was clicked
	if (
		event.target.matches('.close-overlay') ||
		event.target.classList.contains('full-image-overlay') // optional: close if background is clicked
	) {
		const overlay = event.target.closest('.full-image-overlay');
		overlay.classList.add('hidden');
	}
});
