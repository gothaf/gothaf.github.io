// scripts/analytics.js

let localEventsQueue = [];

/**
 * Returns basic device info that the backend will use for model/type detection.
 * This function provides only raw data.
 */
export function getBasicDeviceInfo() {
	return {
		user_agent: navigator.userAgent || '',
		screen_resolution: `${window.screen.width}x${window.screen.height}`,
		device_pixel_ratio: window.devicePixelRatio || 1,
		platform: navigator.platform || '',
	};
}

/**
 * Log an event locally and also send to Google Analytics if available.
 * @param {string} eventName - e.g. "scroll_start"
 * @param {string} eventLabel - e.g. "message-1"
 * @param {string} pageId
 */
export function logLocalEvent(eventName, eventLabel, pageId) {
	// Get basic device info from the client
	const deviceInfo = getBasicDeviceInfo();

	// Add event to the local events queue along with device info
	localEventsQueue.push({
		event_name: eventName,
		event_label: eventLabel,
		page_id: pageId,
		timestamp: Date.now(),
		...deviceInfo,
	});
}
/**
 * Log an event locally and also send to Google Analytics if available.
 * @param {string} eventName - e.g. "scroll_start"
 * @param {string} eventLabel - e.g. "message-1"
 * @param {string} pageId
 */
export function logLocalEvent(eventName, eventLabel, pageId) {
	const deviceInfo = getDeviceInfo();

	localEventsQueue.push({
		event_name: eventName,
		event_label: eventLabel,
		page_id: pageId,
		timestamp: Date.now(),
		...deviceInfo,
	});

	// Also log to Google Analytics
	gtag('event', eventName, {
		event_category: 'engagement',
		event_label: eventLabel,
	});
}

/**
 * Send all events in the queue to the backend in one POST request.
 */
export function flushEvents() {
	if (localEventsQueue.length === 0) return;

	const eventsToSend = [...localEventsQueue];
	localEventsQueue = [];

	fetch('https://api.test.tradext.gr/github_pages/events.php', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ events: eventsToSend }),
	})
		.then((res) => res.json())
		.then((data) => {
			// console.log('Batched events sent:', data);
		})
		.catch((err) => {
			console.error('Error sending batched events:', err);
			// Optionally requeue
			// localEventsQueue = eventsToSend.concat(localEventsQueue);
		});
}

/**
 * Setup interval to flush every 2 seconds
 * (Call this once in main.js)
 */
export function startBatchFlushInterval() {
	setInterval(() => {
		flushEvents();
	}, 2000);
}

/**
 * Setup scroll tracking: IntersectionObserver + scroll events
 */
export function setupScrollTracking(pageId) {
	const messageElements = document.querySelectorAll('.message');

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && !entry.target.classList.contains('entered')) {
					logLocalEvent('scroll_start', entry.target.dataset.section, pageId);
					entry.target.classList.add('entered');
				}
			});
		},
		{ root: null, threshold: 0.01 }
	);

	messageElements.forEach((msg) => observer.observe(msg));

	window.addEventListener('scroll', () => {
		messageElements.forEach((msg) => {
			const rect = msg.getBoundingClientRect();
			const hasEnded = rect.bottom <= 0;

			if (hasEnded && !msg.classList.contains('ended')) {
				logLocalEvent('scroll_end', msg.dataset.section, pageId);
				msg.classList.add('ended');
			}
		});
	});
}
