// scripts/analytics.js

// A global (module-level) events queue
let localEventsQueue = [];

/**
 * Log an event locally and also send to Google Analytics if available.
 * @param {string} eventName - e.g. "scroll_start"
 * @param {string} eventLabel - e.g. "message-1"
 * @param {string} pageId
 */
export function logLocalEvent(eventName, eventLabel, pageId) {
	// Push the event into the local queue
	localEventsQueue.push({
		event_name: eventName,
		event_label: eventLabel,
		page_id: pageId,
		timestamp: Date.now(),
	});

	// Also log to Google Analytics
	// (If blocked, it will fail silently.)
	gtag('event', eventName, {
		event_category: 'engagement',
		event_label: eventLabel,
	});
}

/**
 * Send all events in the queue to the backend in one POST request.
 */
export function flushEvents() {
	if (localEventsQueue.length === 0) {
		return;
	}

	// Copy & reset
	const eventsToSend = [...localEventsQueue];
	localEventsQueue = [];

	fetch('https://api.test.tradext.gr/github_pages/events.php', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ events: eventsToSend }),
	})
		.then((res) => res.json())
		.then((data) => {
			console.log('Batched events sent successfully:', data);
		})
		.catch((err) => {
			console.error('Error sending batched events:', err);
			// Optionally re-queue:
			// localEventsQueue = eventsToSend.concat(localEventsQueue);
		});
}

/**
 * Setup interval to flush every 2 seconds
 * (Call this function once in main.js)
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

	// Intersection Observer for "scroll_start"
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && !entry.target.classList.contains('entered')) {
					// Also log to local queue
					logLocalEvent('scroll_start', entry.target.dataset.section, pageId);

					// Mark as entered
					entry.target.classList.add('entered');
				}
			});
		},
		{
			root: null,
			threshold: 0.01,
		}
	);

	// Observe each message element
	messageElements.forEach((msg) => observer.observe(msg));

	// "scroll_end"
	window.addEventListener('scroll', () => {
		messageElements.forEach((msg) => {
			const rect = msg.getBoundingClientRect();
			const hasEnded = rect.bottom <= 0; // element is fully above the viewport

			if (hasEnded && !msg.classList.contains('ended')) {
				// Also log to local queue
				logLocalEvent('scroll_end', msg.dataset.section, pageId);

				msg.classList.add('ended');
			}
		});
	});
}
